from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Annotated
import uuid
from datetime import datetime, timezone

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI(title="SOPRA PM API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# ====================== Models ======================
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class TeamMember(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    role: str  # Backend Dev, QA, Product Manager, Data Engineer, UI/UX
    email: Optional[str] = None
    areas: List[str] = Field(default_factory=list)  # systems they own
    rules: Optional[str] = None
    capacity_sp: int = 20  # sprint capacity in story points
    avatar_color: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)


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
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    sprint_number: int
    name: str  # e.g., "Sprint 1"
    quarter: str  # e.g., "Q3 2026"
    start_date: str
    end_date: str
    goal: Optional[str] = None
    status: str = "Planned"  # Planned, Active, Completed
    capacity_sp: int = 30
    created_at: str = Field(default_factory=now_iso)


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


class BacklogItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    wb_ref: str
    title: str
    system: str  # WMS, Ecommerce, HRIS, BIMA, Nexora, Internal, Security
    priority: str  # P1, P2, P3, P4
    quarter: str
    project_id: Optional[str] = None
    phase: Optional[str] = None  # e.g. "Phase 1", "Phase 2"
    sprint_id: Optional[str] = None
    dev_assignee_id: Optional[str] = None
    qa_assignee_id: Optional[str] = None
    story_points: int = 0
    target_date: Optional[str] = None
    actual_date: Optional[str] = None
    percent_done: int = 0
    status: str = "Backlog"  # Backlog, In Progress, In Review, Done
    notes: Optional[str] = None
    created_at: str = Field(default_factory=now_iso)
    updated_at: str = Field(default_factory=now_iso)


class BacklogItemCreate(BaseModel):
    wb_ref: str
    title: str
    system: str
    priority: str
    quarter: str
    project_id: Optional[str] = None
    phase: Optional[str] = None
    sprint_id: Optional[str] = None
    dev_assignee_id: Optional[str] = None
    qa_assignee_id: Optional[str] = None
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
    project_id: Optional[str] = None
    phase: Optional[str] = None
    sprint_id: Optional[str] = None
    dev_assignee_id: Optional[str] = None
    qa_assignee_id: Optional[str] = None
    story_points: Optional[int] = None
    target_date: Optional[str] = None
    actual_date: Optional[str] = None
    percent_done: Optional[int] = None
    status: Optional[str] = None
    notes: Optional[str] = None


class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    code: Optional[str] = None  # short code, e.g. "SCE"
    description: Optional[str] = None
    system: Optional[str] = None  # default system tag
    owner_id: Optional[str] = None  # team member id
    color: str = "#0033CC"
    status: str = "Active"  # Active, Paused, Completed, Archived
    created_at: str = Field(default_factory=now_iso)


class ProjectCreate(BaseModel):
    name: str
    code: Optional[str] = None
    description: Optional[str] = None
    system: Optional[str] = None
    owner_id: Optional[str] = None
    color: str = "#0033CC"
    status: str = "Active"


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    description: Optional[str] = None
    system: Optional[str] = None
    owner_id: Optional[str] = None
    color: Optional[str] = None
    status: Optional[str] = None


# ====================== Team Members ======================
@api_router.get("/team", response_model=List[TeamMember])
async def list_team():
    docs = await db.team_members.find({}, {"_id": 0}).to_list(1000)
    return [TeamMember(**d) for d in docs]


@api_router.post("/team", response_model=TeamMember)
async def create_team_member(data: TeamMemberCreate):
    member = TeamMember(**data.model_dump())
    await db.team_members.insert_one(member.model_dump())
    return member


@api_router.get("/team/{member_id}", response_model=TeamMember)
async def get_team_member(member_id: str):
    doc = await db.team_members.find_one({"id": member_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Team member not found")
    return TeamMember(**doc)


@api_router.patch("/team/{member_id}", response_model=TeamMember)
async def update_team_member(member_id: str, data: TeamMemberUpdate):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        doc = await db.team_members.find_one({"id": member_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Team member not found")
        return TeamMember(**doc)
    result = await db.team_members.find_one_and_update(
        {"id": member_id}, {"$set": update},
        return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Team member not found")
    return TeamMember(**result)


@api_router.delete("/team/{member_id}")
async def delete_team_member(member_id: str):
    result = await db.team_members.delete_one({"id": member_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Team member not found")
    return {"ok": True}


# ====================== Sprints ======================
@api_router.get("/sprints", response_model=List[Sprint])
async def list_sprints(quarter: Optional[str] = None):
    query = {}
    if quarter:
        query["quarter"] = quarter
    docs = await db.sprints.find(query, {"_id": 0}).sort("sprint_number", 1).to_list(1000)
    return [Sprint(**d) for d in docs]


@api_router.post("/sprints", response_model=Sprint)
async def create_sprint(data: SprintCreate):
    sprint = Sprint(**data.model_dump())
    await db.sprints.insert_one(sprint.model_dump())
    return sprint


@api_router.get("/sprints/{sprint_id}", response_model=Sprint)
async def get_sprint(sprint_id: str):
    doc = await db.sprints.find_one({"id": sprint_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return Sprint(**doc)


@api_router.patch("/sprints/{sprint_id}", response_model=Sprint)
async def update_sprint(sprint_id: str, data: SprintUpdate):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        doc = await db.sprints.find_one({"id": sprint_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Sprint not found")
        return Sprint(**doc)
    result = await db.sprints.find_one_and_update(
        {"id": sprint_id}, {"$set": update},
        return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return Sprint(**result)


@api_router.delete("/sprints/{sprint_id}")
async def delete_sprint(sprint_id: str):
    result = await db.sprints.delete_one({"id": sprint_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Sprint not found")
    return {"ok": True}


# ====================== Projects ======================
@api_router.get("/projects", response_model=List[Project])
async def list_projects():
    docs = await db.projects.find({}, {"_id": 0}).to_list(1000)
    return [Project(**d) for d in docs]


@api_router.post("/projects", response_model=Project)
async def create_project(data: ProjectCreate):
    project = Project(**data.model_dump())
    await db.projects.insert_one(project.model_dump())
    return project


@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str):
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**doc)


@api_router.patch("/projects/{project_id}", response_model=Project)
async def update_project(project_id: str, data: ProjectUpdate):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    if not update:
        doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
        if not doc:
            raise HTTPException(status_code=404, detail="Project not found")
        return Project(**doc)
    result = await db.projects.find_one_and_update(
        {"id": project_id}, {"$set": update},
        return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Project not found")
    return Project(**result)


@api_router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    result = await db.projects.delete_one({"id": project_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Project not found")
    # Detach project_id from backlog items
    await db.backlog.update_many({"project_id": project_id}, {"$set": {"project_id": None, "phase": None}})
    return {"ok": True}


@api_router.get("/projects/{project_id}/summary")
async def project_summary(project_id: str):
    doc = await db.projects.find_one({"id": project_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Project not found")
    items = await db.backlog.find({"project_id": project_id}, {"_id": 0}).to_list(2000)
    total_sp = sum(i.get("story_points", 0) for i in items)
    done_sp = sum(i.get("story_points", 0) for i in items if i.get("status") == "Done")
    # group by phase
    phases: dict = {}
    for i in items:
        ph = i.get("phase") or "Unphased"
        if ph not in phases:
            phases[ph] = {"phase": ph, "items": 0, "total_sp": 0, "done_sp": 0,
                          "in_progress": 0, "in_review": 0, "backlog": 0, "done": 0}
        phases[ph]["items"] += 1
        phases[ph]["total_sp"] += i.get("story_points", 0)
        st = i.get("status", "Backlog")
        if st == "Done":
            phases[ph]["done_sp"] += i.get("story_points", 0)
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
        "project": doc,
        "items": len(items),
        "total_sp": total_sp,
        "done_sp": done_sp,
        "completion_pct": round((done_sp / total_sp * 100) if total_sp > 0 else 0, 1),
        "phases": phase_list,
    }


# ====================== Backlog Items ======================
@api_router.get("/backlog", response_model=List[BacklogItem])
async def list_backlog(
    priority: Optional[str] = None,
    system: Optional[str] = None,
    quarter: Optional[str] = None,
    sprint_id: Optional[str] = None,
    status: Optional[str] = None,
    dev_assignee_id: Optional[str] = None,
    project_id: Optional[str] = None,
    phase: Optional[str] = None,
):
    query: dict = {}
    if priority:
        query["priority"] = priority
    if system:
        query["system"] = system
    if quarter:
        query["quarter"] = quarter
    if sprint_id:
        query["sprint_id"] = sprint_id
    if status:
        query["status"] = status
    if dev_assignee_id:
        query["dev_assignee_id"] = dev_assignee_id
    if project_id:
        query["project_id"] = project_id
    if phase:
        query["phase"] = phase
    docs = await db.backlog.find(query, {"_id": 0}).to_list(2000)
    return [BacklogItem(**d) for d in docs]


@api_router.post("/backlog", response_model=BacklogItem)
async def create_backlog(data: BacklogItemCreate):
    item = BacklogItem(**data.model_dump())
    await db.backlog.insert_one(item.model_dump())
    return item


@api_router.get("/backlog/{item_id}", response_model=BacklogItem)
async def get_backlog(item_id: str):
    doc = await db.backlog.find_one({"id": item_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Item not found")
    return BacklogItem(**doc)


@api_router.patch("/backlog/{item_id}", response_model=BacklogItem)
async def update_backlog(item_id: str, data: BacklogItemUpdate):
    update = {k: v for k, v in data.model_dump().items() if v is not None}
    update["updated_at"] = now_iso()
    # Auto sync percent_done when status changes to Done
    if update.get("status") == "Done" and "percent_done" not in update:
        update["percent_done"] = 100
        update["actual_date"] = update.get("actual_date") or now_iso()[:10]
    result = await db.backlog.find_one_and_update(
        {"id": item_id}, {"$set": update},
        return_document=True, projection={"_id": 0}
    )
    if not result:
        raise HTTPException(status_code=404, detail="Item not found")
    return BacklogItem(**result)


@api_router.delete("/backlog/{item_id}")
async def delete_backlog(item_id: str):
    result = await db.backlog.delete_one({"id": item_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"ok": True}


# ====================== Dashboard ======================
@api_router.get("/dashboard/summary")
async def dashboard_summary():
    items = await db.backlog.find({}, {"_id": 0}).to_list(5000)
    total_items = len(items)
    total_sp = sum(i.get("story_points", 0) for i in items)
    done_items = [i for i in items if i.get("status") == "Done"]
    done_sp = sum(i.get("story_points", 0) for i in done_items)
    in_progress = sum(1 for i in items if i.get("status") == "In Progress")
    in_review = sum(1 for i in items if i.get("status") == "In Review")
    backlog_count = sum(1 for i in items if i.get("status") == "Backlog")

    by_priority = {}
    for p in ["P1", "P2", "P3", "P4"]:
        bucket = [i for i in items if i.get("priority") == p]
        by_priority[p] = {
            "count": len(bucket),
            "sp": sum(i.get("story_points", 0) for i in bucket),
            "done_sp": sum(i.get("story_points", 0) for i in bucket if i.get("status") == "Done"),
        }

    by_system: dict = {}
    for i in items:
        sys = i.get("system", "Other")
        if sys not in by_system:
            by_system[sys] = {"count": 0, "sp": 0, "done_sp": 0}
        by_system[sys]["count"] += 1
        by_system[sys]["sp"] += i.get("story_points", 0)
        if i.get("status") == "Done":
            by_system[sys]["done_sp"] += i.get("story_points", 0)

    completion_pct = round((done_sp / total_sp * 100) if total_sp > 0 else 0, 1)

    return {
        "total_items": total_items,
        "total_sp": total_sp,
        "done_items": len(done_items),
        "done_sp": done_sp,
        "in_progress": in_progress,
        "in_review": in_review,
        "backlog": backlog_count,
        "completion_pct": completion_pct,
        "by_priority": by_priority,
        "by_system": by_system,
    }


@api_router.get("/dashboard/quarterly")
async def dashboard_quarterly():
    items = await db.backlog.find({}, {"_id": 0}).to_list(5000)
    buckets: dict = {}
    for i in items:
        q = i.get("quarter", "Unknown")
        if q not in buckets:
            buckets[q] = {"quarter": q, "total_sp": 0, "done_sp": 0, "items": 0, "done_items": 0}
        buckets[q]["total_sp"] += i.get("story_points", 0)
        buckets[q]["items"] += 1
        if i.get("status") == "Done":
            buckets[q]["done_sp"] += i.get("story_points", 0)
            buckets[q]["done_items"] += 1
    result = list(buckets.values())
    result.sort(key=lambda x: x["quarter"])
    for r in result:
        r["completion_pct"] = round((r["done_sp"] / r["total_sp"] * 100) if r["total_sp"] > 0 else 0, 1)
    return result


@api_router.get("/dashboard/sprint-velocity")
async def dashboard_sprint_velocity():
    sprints = await db.sprints.find({}, {"_id": 0}).sort("sprint_number", 1).to_list(1000)
    items = await db.backlog.find({}, {"_id": 0}).to_list(5000)
    results = []
    for s in sprints:
        sp_items = [i for i in items if i.get("sprint_id") == s["id"]]
        planned = sum(i.get("story_points", 0) for i in sp_items)
        completed = sum(i.get("story_points", 0) for i in sp_items if i.get("status") == "Done")
        results.append({
            "sprint_id": s["id"],
            "name": s["name"],
            "quarter": s["quarter"],
            "planned_sp": planned,
            "completed_sp": completed,
            "items": len(sp_items),
            "status": s.get("status", "Planned"),
            "capacity_sp": s.get("capacity_sp", 30),
            "start_date": s.get("start_date"),
            "end_date": s.get("end_date"),
        })
    return results


@api_router.get("/dashboard/team-workload")
async def dashboard_team_workload():
    members = await db.team_members.find({}, {"_id": 0}).to_list(1000)
    items = await db.backlog.find({}, {"_id": 0}).to_list(5000)
    results = []
    for m in members:
        dev_items = [i for i in items if i.get("dev_assignee_id") == m["id"]]
        qa_items = [i for i in items if i.get("qa_assignee_id") == m["id"]]
        assigned_sp = sum(i.get("story_points", 0) for i in dev_items)
        done_sp = sum(i.get("story_points", 0) for i in dev_items if i.get("status") == "Done")
        in_progress = sum(1 for i in dev_items if i.get("status") == "In Progress")
        results.append({
            "id": m["id"],
            "name": m["name"],
            "role": m.get("role"),
            "areas": m.get("areas", []),
            "rules": m.get("rules"),
            "capacity_sp": m.get("capacity_sp", 20),
            "avatar_color": m.get("avatar_color"),
            "dev_items": len(dev_items),
            "qa_items": len(qa_items),
            "assigned_sp": assigned_sp,
            "done_sp": done_sp,
            "in_progress": in_progress,
            "completion_pct": round((done_sp / assigned_sp * 100) if assigned_sp > 0 else 0, 1),
            "utilization_pct": round((assigned_sp / m.get("capacity_sp", 20) * 100) if m.get("capacity_sp", 20) > 0 else 0, 1),
        })
    results.sort(key=lambda r: -r["assigned_sp"])
    return results


# ====================== Seed ======================
SEED_PROJECTS = [
    {"name": "Sopra Cash Engine", "code": "SCE", "system": "Nexora",
     "description": "Phase 1: Migrasi forecast dari Excel. Phase 2: Realisasi bank dari mutasi bank. Phase 3: Integrasi realisasi ke SAP (konsolidasi).",
     "color": "#4338CA", "status": "Active", "owner": "Nathan"},
    {"name": "Sopra Commerce Revamp", "code": "SCR", "system": "Ecommerce",
     "description": "Revamp ecommerce — Catalog & frontend modernization, payment flows, vendor portal.",
     "color": "#854D0E", "status": "Active", "owner": "Okhy"},
    {"name": "HRIS SOPRA", "code": "HRS", "system": "HRIS",
     "description": "End-to-end HR Information System: core, employee dashboard, attendance device integrations.",
     "color": "#047857", "status": "Active", "owner": "Abhi"},
    {"name": "WMS Modernization", "code": "WMS", "system": "WMS",
     "description": "Warehouse Management — rework, sister-company multi-entity, stok health RFID, DI champions.",
     "color": "#0369A1", "status": "Active", "owner": "Andre"},
    {"name": "BIMA Suite", "code": "BIM", "system": "BIMA",
     "description": "Sales activation: PPC+NPD, interactive sales, dealer reminders, sales-purch collaboration.",
     "color": "#BE185D", "status": "Active", "owner": "Nadir"},
    {"name": "TMS Delivery", "code": "TMS", "system": "Ecommerce",
     "description": "Transport Management — Proof of Delivery, shipping value added, logistics queue.",
     "color": "#B91C1C", "status": "Active", "owner": "Nadir"},
    {"name": "Internal Platforms", "code": "INT", "system": "Internal",
     "description": "Internal tooling: KPI dashboard, audit, e-sign, search engine, podcast.",
     "color": "#374151", "status": "Active", "owner": "Finta"},
]

SEED_TEAM = [
    {"name": "Nathan", "role": "Product Manager", "areas": ["Nexora", "Internal"],
     "rules": "SAP Integration & Nexora Cash Engine ONLY", "capacity_sp": 20, "avatar_color": "#0033CC"},
    {"name": "Nando", "role": "Product Manager", "areas": ["Internal"],
     "rules": "Sopra CAM (shared with Nathan)", "capacity_sp": 18, "avatar_color": "#7C3AED"},
    {"name": "Andre", "role": "Backend Dev", "areas": ["WMS", "BIMA", "Internal"],
     "rules": "WMS majority, EIL Audit, BIMA", "capacity_sp": 26, "avatar_color": "#0369A1"},
    {"name": "Abhi", "role": "Backend Dev", "areas": ["Ecommerce", "HRIS"],
     "rules": "Ecommerce general, HRIS, picks up Okhy overflow", "capacity_sp": 30, "avatar_color": "#047857"},
    {"name": "Nadir", "role": "Backend Dev", "areas": ["Ecommerce", "WMS", "BIMA", "Nexora", "Security"],
     "rules": "TMS primary, WMS support, BIMA, Nexora", "capacity_sp": 26, "avatar_color": "#B91C1C"},
    {"name": "Okhy", "role": "Backend Dev", "areas": ["Ecommerce"],
     "rules": "ONLY Revamp Ecommerce (Catalog & frontend)", "capacity_sp": 18, "avatar_color": "#D97706"},
    {"name": "Ignas", "role": "Backend Dev", "areas": ["WMS", "Ecommerce", "HRIS"],
     "rules": "ONLY Handheld devices (RFID, QR Scanner, Fingerspot)", "capacity_sp": 16, "avatar_color": "#BE185D"},
    {"name": "Finta", "role": "QA", "areas": ["All"], "rules": "QA across all projects", "capacity_sp": 24, "avatar_color": "#4338CA"},
    {"name": "Michael", "role": "QA", "areas": ["All"], "rules": "QA across all projects", "capacity_sp": 24, "avatar_color": "#854D0E"},
    {"name": "Nadia", "role": "Data Engineer", "areas": ["Internal"], "rules": "Data pipelines & analytics", "capacity_sp": 18, "avatar_color": "#0F766E"},
    {"name": "Fitri", "role": "Data Engineer", "areas": ["Internal"], "rules": "Data pipelines & analytics", "capacity_sp": 18, "avatar_color": "#9333EA"},
    {"name": "Finley", "role": "Data Engineer", "areas": ["Internal"], "rules": "Data pipelines & analytics", "capacity_sp": 18, "avatar_color": "#0891B2"},
    {"name": "Mukaram", "role": "UI/UX", "areas": ["All"], "rules": "Design for all systems", "capacity_sp": 20, "avatar_color": "#DC2626"},
]

SEED_SPRINTS = [
    {"sprint_number": 1, "name": "Sprint 1", "quarter": "Q3 2026", "start_date": "2026-07-07", "end_date": "2026-07-20", "goal": "KPI Dashboard, HRIS SOPRA, Rework WMS, Ekspedisi Queue", "status": "Active", "capacity_sp": 30},
    {"sprint_number": 2, "name": "Sprint 2", "quarter": "Q3 2026", "start_date": "2026-07-21", "end_date": "2026-08-03", "goal": "Payment Gateway BCA, Nexora Transfer Token, TOTP 2FA", "status": "Planned", "capacity_sp": 28},
    {"sprint_number": 3, "name": "Sprint 3", "quarter": "Q3 2026", "start_date": "2026-08-04", "end_date": "2026-08-17", "goal": "RFD Ecommerce, BIMA Interaktif, Trasmi Dashboard", "status": "Planned", "capacity_sp": 28},
    {"sprint_number": 4, "name": "Sprint 4", "quarter": "Q3 2026", "start_date": "2026-08-18", "end_date": "2026-08-31", "goal": "BIMA PPC+NPD, HRIS Employee Dashboard, EIL Audit, TMS POD", "status": "Planned", "capacity_sp": 28},
    {"sprint_number": 5, "name": "Sprint 5", "quarter": "Q3 2026", "start_date": "2026-09-01", "end_date": "2026-09-14", "goal": "Dashboard Ecom + Support, Stok Health RFID", "status": "Planned", "capacity_sp": 24},
    {"sprint_number": 6, "name": "Sprint 6", "quarter": "Q3 2026", "start_date": "2026-09-15", "end_date": "2026-09-28", "goal": "Q3 Buffer / Hardening", "status": "Planned", "capacity_sp": 18},
    {"sprint_number": 7, "name": "Sprint 7", "quarter": "Q4 2026", "start_date": "2026-10-06", "end_date": "2026-10-19", "goal": "Nexora SAP, Nexora Integration, WMS Sister Company", "status": "Planned", "capacity_sp": 26},
    {"sprint_number": 8, "name": "Sprint 8", "quarter": "Q4 2026", "start_date": "2026-10-20", "end_date": "2026-11-02", "goal": "Revamp Catalog, PO-DPR Nagora SAP, Nexora Approval Credit", "status": "Planned", "capacity_sp": 26},
    {"sprint_number": 9, "name": "Sprint 9", "quarter": "Q4 2026", "start_date": "2026-11-03", "end_date": "2026-11-16", "goal": "Nexora ONE Approval HET", "status": "Planned", "capacity_sp": 18},
    {"sprint_number": 10, "name": "Sprint 10", "quarter": "Q4 2026", "start_date": "2026-11-17", "end_date": "2026-11-30", "goal": "Q4 Buffer", "status": "Planned", "capacity_sp": 16},
    {"sprint_number": 11, "name": "Sprint 11", "quarter": "Q4 2026", "start_date": "2026-12-01", "end_date": "2026-12-14", "goal": "Q4 Stabilization", "status": "Planned", "capacity_sp": 16},
    {"sprint_number": 12, "name": "Sprint 12", "quarter": "Q4 2026", "start_date": "2026-12-15", "end_date": "2026-12-28", "goal": "Year-end Release Candidate", "status": "Planned", "capacity_sp": 12},
    {"sprint_number": 13, "name": "Sprint 13", "quarter": "Q1 2027", "start_date": "2027-01-05", "end_date": "2027-01-18", "goal": "DI Champions WMS, Portal External Vendor, Esign E-Materai", "status": "Planned", "capacity_sp": 24},
    {"sprint_number": 14, "name": "Sprint 14", "quarter": "Q1 2027", "start_date": "2027-01-19", "end_date": "2027-02-01", "goal": "BIMA Colab Sales & Purch, Absen Registrasi Fingerspot", "status": "Planned", "capacity_sp": 22},
    {"sprint_number": 15, "name": "Sprint 15", "quarter": "Q1 2027", "start_date": "2027-02-02", "end_date": "2027-02-15", "goal": "Nexora Commerce, Nexora Assurance", "status": "Planned", "capacity_sp": 22},
    {"sprint_number": 16, "name": "Sprint 16", "quarter": "Q1 2027", "start_date": "2027-02-16", "end_date": "2027-03-01", "goal": "Search Engine Rufi's, BIMA Dealer Active Reminder", "status": "Planned", "capacity_sp": 20},
    {"sprint_number": 17, "name": "Sprint 17", "quarter": "Q1 2027", "start_date": "2027-03-02", "end_date": "2027-03-15", "goal": "VAS Value Added Shipping, LIO Listen Identity", "status": "Planned", "capacity_sp": 20},
    {"sprint_number": 18, "name": "Sprint 18", "quarter": "Q1 2027", "start_date": "2027-03-16", "end_date": "2027-03-29", "goal": "Q1 Buffer", "status": "Planned", "capacity_sp": 14},
    {"sprint_number": 19, "name": "Sprint 19", "quarter": "Q2 2027", "start_date": "2027-04-06", "end_date": "2027-04-19", "goal": "Podcast System", "status": "Planned", "capacity_sp": 10},
]

SEED_BACKLOG = [
    # Q3 2026 - Sprint 1 (P1)
    {"wb_ref": "WB-01", "title": "KPI Dashboard", "system": "Internal", "priority": "P1", "quarter": "Q3 2026", "sprint_num": 1, "dev": "Finta", "qa": None, "sp": 8, "notes": "Owner Finta (delivery dashboard)", "project": "INT", "phase": "Phase 1"},
    {"wb_ref": "WB-02", "title": "HRIS SOPRA", "system": "HRIS", "priority": "P1", "quarter": "Q3 2026", "sprint_num": 1, "dev": "Abhi", "qa": "Finta", "sp": 8, "notes": "Core HRIS for SOPRA", "project": "HRS", "phase": "Phase 1"},
    {"wb_ref": "WB-04", "title": "Rework WMS", "system": "WMS", "priority": "P1", "quarter": "Q3 2026", "sprint_num": 1, "dev": "Andre", "qa": "Michael", "sp": 8, "notes": "WMS rework primary", "project": "WMS", "phase": "Phase 1"},
    {"wb_ref": "WB-05", "title": "Ekspedisi Queue", "system": "Ecommerce", "priority": "P1", "quarter": "Q3 2026", "sprint_num": 1, "dev": "Abhi", "qa": "Finta", "sp": 6, "notes": "Okhy → hanya Revamp; re-assign ke Abhi", "project": "TMS", "phase": "Phase 1"},
    # Sprint 2 (P1)
    {"wb_ref": "WB-11", "title": "Payment Gateway BCA", "system": "Ecommerce", "priority": "P1", "quarter": "Q3 2026", "sprint_num": 2, "dev": "Abhi", "qa": "Michael", "sp": 8, "notes": "BCA PG integration", "project": "SCR", "phase": "Phase 1"},
    {"wb_ref": "WB-20", "title": "Nexora Approval – Transfer Token", "system": "Nexora", "priority": "P1", "quarter": "Q3 2026", "sprint_num": 2, "dev": "Nathan", "qa": "Finta", "sp": 8, "notes": "Cash Engine → Nathan", "project": "SCE", "phase": "Phase 1"},
    {"wb_ref": "WB-23", "title": "TOTP (2FA)", "system": "Security", "priority": "P1", "quarter": "Q3 2026", "sprint_num": 2, "dev": "Nadir", "qa": "Michael", "sp": 6, "notes": "Two-factor auth", "project": None, "phase": None},
    # Sprint 3 (P2)
    {"wb_ref": "WB-06", "title": "Trasmi Dashboard", "system": "Internal", "priority": "P2", "quarter": "Q3 2026", "sprint_num": 3, "dev": None, "qa": None, "sp": 6, "notes": "Pending assignment", "project": "INT", "phase": "Phase 2"},
    {"wb_ref": "WB-12", "title": "RFD Ecommerce", "system": "Ecommerce", "priority": "P2", "quarter": "Q3 2026", "sprint_num": 3, "dev": "Abhi", "qa": "Finta", "sp": 6, "notes": "Okhy → hanya Revamp; re-assign ke Abhi", "project": "SCR", "phase": "Phase 1"},
    {"wb_ref": "WB-13", "title": "Dashboard & Notif Ecom (Mobile)", "system": "Ecommerce", "priority": "P2", "quarter": "Q3 2026", "sprint_num": 3, "dev": "Abhi", "qa": "Michael", "sp": 6, "notes": "Mobile ecom UX", "project": "SCR", "phase": "Phase 1"},
    {"wb_ref": "WB-16", "title": "BIMA Interaktif (Sales)", "system": "BIMA", "priority": "P2", "quarter": "Q3 2026", "sprint_num": 3, "dev": "Nadir", "qa": "Finta", "sp": 6, "notes": "Sales interactive", "project": "BIM", "phase": "Phase 1"},
    # Sprint 4 (P2)
    {"wb_ref": "WB-19", "title": "BIMA PPC + NPD", "system": "BIMA", "priority": "P2", "quarter": "Q3 2026", "sprint_num": 4, "dev": "Andre", "qa": "Michael", "sp": 6, "notes": "PPC & NPD module", "project": "BIM", "phase": "Phase 1"},
    {"wb_ref": "WB-34", "title": "HRIS Employee Dashboard", "system": "HRIS", "priority": "P2", "quarter": "Q3 2026", "sprint_num": 4, "dev": "Abhi", "qa": "Finta", "sp": 6, "notes": "Employee self-service", "project": "HRS", "phase": "Phase 2"},
    {"wb_ref": "WB-39", "title": "EIL Audit", "system": "Internal", "priority": "P2", "quarter": "Q3 2026", "sprint_num": 4, "dev": "Andre", "qa": "Michael", "sp": 6, "notes": "Audit module", "project": "INT", "phase": "Phase 2"},
    {"wb_ref": "WB-43", "title": "TMS – Proof of Delivery", "system": "Ecommerce", "priority": "P2", "quarter": "Q3 2026", "sprint_num": 4, "dev": "Nadir", "qa": "Finta", "sp": 6, "notes": "Nadir (TMS); QR handheld → Ignas", "project": "TMS", "phase": "Phase 2"},
    # Sprint 5 (P2)
    {"wb_ref": "WB-48", "title": "Dashboard Ecom (NEW) + Support", "system": "Ecommerce", "priority": "P2", "quarter": "Q3 2026", "sprint_num": 5, "dev": "Abhi", "qa": "Michael", "sp": 6, "notes": "New ecom dashboard", "project": "SCR", "phase": "Phase 2"},
    {"wb_ref": "WB-15", "title": "Stok Health RFID", "system": "WMS", "priority": "P2", "quarter": "Q3 2026", "sprint_num": 5, "dev": "Ignas", "qa": "Finta", "sp": 6, "notes": "Handheld RFID → Ignas", "project": "WMS", "phase": "Phase 2"},
    # Q4 2026 - Sprint 7
    {"wb_ref": "WB-21", "title": "Nexora Approval – Dokumen SAP", "system": "Nexora", "priority": "P2", "quarter": "Q4 2026", "sprint_num": 7, "dev": "Nathan", "qa": "Michael", "sp": 8, "notes": "SAP Integration → Nathan", "project": "SCE", "phase": "Phase 3"},
    {"wb_ref": "WB-22", "title": "Nexora Approval – Integration", "system": "Nexora", "priority": "P2", "quarter": "Q4 2026", "sprint_num": 7, "dev": "Nadir", "qa": "Finta", "sp": 6, "notes": "Integration layer", "project": "SCE", "phase": "Phase 3"},
    {"wb_ref": "WB-24", "title": "WMS Sister Company", "system": "WMS", "priority": "P2", "quarter": "Q4 2026", "sprint_num": 7, "dev": "Andre", "qa": "Michael", "sp": 6, "notes": "Multi-entity WMS", "project": "WMS", "phase": "Phase 3"},
    # Sprint 8
    {"wb_ref": "WB-25", "title": "Revamp Catalog", "system": "Ecommerce", "priority": "P2", "quarter": "Q4 2026", "sprint_num": 8, "dev": "Okhy", "qa": "Finta", "sp": 8, "notes": "Okhy fokus revamp ecommerce", "project": "SCR", "phase": "Phase 2"},
    {"wb_ref": "WB-38", "title": "Integrasi PO – DPR Nagora SAP", "system": "Nexora", "priority": "P2", "quarter": "Q4 2026", "sprint_num": 8, "dev": "Nathan", "qa": "Michael", "sp": 6, "notes": "SAP Integration → Nathan", "project": "SCE", "phase": "Phase 3"},
    {"wb_ref": "WB-45", "title": "Nexora ONE – Approval Credit", "system": "Nexora", "priority": "P2", "quarter": "Q4 2026", "sprint_num": 8, "dev": "Nathan", "qa": "Finta", "sp": 5, "notes": "Cash Engine → Nathan", "project": "SCE", "phase": "Phase 2"},
    # Sprint 9
    {"wb_ref": "WB-46", "title": "Nexora ONE – Approval HET", "system": "Nexora", "priority": "P2", "quarter": "Q4 2026", "sprint_num": 9, "dev": "Nathan", "qa": "Michael", "sp": 8, "notes": "Cash Engine → Nathan", "project": "SCE", "phase": "Phase 2"},
    # Q1 2027 - Sprint 13
    {"wb_ref": "WB-18", "title": "DI Champions (WMS)", "system": "WMS", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 13, "dev": "Andre", "qa": "Finta", "sp": 6, "notes": "Continuous improvement", "project": "WMS", "phase": "Phase 4"},
    {"wb_ref": "WB-32", "title": "Portal External Vendor", "system": "Ecommerce", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 13, "dev": "Abhi", "qa": "Michael", "sp": 6, "notes": "Okhy → hanya Revamp; re-assign ke Abhi", "project": "SCR", "phase": "Phase 3"},
    {"wb_ref": "WB-33", "title": "Esign E-Materai & Eloktur", "system": "Internal", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 13, "dev": None, "qa": "Finta", "sp": 6, "notes": "Pending dev assignment", "project": "INT", "phase": "Phase 3"},
    # Sprint 14
    {"wb_ref": "WB-35", "title": "BIMA – Colab Sales & Purch", "system": "BIMA", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 14, "dev": "Abhi", "qa": "Michael", "sp": 6, "notes": "Collaboration sales & purch", "project": "BIM", "phase": "Phase 2"},
    {"wb_ref": "WB-36", "title": "Absen Registrasi (Fingerspot)", "system": "HRIS", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 14, "dev": "Ignas", "qa": "Finta", "sp": 6, "notes": "Device integration → Ignas", "project": "HRS", "phase": "Phase 3"},
    # Sprint 15
    {"wb_ref": "WB-40", "title": "Nexora Commerce", "system": "Nexora", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 15, "dev": "Nadir", "qa": "Michael", "sp": 6, "notes": "Commerce extension", "project": None, "phase": None},
    {"wb_ref": "WB-41", "title": "Nexora Assurance", "system": "Nexora", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 15, "dev": "Nadir", "qa": "Finta", "sp": 6, "notes": "Assurance module", "project": None, "phase": None},
    # Sprint 16
    {"wb_ref": "WB-42", "title": "Search Engine Rufi's", "system": "Internal", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 16, "dev": None, "qa": "Michael", "sp": 6, "notes": "Pending dev assignment", "project": "INT", "phase": "Phase 4"},
    {"wb_ref": "WB-44", "title": "BIMA – Dealer Active Reminder", "system": "BIMA", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 16, "dev": "Nadir", "qa": "Finta", "sp": 6, "notes": "Okhy → hanya Revamp; re-assign ke Nadir", "project": "BIM", "phase": "Phase 3"},
    # Sprint 17
    {"wb_ref": "WB-47", "title": "VAS – Value Added Shipping", "system": "Ecommerce", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 17, "dev": "Abhi", "qa": "Michael", "sp": 6, "notes": "Okhy → hanya Revamp; re-assign ke Abhi", "project": "TMS", "phase": "Phase 3"},
    {"wb_ref": "WB-49", "title": "LIO – Listen Identity Ordament", "system": "Ecommerce", "priority": "P3", "quarter": "Q1 2027", "sprint_num": 17, "dev": "Abhi", "qa": "Finta", "sp": 6, "notes": "Identity service", "project": "SCR", "phase": "Phase 3"},
    # Q2 2027 - Sprint 19
    {"wb_ref": "WB-37", "title": "Podcast System", "system": "Internal", "priority": "P4", "quarter": "Q2 2027", "sprint_num": 19, "dev": None, "qa": None, "sp": 3, "notes": "Internal podcast platform", "project": "INT", "phase": "Phase 4"},
]


@api_router.post("/seed")
async def seed_data(reset: bool = Query(False)):
    if reset:
        await db.team_members.delete_many({})
        await db.sprints.delete_many({})
        await db.backlog.delete_many({})
        await db.projects.delete_many({})

    # Check existing
    existing_team = await db.team_members.count_documents({})
    existing_sprints = await db.sprints.count_documents({})
    existing_backlog = await db.backlog.count_documents({})
    existing_projects = await db.projects.count_documents({})
    if existing_team and existing_sprints and existing_backlog and existing_projects and not reset:
        return {"ok": True, "message": "Already seeded", "team": existing_team, "sprints": existing_sprints, "backlog": existing_backlog, "projects": existing_projects}

    # Team
    name_to_id = {}
    if existing_team == 0 or reset:
        team_docs = []
        for m in SEED_TEAM:
            tm = TeamMember(**m)
            team_docs.append(tm.model_dump())
            name_to_id[m["name"]] = tm.id
        await db.team_members.insert_many(team_docs)
    else:
        for d in await db.team_members.find({}, {"_id": 0}).to_list(1000):
            name_to_id[d["name"]] = d["id"]

    # Projects
    code_to_project_id = {}
    if existing_projects == 0 or reset:
        project_docs = []
        for p in SEED_PROJECTS:
            owner_name = p.pop("owner", None)
            proj = Project(
                **p,
                owner_id=name_to_id.get(owner_name) if owner_name else None,
            )
            project_docs.append(proj.model_dump())
            code_to_project_id[p["code"]] = proj.id
        await db.projects.insert_many(project_docs)
    else:
        for d in await db.projects.find({}, {"_id": 0}).to_list(1000):
            if d.get("code"):
                code_to_project_id[d["code"]] = d["id"]

    # Sprints
    sprint_num_to_id = {}
    if existing_sprints == 0 or reset:
        sprint_docs = []
        for s in SEED_SPRINTS:
            sp = Sprint(**s)
            sprint_docs.append(sp.model_dump())
            sprint_num_to_id[s["sprint_number"]] = sp.id
        await db.sprints.insert_many(sprint_docs)
    else:
        for d in await db.sprints.find({}, {"_id": 0}).to_list(1000):
            sprint_num_to_id[d["sprint_number"]] = d["id"]

    # Backlog
    if existing_backlog == 0 or reset:
        # Distribute statuses for a more meaningful demo state
        demo_statuses = {
            "WB-01": ("Done", 100),
            "WB-02": ("Done", 100),
            "WB-04": ("In Review", 80),
            "WB-05": ("In Progress", 60),
            "WB-11": ("In Progress", 40),
            "WB-20": ("In Progress", 30),
            "WB-23": ("In Review", 70),
        }
        backlog_docs = []
        for b in SEED_BACKLOG:
            status, pct = demo_statuses.get(b["wb_ref"], ("Backlog", 0))
            item = BacklogItem(
                wb_ref=b["wb_ref"],
                title=b["title"],
                system=b["system"],
                priority=b["priority"],
                quarter=b["quarter"],
                project_id=code_to_project_id.get(b.get("project")) if b.get("project") else None,
                phase=b.get("phase"),
                sprint_id=sprint_num_to_id.get(b["sprint_num"]),
                dev_assignee_id=name_to_id.get(b["dev"]) if b.get("dev") else None,
                qa_assignee_id=name_to_id.get(b["qa"]) if b.get("qa") else None,
                story_points=b.get("sp", 0),
                notes=b.get("notes"),
                status=status,
                percent_done=pct,
                actual_date="2026-07-15" if status == "Done" else None,
            )
            backlog_docs.append(item.model_dump())
        await db.backlog.insert_many(backlog_docs)

    return {"ok": True, "message": "Seeded", "team": len(SEED_TEAM), "sprints": len(SEED_SPRINTS), "backlog": len(SEED_BACKLOG), "projects": len(SEED_PROJECTS)}


@api_router.get("/")
async def root():
    return {"message": "SOPRA PM API", "version": "1.0"}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
async def auto_seed():
    """Auto-seed on first startup if collections are empty."""
    try:
        if await db.team_members.count_documents({}) == 0:
            await seed_data(reset=False)
            logger.info("Auto-seeded initial data")
    except Exception as e:
        logger.error(f"Auto-seed failed: {e}")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
