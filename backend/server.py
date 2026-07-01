"""SOPRA PM — FastAPI backend on Microsoft SQL Server."""
from __future__ import annotations

import logging
import os
from datetime import date, datetime, timezone
from pathlib import Path
from typing import List, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, FastAPI, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field
from starlette.middleware.cors import CORSMiddleware

from db import (
    csv_join,
    csv_split,
    execute,
    fetch_all,
    fetch_one,
    insert_returning_id,
    iso,
    ping,
)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

app = FastAPI(title="SOPRA PM API", version="2.0-mssql")
api_router = APIRouter(prefix="/api")


# =====================================================================
# Models — using PascalCase columns from DB, exposed as snake_case JSON
# =====================================================================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TeamMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    name: str
    role: str
    email: Optional[str] = None
    areas: List[str] = Field(default_factory=list)
    rules: Optional[str] = None
    capacity_sp: int = 20
    avatar_color: Optional[str] = None
    created_at: Optional[str] = None


class TeamMemberCreate(BaseModel):
    name: str
    role: str
    email: Optional[str] = None
    areas: List[str] = Field(default_factory=list)
    rules: Optional[str] = None
    capacity_sp: int = 20
    avatar_color: Optional[str] = None


class TeamMemberUpdate(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    email: Optional[str] = None
    areas: Optional[List[str]] = None
    rules: Optional[str] = None
    capacity_sp: Optional[int] = None
    avatar_color: Optional[str] = None


class Sprint(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    sprint_number: int
    name: str
    quarter: str
    start_date: str
    end_date: str
    goal: Optional[str] = None
    status: str = "Planned"
    capacity_sp: int = 30
    created_at: Optional[str] = None


class SprintCreate(BaseModel):
    sprint_number: int
    name: str
    quarter: str
    start_date: str
    end_date: str
    goal: Optional[str] = None
    status: str = "Planned"
    capacity_sp: int = 30


class SprintUpdate(BaseModel):
    sprint_number: Optional[int] = None
    name: Optional[str] = None
    quarter: Optional[str] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    goal: Optional[str] = None
    status: Optional[str] = None
    capacity_sp: Optional[int] = None


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    system: Optional[str] = None
    owner_id: Optional[int] = None
    color: str = "#0033CC"
    status: str = "Active"
    created_at: Optional[str] = None


class ProjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    system: Optional[str] = None
    owner_id: Optional[int] = None
    color: str = "#0033CC"
    status: str = "Active"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    system: Optional[str] = None
    owner_id: Optional[int] = None
    color: Optional[str] = None
    status: Optional[str] = None


class BacklogItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    wb_ref: str
    title: str
    system: str
    priority: str
    quarter: str
    project_id: Optional[int] = None
    phase: Optional[str] = None
    sprint_id: Optional[int] = None
    dev_assignee_id: Optional[int] = None
    qa_assignee_id: Optional[int] = None
    story_points: int = 0
    target_date: Optional[str] = None
    actual_date: Optional[str] = None
    percent_done: int = 0
    status: str = "Backlog"
    notes: Optional[str] = None
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class BacklogItemCreate(BaseModel):
    wb_ref: str
    title: str
    system: str
    priority: str
    quarter: str
    project_id: Optional[int] = None
    phase: Optional[str] = None
    sprint_id: Optional[int] = None
    dev_assignee_id: Optional[int] = None
    qa_assignee_id: Optional[int] = None
    story_points: int = 0
    target_date: Optional[str] = None
    actual_date: Optional[str] = None
    percent_done: int = 0
    status: str = "Backlog"
    notes: Optional[str] = None


class BacklogItemUpdate(BaseModel):
    wb_ref: Optional[str] = None
    title: Optional[str] = None
    system: Optional[str] = None
    priority: Optional[str] = None
    quarter: Optional[str] = None
    project_id: Optional[int] = None
    phase: Optional[str] = None
    sprint_id: Optional[int] = None
    dev_assignee_id: Optional[int] = None
    qa_assignee_id: Optional[int] = None
    story_points: Optional[int] = None
    target_date: Optional[str] = None
    actual_date: Optional[str] = None
    percent_done: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class Activity(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: int
    item_id: int
    kind: str
    actor_id: Optional[int] = None
    text: Optional[str] = None
    field: Optional[str] = None
    from_value: Optional[str] = None
    to_value: Optional[str] = None
    created_at: Optional[str] = None


class CommentCreate(BaseModel):
    text: str
    actor_id: Optional[int] = None


# =====================================================================
# Row mappers (DB PascalCase -> API snake_case)
# =====================================================================
def row_to_member(r: dict) -> TeamMember:
    return TeamMember(
        id=r["Id"],
        name=r["Name"],
        role=r["Role"],
        email=r.get("Email"),
        areas=csv_split(r.get("Areas")),
        rules=r.get("Rules"),
        capacity_sp=r.get("CapacitySp", 20),
        avatar_color=r.get("AvatarColor"),
        created_at=iso(r.get("CreatedAt")),
    )


def row_to_sprint(r: dict) -> Sprint:
    return Sprint(
        id=r["Id"],
        sprint_number=r["SprintNumber"],
        name=r["Name"],
        quarter=r["Quarter"],
        start_date=iso(r["StartDate"]),
        end_date=iso(r["EndDate"]),
        goal=r.get("Goal"),
        status=r.get("Status", "Planned"),
        capacity_sp=r.get("CapacitySp", 30),
        created_at=iso(r.get("CreatedAt")),
    )


def row_to_project(r: dict) -> Project:
    return Project(
        id=r["Id"],
        name=r["Name"],
        code=r.get("Code"),
        description=r.get("Description"),
        system=r.get("System"),
        owner_id=r.get("OwnerId"),
        color=r.get("Color", "#0033CC"),
        status=r.get("Status", "Active"),
        created_at=iso(r.get("CreatedAt")),
    )


def row_to_backlog(r: dict) -> BacklogItem:
    return BacklogItem(
        id=r["Id"],
        wb_ref=r["WbRef"],
        title=r["Title"],
        system=r["System"],
        priority=r["Priority"],
        quarter=r["Quarter"],
        project_id=r.get("ProjectId"),
        phase=r.get("Phase"),
        sprint_id=r.get("SprintId"),
        dev_assignee_id=r.get("DevAssigneeId"),
        qa_assignee_id=r.get("QaAssigneeId"),
        story_points=r.get("StoryPoints", 0),
        target_date=iso(r.get("TargetDate")),
        actual_date=iso(r.get("ActualDate")),
        percent_done=r.get("PercentDone", 0),
        status=r.get("Status", "Backlog"),
        notes=r.get("Notes"),
        created_at=iso(r.get("CreatedAt")),
        updated_at=iso(r.get("UpdatedAt")),
    )


def row_to_activity(r: dict) -> Activity:
    return Activity(
        id=r["Id"],
        item_id=r["ItemId"],
        kind=r["Kind"],
        actor_id=r.get("ActorId"),
        text=r.get("Text"),
        field=r.get("Field"),
        from_value=r.get("FromValue"),
        to_value=r.get("ToValue"),
        created_at=iso(r.get("CreatedAt")),
    )


# =====================================================================
# Team Members
# =====================================================================
@api_router.get("/team", response_model=List[TeamMember])
async def list_team():
    rows = await fetch_all(
        "SELECT * FROM dbo.TeamMembers ORDER BY Id"
    )
    return [row_to_member(r) for r in rows]


@api_router.post("/team", response_model=TeamMember)
async def create_team_member(data: TeamMemberCreate):
    new_id = await insert_returning_id(
        """INSERT INTO dbo.TeamMembers (Name, Role, Email, Areas, Rules, CapacitySp, AvatarColor)
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (data.name, data.role, data.email, csv_join(data.areas), data.rules,
         data.capacity_sp, data.avatar_color),
    )
    row = await fetch_one("SELECT * FROM dbo.TeamMembers WHERE Id=%s", (new_id,))
    return row_to_member(row)


@api_router.get("/team/{member_id}", response_model=TeamMember)
async def get_team_member(member_id: int):
    row = await fetch_one("SELECT * FROM dbo.TeamMembers WHERE Id=%s", (member_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Team member not found")
    return row_to_member(row)


@api_router.patch("/team/{member_id}", response_model=TeamMember)
async def update_team_member(member_id: int, data: TeamMemberUpdate):
    fields, params = [], []
    for py_name, col in [
        ("name", "Name"), ("role", "Role"), ("email", "Email"),
        ("rules", "Rules"), ("capacity_sp", "CapacitySp"),
        ("avatar_color", "AvatarColor"),
    ]:
        v = getattr(data, py_name)
        if v is not None:
            fields.append(f"{col}=%s")
            params.append(v)
    if data.areas is not None:
        fields.append("Areas=%s")
        params.append(csv_join(data.areas))

    if fields:
        params.append(member_id)
        n = await execute(f"UPDATE dbo.TeamMembers SET {', '.join(fields)} WHERE Id=%s", params)
        if n == 0:
            raise HTTPException(status_code=404, detail="Team member not found")

    row = await fetch_one("SELECT * FROM dbo.TeamMembers WHERE Id=%s", (member_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Team member not found")
    return row_to_member(row)


@api_router.delete("/team/{member_id}")
async def delete_team_member(member_id: int):
    n = await execute("DELETE FROM dbo.TeamMembers WHERE Id=%s", (member_id,))
    if n == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    return {"ok": True}


# =====================================================================
# Sprints
# =====================================================================
@api_router.get("/sprints", response_model=List[Sprint])
async def list_sprints(quarter: Optional[str] = None):
    if quarter:
        rows = await fetch_all(
            "SELECT * FROM dbo.Sprints WHERE Quarter=%s ORDER BY SprintNumber",
            (quarter,),
        )
    else:
        rows = await fetch_all("SELECT * FROM dbo.Sprints ORDER BY SprintNumber")
    return [row_to_sprint(r) for r in rows]


@api_router.post("/sprints", response_model=Sprint)
async def create_sprint(data: SprintCreate):
    new_id = await insert_returning_id(
        """INSERT INTO dbo.Sprints (SprintNumber, Name, Quarter, StartDate, EndDate, Goal, [Status], CapacitySp)
           VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
        (data.sprint_number, data.name, data.quarter, data.start_date, data.end_date,
         data.goal, data.status, data.capacity_sp),
    )
    row = await fetch_one("SELECT * FROM dbo.Sprints WHERE Id=%s", (new_id,))
    return row_to_sprint(row)


@api_router.get("/sprints/{sprint_id}", response_model=Sprint)
async def get_sprint(sprint_id: int):
    row = await fetch_one("SELECT * FROM dbo.Sprints WHERE Id=%s", (sprint_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return row_to_sprint(row)


@api_router.patch("/sprints/{sprint_id}", response_model=Sprint)
async def update_sprint(sprint_id: int, data: SprintUpdate):
    fields, params = [], []
    for py, col in [
        ("sprint_number", "SprintNumber"), ("name", "Name"), ("quarter", "Quarter"),
        ("start_date", "StartDate"), ("end_date", "EndDate"), ("goal", "Goal"),
        ("status", "[Status]"), ("capacity_sp", "CapacitySp"),
    ]:
        v = getattr(data, py)
        if v is not None:
            fields.append(f"{col}=%s")
            params.append(v)
    if fields:
        params.append(sprint_id)
        n = await execute(f"UPDATE dbo.Sprints SET {', '.join(fields)} WHERE Id=%s", params)
        if n == 0:
            raise HTTPException(status_code=404, detail="Sprint not found")
    row = await fetch_one("SELECT * FROM dbo.Sprints WHERE Id=%s", (sprint_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return row_to_sprint(row)


@api_router.delete("/sprints/{sprint_id}")
async def delete_sprint(sprint_id: int):
    n = await execute("DELETE FROM dbo.Sprints WHERE Id=%s", (sprint_id,))
    if n == 0:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return {"ok": True}


# =====================================================================
# Projects
# =====================================================================
@api_router.get("/projects", response_model=List[Project])
async def list_projects():
    rows = await fetch_all("SELECT * FROM dbo.Projects ORDER BY Id")
    return [row_to_project(r) for r in rows]


@api_router.post("/projects", response_model=Project)
async def create_project(data: ProjectCreate):
    new_id = await insert_returning_id(
        """INSERT INTO dbo.Projects (Name, Code, [Description], [System], OwnerId, Color, [Status])
           VALUES (%s, %s, %s, %s, %s, %s, %s)""",
        (data.name, data.code, data.description, data.system, data.owner_id,
         data.color, data.status),
    )
    row = await fetch_one("SELECT * FROM dbo.Projects WHERE Id=%s", (new_id,))
    return row_to_project(row)


@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: int):
    row = await fetch_one("SELECT * FROM dbo.Projects WHERE Id=%s", (project_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return row_to_project(row)


@api_router.patch("/projects/{project_id}", response_model=Project)
async def update_project(project_id: int, data: ProjectUpdate):
    fields, params = [], []
    for py, col in [
        ("name", "Name"), ("code", "Code"), ("description", "[Description]"),
        ("system", "[System]"), ("owner_id", "OwnerId"), ("color", "Color"),
        ("status", "[Status]"),
    ]:
        v = getattr(data, py)
        if v is not None:
            fields.append(f"{col}=%s")
            params.append(v)
    if fields:
        params.append(project_id)
        n = await execute(f"UPDATE dbo.Projects SET {', '.join(fields)} WHERE Id=%s", params)
        if n == 0:
            raise HTTPException(status_code=404, detail="Project not found")
    row = await fetch_one("SELECT * FROM dbo.Projects WHERE Id=%s", (project_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    return row_to_project(row)


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: int):
    n = await execute("DELETE FROM dbo.Projects WHERE Id=%s", (project_id,))
    if n == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    # FK ON DELETE SET NULL automatically detaches backlog items
    return {"ok": True}


@api_router.get("/projects/{project_id}/summary")
async def project_summary(project_id: int):
    proj = await fetch_one("SELECT * FROM dbo.Projects WHERE Id=%s", (project_id,))
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")

    items = await fetch_all(
        "SELECT * FROM dbo.BacklogItems WHERE ProjectId=%s",
        (project_id,),
    )
    total_sp = sum(i.get("StoryPoints", 0) or 0 for i in items)
    done_sp = sum((i.get("StoryPoints", 0) or 0) for i in items if i.get("Status") == "Done")

    phases: dict = {}
    for i in items:
        ph = i.get("Phase") or "Unphased"
        if ph not in phases:
            phases[ph] = {"phase": ph, "items": 0, "total_sp": 0, "done_sp": 0,
                          "in_progress": 0, "in_review": 0, "backlog": 0, "done": 0}
        sp = i.get("StoryPoints", 0) or 0
        phases[ph]["items"] += 1
        phases[ph]["total_sp"] += sp
        st = i.get("Status", "Backlog")
        if st == "Done":
            phases[ph]["done_sp"] += sp
            phases[ph]["done"] += 1
        elif st == "In Progress":
            phases[ph]["in_progress"] += 1
        elif st == "In Review":
            phases[ph]["in_review"] += 1
        else:
            phases[ph]["backlog"] += 1
    phase_list = sorted(phases.values(), key=lambda p: p["phase"])
    for p in phase_list:
        p["completion_pct"] = round((p["done_sp"] / p["total_sp"] * 100) if p["total_sp"] > 0 else 0, 1)

    return {
        "project": row_to_project(proj).model_dump(),
        "items": len(items),
        "total_sp": total_sp,
        "done_sp": done_sp,
        "completion_pct": round((done_sp / total_sp * 100) if total_sp > 0 else 0, 1),
        "phases": phase_list,
    }


# =====================================================================
# Backlog
# =====================================================================
TRACKED_FIELDS = [
    ("status", "Status"),
    ("priority", "Priority"),
    ("dev_assignee_id", "Dev assignee"),
    ("qa_assignee_id", "QA assignee"),
    ("sprint_id", "Sprint"),
    ("project_id", "Project"),
    ("phase", "Phase"),
    ("story_points", "Story points"),
    ("percent_done", "% done"),
]

BACKLOG_UPDATE_COLS = {
    "wb_ref": "WbRef",
    "title": "Title",
    "system": "[System]",
    "priority": "Priority",
    "quarter": "Quarter",
    "project_id": "ProjectId",
    "phase": "Phase",
    "sprint_id": "SprintId",
    "dev_assignee_id": "DevAssigneeId",
    "qa_assignee_id": "QaAssigneeId",
    "story_points": "StoryPoints",
    "target_date": "TargetDate",
    "actual_date": "ActualDate",
    "percent_done": "PercentDone",
    "status": "[Status]",
    "notes": "Notes",
}

# For diff-logging we need to map API field -> DB column so we can read the
# pre-update snapshot correctly.
TRACKED_FIELD_COL = {
    "status": "Status",
    "priority": "Priority",
    "dev_assignee_id": "DevAssigneeId",
    "qa_assignee_id": "QaAssigneeId",
    "sprint_id": "SprintId",
    "project_id": "ProjectId",
    "phase": "Phase",
    "story_points": "StoryPoints",
    "percent_done": "PercentDone",
}


@api_router.get("/backlog", response_model=List[BacklogItem])
async def list_backlog(
    priority: Optional[str] = None,
    system: Optional[str] = None,
    quarter: Optional[str] = None,
    sprint_id: Optional[int] = None,
    status: Optional[str] = None,
    dev_assignee_id: Optional[int] = None,
    project_id: Optional[int] = None,
    phase: Optional[str] = None,
):
    where, params = [], []
    if priority:
        where.append("Priority=%s")
        params.append(priority)
    if system:
        where.append("[System]=%s")
        params.append(system)
    if quarter:
        where.append("Quarter=%s")
        params.append(quarter)
    if sprint_id is not None:
        where.append("SprintId=%s")
        params.append(sprint_id)
    if status:
        where.append("[Status]=%s")
        params.append(status)
    if dev_assignee_id is not None:
        where.append("DevAssigneeId=%s")
        params.append(dev_assignee_id)
    if project_id is not None:
        where.append("ProjectId=%s")
        params.append(project_id)
    if phase:
        where.append("Phase=%s")
        params.append(phase)

    sql = "SELECT * FROM dbo.BacklogItems"
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " ORDER BY Id"
    rows = await fetch_all(sql, params)
    return [row_to_backlog(r) for r in rows]


@api_router.post("/backlog", response_model=BacklogItem)
async def create_backlog(data: BacklogItemCreate):
    new_id = await insert_returning_id(
        """INSERT INTO dbo.BacklogItems
           (WbRef, Title, [System], Priority, Quarter, ProjectId, Phase, SprintId,
            DevAssigneeId, QaAssigneeId, StoryPoints, TargetDate, ActualDate,
            PercentDone, [Status], Notes)
           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
        (data.wb_ref, data.title, data.system, data.priority, data.quarter,
         data.project_id, data.phase, data.sprint_id, data.dev_assignee_id,
         data.qa_assignee_id, data.story_points, data.target_date,
         data.actual_date, data.percent_done, data.status, data.notes),
    )
    row = await fetch_one("SELECT * FROM dbo.BacklogItems WHERE Id=%s", (new_id,))
    return row_to_backlog(row)


@api_router.get("/backlog/{item_id}", response_model=BacklogItem)
async def get_backlog(item_id: int):
    row = await fetch_one("SELECT * FROM dbo.BacklogItems WHERE Id=%s", (item_id,))
    if not row:
        raise HTTPException(status_code=404, detail="Item not found")
    return row_to_backlog(row)


@api_router.patch("/backlog/{item_id}", response_model=BacklogItem)
async def update_backlog(
    item_id: int,
    data: BacklogItemUpdate,
    actor_id: Optional[int] = None,
):
    before = await fetch_one("SELECT * FROM dbo.BacklogItems WHERE Id=%s", (item_id,))
    if not before:
        raise HTTPException(status_code=404, detail="Item not found")

    updates = data.model_dump(exclude_unset=True)
    # Handle status -> Done auto side-effects
    if updates.get("status") == "Done":
        if "percent_done" not in updates:
            updates["percent_done"] = 100
        if "actual_date" not in updates:
            updates["actual_date"] = date.today().isoformat()

    if updates:
        fields, params = [], []
        for py_key, val in updates.items():
            col = BACKLOG_UPDATE_COLS.get(py_key)
            if not col:
                continue
            fields.append(f"{col}=%s")
            params.append(val)
        if fields:
            params.append(item_id)
            await execute(
                f"UPDATE dbo.BacklogItems SET {', '.join(fields)} WHERE Id=%s",
                params,
            )

    # Auto-log tracked field changes
    logs = []
    for py_key, label in TRACKED_FIELDS:
        if py_key not in updates:
            continue
        col = TRACKED_FIELD_COL[py_key]
        new_val = updates[py_key]
        old_val = before.get(col)
        if old_val != new_val:
            logs.append((
                item_id, "change", actor_id, f"{label} changed",
                py_key,
                str(old_val) if old_val is not None else "—",
                str(new_val) if new_val is not None else "—",
            ))
    for log in logs:
        await execute(
            """INSERT INTO dbo.Activity (ItemId, Kind, ActorId, [Text], [Field], FromValue, ToValue)
               VALUES (%s, %s, %s, %s, %s, %s, %s)""",
            log,
        )

    row = await fetch_one("SELECT * FROM dbo.BacklogItems WHERE Id=%s", (item_id,))
    return row_to_backlog(row)


@api_router.delete("/backlog/{item_id}")
async def delete_backlog(item_id: int):
    # Activity FK is ON DELETE CASCADE — no manual cleanup needed
    n = await execute("DELETE FROM dbo.BacklogItems WHERE Id=%s", (item_id,))
    if n == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


# =====================================================================
# Activity / Comments
# =====================================================================
@api_router.get("/backlog/{item_id}/activity", response_model=List[Activity])
async def list_activity(item_id: int):
    rows = await fetch_all(
        "SELECT * FROM dbo.Activity WHERE ItemId=%s ORDER BY CreatedAt DESC, Id DESC",
        (item_id,),
    )
    return [row_to_activity(r) for r in rows]


@api_router.post("/backlog/{item_id}/comments", response_model=Activity)
async def create_comment(item_id: int, data: CommentCreate):
    item = await fetch_one("SELECT Id FROM dbo.BacklogItems WHERE Id=%s", (item_id,))
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    text = (data.text or "").strip()
    if not text:
        raise HTTPException(status_code=400, detail="Comment text required")
    new_id = await insert_returning_id(
        """INSERT INTO dbo.Activity (ItemId, Kind, ActorId, [Text])
           VALUES (%s, %s, %s, %s)""",
        (item_id, "comment", data.actor_id, text),
    )
    row = await fetch_one("SELECT * FROM dbo.Activity WHERE Id=%s", (new_id,))
    return row_to_activity(row)


@api_router.delete("/activity/{activity_id}")
async def delete_activity(activity_id: int):
    n = await execute(
        "DELETE FROM dbo.Activity WHERE Id=%s AND Kind='comment'",
        (activity_id,),
    )
    if n == 0:
        raise HTTPException(status_code=404, detail="Comment not found")
    return {"ok": True}


# =====================================================================
# Dashboard
# =====================================================================
@api_router.get("/dashboard/summary")
async def dashboard_summary():
    total_row = await fetch_one(
        """SELECT
              COUNT(*) AS total_items,
              ISNULL(SUM(StoryPoints), 0) AS total_sp,
              SUM(CASE WHEN [Status]='Done' THEN 1 ELSE 0 END) AS done_items,
              ISNULL(SUM(CASE WHEN [Status]='Done' THEN StoryPoints ELSE 0 END), 0) AS done_sp,
              SUM(CASE WHEN [Status]='In Progress' THEN 1 ELSE 0 END) AS in_progress,
              SUM(CASE WHEN [Status]='In Review'   THEN 1 ELSE 0 END) AS in_review,
              SUM(CASE WHEN [Status]='Backlog'     THEN 1 ELSE 0 END) AS backlog
           FROM dbo.BacklogItems"""
    )
    total_sp = total_row["total_sp"] or 0
    done_sp = total_row["done_sp"] or 0
    completion_pct = round((done_sp / total_sp * 100) if total_sp > 0 else 0, 1)

    prio_rows = await fetch_all(
        """SELECT Priority,
                  COUNT(*) AS count,
                  ISNULL(SUM(StoryPoints), 0) AS sp,
                  ISNULL(SUM(CASE WHEN [Status]='Done' THEN StoryPoints ELSE 0 END), 0) AS done_sp
             FROM dbo.BacklogItems
            GROUP BY Priority"""
    )
    by_priority = {p: {"count": 0, "sp": 0, "done_sp": 0} for p in ("P1", "P2", "P3", "P4")}
    for r in prio_rows:
        by_priority[r["Priority"]] = {
            "count": r["count"], "sp": r["sp"] or 0, "done_sp": r["done_sp"] or 0,
        }

    sys_rows = await fetch_all(
        """SELECT [System] AS name,
                  COUNT(*) AS count,
                  ISNULL(SUM(StoryPoints), 0) AS sp,
                  ISNULL(SUM(CASE WHEN [Status]='Done' THEN StoryPoints ELSE 0 END), 0) AS done_sp
             FROM dbo.BacklogItems
            GROUP BY [System]"""
    )
    by_system = {
        r["name"]: {"count": r["count"], "sp": r["sp"] or 0, "done_sp": r["done_sp"] or 0}
        for r in sys_rows
    }

    return {
        "total_items": total_row["total_items"],
        "total_sp": total_sp,
        "done_items": total_row["done_items"] or 0,
        "done_sp": done_sp,
        "in_progress": total_row["in_progress"] or 0,
        "in_review": total_row["in_review"] or 0,
        "backlog": total_row["backlog"] or 0,
        "completion_pct": completion_pct,
        "by_priority": by_priority,
        "by_system": by_system,
    }


@api_router.get("/dashboard/quarterly")
async def dashboard_quarterly():
    rows = await fetch_all(
        """SELECT Quarter,
                  COUNT(*) AS items,
                  SUM(CASE WHEN [Status]='Done' THEN 1 ELSE 0 END) AS done_items,
                  ISNULL(SUM(StoryPoints), 0) AS total_sp,
                  ISNULL(SUM(CASE WHEN [Status]='Done' THEN StoryPoints ELSE 0 END), 0) AS done_sp
             FROM dbo.BacklogItems
            GROUP BY Quarter
            ORDER BY Quarter"""
    )
    result = []
    for r in rows:
        total_sp = r["total_sp"] or 0
        done_sp = r["done_sp"] or 0
        result.append({
            "quarter": r["Quarter"],
            "items": r["items"],
            "done_items": r["done_items"] or 0,
            "total_sp": total_sp,
            "done_sp": done_sp,
            "completion_pct": round((done_sp / total_sp * 100) if total_sp > 0 else 0, 1),
        })
    return result


@api_router.get("/dashboard/sprint-velocity")
async def dashboard_sprint_velocity():
    rows = await fetch_all(
        """SELECT s.Id AS sprint_id, s.Name, s.Quarter, s.[Status], s.CapacitySp,
                  s.StartDate, s.EndDate,
                  ISNULL(SUM(b.StoryPoints), 0) AS planned_sp,
                  ISNULL(SUM(CASE WHEN b.[Status]='Done' THEN b.StoryPoints ELSE 0 END), 0) AS completed_sp,
                  COUNT(b.Id) AS items
             FROM dbo.Sprints s
             LEFT JOIN dbo.BacklogItems b ON b.SprintId = s.Id
            GROUP BY s.Id, s.Name, s.Quarter, s.[Status], s.CapacitySp, s.StartDate, s.EndDate, s.SprintNumber
            ORDER BY s.SprintNumber"""
    )
    return [
        {
            "sprint_id": r["sprint_id"],
            "name": r["Name"],
            "quarter": r["Quarter"],
            "planned_sp": r["planned_sp"] or 0,
            "completed_sp": r["completed_sp"] or 0,
            "items": r["items"] or 0,
            "status": r["Status"],
            "capacity_sp": r["CapacitySp"],
            "start_date": iso(r["StartDate"]),
            "end_date": iso(r["EndDate"]),
        }
        for r in rows
    ]


@api_router.get("/dashboard/team-workload")
async def dashboard_team_workload():
    rows = await fetch_all(
        """SELECT m.Id, m.Name, m.Role, m.Areas, m.Rules, m.CapacitySp, m.AvatarColor,
                  ISNULL(dev.items, 0) AS dev_items,
                  ISNULL(qa.items, 0) AS qa_items,
                  ISNULL(dev.assigned_sp, 0) AS assigned_sp,
                  ISNULL(dev.done_sp, 0) AS done_sp,
                  ISNULL(dev.in_progress, 0) AS in_progress
             FROM dbo.TeamMembers m
             LEFT JOIN (
                SELECT DevAssigneeId,
                       COUNT(*) AS items,
                       ISNULL(SUM(StoryPoints), 0) AS assigned_sp,
                       ISNULL(SUM(CASE WHEN [Status]='Done' THEN StoryPoints ELSE 0 END), 0) AS done_sp,
                       SUM(CASE WHEN [Status]='In Progress' THEN 1 ELSE 0 END) AS in_progress
                  FROM dbo.BacklogItems
                 WHERE DevAssigneeId IS NOT NULL
                 GROUP BY DevAssigneeId
             ) dev ON dev.DevAssigneeId = m.Id
             LEFT JOIN (
                SELECT QaAssigneeId, COUNT(*) AS items
                  FROM dbo.BacklogItems
                 WHERE QaAssigneeId IS NOT NULL
                 GROUP BY QaAssigneeId
             ) qa ON qa.QaAssigneeId = m.Id"""
    )
    results = []
    for r in rows:
        capacity = r["CapacitySp"] or 0
        assigned = r["assigned_sp"] or 0
        done = r["done_sp"] or 0
        results.append({
            "id": r["Id"],
            "name": r["Name"],
            "role": r["Role"],
            "areas": csv_split(r.get("Areas")),
            "rules": r.get("Rules"),
            "capacity_sp": capacity,
            "avatar_color": r.get("AvatarColor"),
            "dev_items": r["dev_items"] or 0,
            "qa_items": r["qa_items"] or 0,
            "assigned_sp": assigned,
            "done_sp": done,
            "in_progress": r["in_progress"] or 0,
            "completion_pct": round((done / assigned * 100) if assigned > 0 else 0, 1),
            "utilization_pct": round((assigned / capacity * 100) if capacity > 0 else 0, 1),
        })
    results.sort(key=lambda x: -x["assigned_sp"])
    return results


# =====================================================================
# Root
# =====================================================================
@api_router.get("/")
async def root():
    return {"message": "SOPRA PM API", "version": app.version}


@api_router.get("/health")
async def health():
    try:
        v = await ping()
        return {"ok": True, "db": v}
    except Exception as e:
        return {"ok": False, "error": str(e)}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def on_startup():
    try:
        v = await ping()
        logger.info(f"Connected to SQL Server: {v}")
    except Exception as e:
        logger.error(f"SQL Server connection failed: {e}")
