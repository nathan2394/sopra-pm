"""Backend tests for SOPRA PM API - covers Team, Sprints, Backlog, Dashboard endpoints."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


# ====================== Health & Seed ======================
class TestHealthAndSeed:
    def test_root(self, client):
        r = client.get(f"{API}/")
        assert r.status_code == 200
        data = r.json()
        assert data.get("message") == "SOPRA PM API"
        assert "version" in data

    def test_seed_counts(self, client):
        r_team = client.get(f"{API}/team")
        r_sprints = client.get(f"{API}/sprints")
        r_backlog = client.get(f"{API}/backlog")
        assert r_team.status_code == 200
        assert r_sprints.status_code == 200
        assert r_backlog.status_code == 200
        assert len(r_team.json()) >= 13, f"team count={len(r_team.json())}"
        assert len(r_sprints.json()) >= 19, f"sprints count={len(r_sprints.json())}"
        assert len(r_backlog.json()) >= 36, f"backlog count={len(r_backlog.json())}"


# ====================== Team CRUD ======================
class TestTeam:
    created_id = None

    def test_create_team(self, client):
        payload = {"name": "TEST_Member", "role": "Backend Dev", "areas": ["WMS"], "capacity_sp": 25}
        r = client.post(f"{API}/team", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["name"] == "TEST_Member"
        assert data["role"] == "Backend Dev"
        assert "id" in data
        TestTeam.created_id = data["id"]

    def test_get_team(self, client):
        assert TestTeam.created_id
        r = client.get(f"{API}/team/{TestTeam.created_id}")
        assert r.status_code == 200
        assert r.json()["name"] == "TEST_Member"

    def test_update_team(self, client):
        r = client.patch(f"{API}/team/{TestTeam.created_id}", json={"role": "QA"})
        assert r.status_code == 200
        assert r.json()["role"] == "QA"
        # verify
        g = client.get(f"{API}/team/{TestTeam.created_id}")
        assert g.json()["role"] == "QA"

    def test_delete_team(self, client):
        r = client.delete(f"{API}/team/{TestTeam.created_id}")
        assert r.status_code == 200
        g = client.get(f"{API}/team/{TestTeam.created_id}")
        assert g.status_code == 404


# ====================== Sprint CRUD + filter ======================
class TestSprints:
    created_id = None

    def test_list_filter_quarter(self, client):
        r = client.get(f"{API}/sprints", params={"quarter": "Q3 2026"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        assert all(s["quarter"] == "Q3 2026" for s in items)

    def test_create_sprint(self, client):
        payload = {"sprint_number": 999, "name": "TEST_Sprint", "quarter": "Q9 9999",
                   "start_date": "2099-01-01", "end_date": "2099-01-14", "capacity_sp": 10}
        r = client.post(f"{API}/sprints", json=payload)
        assert r.status_code == 200
        TestSprints.created_id = r.json()["id"]

    def test_update_sprint(self, client):
        r = client.patch(f"{API}/sprints/{TestSprints.created_id}", json={"status": "Active"})
        assert r.status_code == 200
        assert r.json()["status"] == "Active"

    def test_delete_sprint(self, client):
        r = client.delete(f"{API}/sprints/{TestSprints.created_id}")
        assert r.status_code == 200


# ====================== Backlog CRUD + filters + auto-sync ======================
class TestBacklog:
    created_id = None

    def test_filter_priority(self, client):
        r = client.get(f"{API}/backlog", params={"priority": "P1"})
        assert r.status_code == 200
        items = r.json()
        assert all(i["priority"] == "P1" for i in items)
        assert len(items) >= 1

    def test_filter_system(self, client):
        r = client.get(f"{API}/backlog", params={"system": "WMS"})
        assert r.status_code == 200
        assert all(i["system"] == "WMS" for i in r.json())

    def test_filter_quarter_status(self, client):
        r = client.get(f"{API}/backlog", params={"quarter": "Q3 2026", "status": "Done"})
        assert r.status_code == 200
        for i in r.json():
            assert i["quarter"] == "Q3 2026"
            assert i["status"] == "Done"

    def test_create_backlog(self, client):
        payload = {"wb_ref": "TEST-001", "title": "TEST item", "system": "WMS",
                   "priority": "P3", "quarter": "Q3 2026", "story_points": 5}
        r = client.post(f"{API}/backlog", json=payload)
        assert r.status_code == 200
        data = r.json()
        assert data["wb_ref"] == "TEST-001"
        assert data["status"] == "Backlog"
        TestBacklog.created_id = data["id"]

    def test_status_done_autosync(self, client):
        """When status changes to Done, percent_done should be 100 and actual_date set."""
        r = client.patch(f"{API}/backlog/{TestBacklog.created_id}", json={"status": "Done"})
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "Done"
        assert data["percent_done"] == 100
        assert data["actual_date"] is not None

    def test_delete_backlog(self, client):
        r = client.delete(f"{API}/backlog/{TestBacklog.created_id}")
        assert r.status_code == 200
        g = client.get(f"{API}/backlog/{TestBacklog.created_id}")
        assert g.status_code == 404


# ====================== Dashboard endpoints ======================
class TestDashboard:
    def test_summary(self, client):
        r = client.get(f"{API}/dashboard/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ["total_items", "total_sp", "done_items", "done_sp",
                  "in_progress", "in_review", "backlog", "completion_pct",
                  "by_priority", "by_system"]:
            assert k in d, f"missing {k}"
        for p in ["P1", "P2", "P3", "P4"]:
            assert p in d["by_priority"]
        assert d["total_sp"] > 0

    def test_quarterly_sorted(self, client):
        r = client.get(f"{API}/dashboard/quarterly")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        quarters = [x["quarter"] for x in data]
        assert quarters == sorted(quarters)
        for q in data:
            assert "completion_pct" in q

    def test_sprint_velocity(self, client):
        r = client.get(f"{API}/dashboard/sprint-velocity")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 19
        for s in data[:3]:
            assert "planned_sp" in s and "completed_sp" in s

    def test_team_workload_sorted(self, client):
        r = client.get(f"{API}/dashboard/team-workload")
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 13
        sps = [m["assigned_sp"] for m in data]
        assert sps == sorted(sps, reverse=True), "team-workload not sorted by assigned_sp desc"
        for m in data:
            assert "utilization_pct" in m
