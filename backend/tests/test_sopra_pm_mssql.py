"""SOPRA PM backend tests — Microsoft SQL Server 2022 backend.

Covers: /api/health, team, sprints, projects (+summary, ON DELETE SET NULL),
backlog CRUD + filters + auto-activity, comments, activity delete,
backlog cascade delete, dashboard aggregates.

All test records use WB-TEST prefix and cleanup after themselves. Main dataset
must not be modified (36 seeded items, 7 projects).
"""
from __future__ import annotations

import os
from datetime import date

import pytest
import requests
from dotenv import load_dotenv

load_dotenv("/app/backend/.env")

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") \
    else "http://localhost:8001"
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def s() -> requests.Session:
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


# ---------------- health ----------------
def test_health_reports_sqlserver_2022(s):
    r = s.get(f"{API}/health", timeout=30)
    assert r.status_code == 200
    data = r.json()
    assert data["ok"] is True
    assert "SQL Server" in data["db"]
    assert "2022" in data["db"]


# ---------------- team ----------------
def test_team_list_returns_int_ids_and_areas_split(s):
    r = s.get(f"{API}/team")
    assert r.status_code == 200
    members = r.json()
    assert len(members) > 0
    for m in members:
        assert isinstance(m["id"], int)
        assert m["id"] >= 1
        assert isinstance(m["areas"], list)
    # At least someone with multi-area assignment
    multi = [m for m in members if len(m["areas"]) > 1]
    assert multi, "Expected at least one member with multiple areas"


def test_team_crud_areas_join_and_split(s):
    payload = {"name": "TEST_QA_Member", "role": "QA",
               "email": "test@sopra.io", "areas": ["Nexora", "Internal"],
               "capacity_sp": 15}
    r = s.post(f"{API}/team", json=payload)
    assert r.status_code == 200, r.text
    m = r.json()
    assert isinstance(m["id"], int)
    assert m["areas"] == ["Nexora", "Internal"]
    mid = m["id"]

    # PATCH
    r = s.patch(f"{API}/team/{mid}", json={"areas": ["Nexora"], "capacity_sp": 22})
    assert r.status_code == 200
    upd = r.json()
    assert upd["areas"] == ["Nexora"]
    assert upd["capacity_sp"] == 22

    # cleanup
    assert s.delete(f"{API}/team/{mid}").status_code == 200
    assert s.get(f"{API}/team/{mid}").status_code == 404


# ---------------- sprints ----------------
def test_sprints_list_ordered_by_sprint_number(s):
    r = s.get(f"{API}/sprints")
    assert r.status_code == 200
    sprints = r.json()
    assert len(sprints) >= 1
    nums = [x["sprint_number"] for x in sprints]
    assert nums == sorted(nums)


def test_sprints_filter_by_quarter(s):
    all_ = s.get(f"{API}/sprints").json()
    if not all_:
        pytest.skip("no sprints seeded")
    q = all_[0]["quarter"]
    r = s.get(f"{API}/sprints", params={"quarter": q})
    assert r.status_code == 200
    for sp in r.json():
        assert sp["quarter"] == q


# ---------------- projects ----------------
def test_seven_projects_seeded_with_expected_codes(s):
    r = s.get(f"{API}/projects")
    assert r.status_code == 200
    codes = {p["code"] for p in r.json()}
    assert {"SCE", "SCR", "HRS", "WMS", "BIM", "TMS", "INT"} <= codes


def test_sce_project_summary_phase_counts(s):
    projs = s.get(f"{API}/projects").json()
    sce = next(p for p in projs if p["code"] == "SCE")
    r = s.get(f"{API}/projects/{sce['id']}/summary")
    assert r.status_code == 200
    data = r.json()
    phases = {p["phase"]: p["items"] for p in data["phases"]}
    assert phases.get("Phase 1") == 1
    assert phases.get("Phase 2") == 2
    assert phases.get("Phase 3") == 3


def test_project_delete_sets_backlog_project_id_null(s):
    # Create throwaway project
    r = s.post(f"{API}/projects", json={"name": "TEST_ProjDelete", "code": "TDL", "system": "Internal"})
    assert r.status_code == 200
    pid = r.json()["id"]

    # Create throwaway backlog item linked to it
    r = s.post(f"{API}/backlog", json={
        "wb_ref": "WB-TESTDEL", "title": "TEST fk detach",
        "system": "Internal", "priority": "P3", "quarter": "Q1 2026",
        "project_id": pid, "story_points": 1,
    })
    assert r.status_code == 200, r.text
    bid = r.json()["id"]

    # Delete project — FK ON DELETE SET NULL should detach
    assert s.delete(f"{API}/projects/{pid}").status_code == 200

    r = s.get(f"{API}/backlog/{bid}")
    assert r.status_code == 200
    assert r.json()["project_id"] is None

    # cleanup
    s.delete(f"{API}/backlog/{bid}")


# ---------------- backlog ----------------
def test_backlog_36_items_seeded(s):
    r = s.get(f"{API}/backlog")
    assert r.status_code == 200
    assert len(r.json()) == 36


@pytest.mark.parametrize("filt", [
    {"priority": "P1"},
    {"system": "Nexora"},
    {"status": "Done"},
    {"quarter": "Q1 2026"},
    {"phase": "Phase 1"},
])
def test_backlog_filters(s, filt):
    r = s.get(f"{API}/backlog", params=filt)
    assert r.status_code == 200
    rows = r.json()
    key = list(filt.keys())[0]
    val = filt[key]
    for row in rows:
        assert row[key] == val


def test_backlog_patch_logs_activity_and_status_done_sets_percent(s):
    # Pick any Backlog item to twiddle (revert afterwards)
    all_items = s.get(f"{API}/backlog", params={"status": "Backlog"}).json()
    assert all_items, "no backlog items to test with"
    item = all_items[0]
    iid = item["id"]
    original = {k: item[k] for k in ("status", "priority", "percent_done", "actual_date")}

    # Ensure actor_id exists — pick first team member
    members = s.get(f"{API}/team").json()
    actor_id = members[0]["id"]

    # Snapshot activity count
    before_acts = s.get(f"{API}/backlog/{iid}/activity").json()

    # PATCH -> status=Done and priority change
    new_prio = "P1" if original["priority"] != "P1" else "P2"
    r = s.patch(f"{API}/backlog/{iid}",
                params={"actor_id": actor_id},
                json={"status": "Done", "priority": new_prio})
    assert r.status_code == 200, r.text
    upd = r.json()
    assert upd["status"] == "Done"
    assert upd["percent_done"] == 100
    assert upd["actual_date"] == date.today().isoformat()
    assert upd["priority"] == new_prio

    after_acts = s.get(f"{API}/backlog/{iid}/activity").json()
    # Should have added at least 2 change log rows (status + priority)
    added = [a for a in after_acts if a["kind"] == "change"]
    added_new = [a for a in added if a not in before_acts]
    assert len(added_new) >= 2
    kinds = {a["field"] for a in added_new}
    assert "status" in kinds and "priority" in kinds
    # newest-first
    ids = [a["id"] for a in after_acts]
    assert ids == sorted(ids, reverse=True)

    # Revert
    s.patch(f"{API}/backlog/{iid}",
            params={"actor_id": actor_id},
            json={"status": original["status"], "priority": original["priority"],
                  "percent_done": original["percent_done"],
                  "actual_date": original["actual_date"]})


def test_comment_post_get_delete_and_validation(s):
    items = s.get(f"{API}/backlog").json()
    iid = items[0]["id"]

    # empty text -> 400
    r = s.post(f"{API}/backlog/{iid}/comments", json={"text": "   "})
    assert r.status_code == 400

    # missing item -> 404
    r = s.post(f"{API}/backlog/999999/comments", json={"text": "hi"})
    assert r.status_code == 404

    # Valid
    r = s.post(f"{API}/backlog/{iid}/comments", json={"text": "TEST comment"})
    assert r.status_code == 200
    c = r.json()
    assert c["kind"] == "comment"
    assert c["text"] == "TEST comment"
    cid = c["id"]

    # delete activity — comment kind only
    r = s.delete(f"{API}/activity/{cid}")
    assert r.status_code == 200
    # second delete -> 404
    assert s.delete(f"{API}/activity/{cid}").status_code == 404


def test_delete_activity_rejects_change_rows(s):
    # find a change row on any item
    items = s.get(f"{API}/backlog").json()
    change_row = None
    for it in items:
        acts = s.get(f"{API}/backlog/{it['id']}/activity").json()
        for a in acts:
            if a["kind"] == "change":
                change_row = a
                break
        if change_row:
            break
    if not change_row:
        pytest.skip("no change activity rows to test with")
    r = s.delete(f"{API}/activity/{change_row['id']}")
    assert r.status_code == 404


def test_backlog_delete_cascades_activity(s):
    # create throwaway item + comment then delete
    r = s.post(f"{API}/backlog", json={
        "wb_ref": "WB-TESTCASCADE", "title": "TEST cascade",
        "system": "Internal", "priority": "P4", "quarter": "Q1 2026",
        "story_points": 1,
    })
    bid = r.json()["id"]
    s.post(f"{API}/backlog/{bid}/comments", json={"text": "TEST"})
    acts = s.get(f"{API}/backlog/{bid}/activity").json()
    assert len(acts) >= 1

    assert s.delete(f"{API}/backlog/{bid}").status_code == 200
    # item gone
    assert s.get(f"{API}/backlog/{bid}").status_code == 404
    # activity list for deleted item -> empty (rows cascaded out)
    acts_after = s.get(f"{API}/backlog/{bid}/activity").json()
    assert acts_after == []


# ---------------- dashboards ----------------
def test_dashboard_summary_totals(s):
    r = s.get(f"{API}/dashboard/summary")
    assert r.status_code == 200
    d = r.json()
    assert d["total_sp"] == 228
    assert d["done_sp"] == 16
    assert d["completion_pct"] == 7.0


def test_dashboard_quarterly_returns_4(s):
    r = s.get(f"{API}/dashboard/quarterly")
    assert r.status_code == 200
    assert len(r.json()) == 4


def test_dashboard_sprint_velocity_left_join_all_sprints(s):
    velocity = s.get(f"{API}/dashboard/sprint-velocity").json()
    sprints = s.get(f"{API}/sprints").json()
    assert len(velocity) == len(sprints)


def test_dashboard_team_workload_sorted_desc(s):
    r = s.get(f"{API}/dashboard/team-workload")
    assert r.status_code == 200
    rows = r.json()
    sps = [row["assigned_sp"] for row in rows]
    assert sps == sorted(sps, reverse=True)
