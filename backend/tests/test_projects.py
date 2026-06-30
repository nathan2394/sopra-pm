"""Backend tests for Project endpoints + project/phase linkage on backlog items."""
import os
import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL", "http://localhost:8001").rstrip("/")
API = f"{BASE_URL}/api"

EXPECTED_CODES = {"SCE", "SCR", "HRS", "WMS", "BIM", "TMS", "INT"}


@pytest.fixture(scope="session")
def client():
    s = requests.Session()
    s.headers.update({"Content-Type": "application/json"})
    return s


@pytest.fixture(scope="module")
def projects(client):
    r = client.get(f"{API}/projects")
    assert r.status_code == 200
    return r.json()


@pytest.fixture(scope="module")
def by_code(projects):
    return {p["code"]: p for p in projects if p.get("code")}


# ====================== Seeded projects ======================
class TestProjectsSeed:
    def test_list_projects_returns_seven(self, projects):
        codes = {p.get("code") for p in projects if p.get("code")}
        assert EXPECTED_CODES.issubset(codes), f"Missing codes: {EXPECTED_CODES - codes}"

    def test_projects_have_owner_id(self, by_code):
        # owners are matched from SEED_PROJECTS owner name -> team member id at seed time
        sce = by_code["SCE"]
        assert sce.get("owner_id"), "SCE should have an owner_id from seed"
        assert sce["name"] == "Sopra Cash Engine"
        assert sce["system"] == "Nexora"

    def test_get_project_by_id(self, client, by_code):
        sce = by_code["SCE"]
        r = client.get(f"{API}/projects/{sce['id']}")
        assert r.status_code == 200
        assert r.json()["code"] == "SCE"

    def test_get_project_404(self, client):
        r = client.get(f"{API}/projects/does-not-exist")
        assert r.status_code == 404


# ====================== SCE specifics: 6 items spanning 3 phases ======================
class TestSCEItems:
    def test_sce_has_six_items_across_three_phases(self, client, by_code):
        sce_id = by_code["SCE"]["id"]
        r = client.get(f"{API}/backlog", params={"project_id": sce_id})
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 6, f"Expected 6 SCE items, got {len(items)}"
        phases = {i.get("phase") for i in items}
        assert {"Phase 1", "Phase 2", "Phase 3"}.issubset(phases), f"phases={phases}"
        for i in items:
            assert i["project_id"] == sce_id

    def test_filter_by_project_and_phase(self, client, by_code):
        sce_id = by_code["SCE"]["id"]
        r = client.get(f"{API}/backlog", params={"project_id": sce_id, "phase": "Phase 3"})
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 1
        for i in items:
            assert i["project_id"] == sce_id
            assert i["phase"] == "Phase 3"


# ====================== Project summary ======================
class TestProjectSummary:
    def test_summary_structure_sce(self, client, by_code):
        sce_id = by_code["SCE"]["id"]
        r = client.get(f"{API}/projects/{sce_id}/summary")
        assert r.status_code == 200
        d = r.json()
        for k in ("project", "items", "total_sp", "done_sp", "completion_pct", "phases"):
            assert k in d, f"missing key {k}"
        assert d["items"] == 6
        assert d["total_sp"] > 0
        # phases array contains per-phase completion_pct
        phase_names = {p["phase"] for p in d["phases"]}
        assert {"Phase 1", "Phase 2", "Phase 3"}.issubset(phase_names)
        for p in d["phases"]:
            for k in ("phase", "items", "total_sp", "done_sp", "completion_pct"):
                assert k in p

    def test_summary_404(self, client):
        r = client.get(f"{API}/projects/does-not-exist/summary")
        assert r.status_code == 404


# ====================== Project CRUD ======================
class TestProjectCRUD:
    created_id = None

    def test_create_project(self, client):
        payload = {"name": "TEST_Project_X", "code": "TPX",
                   "description": "Created by tests", "system": "Internal",
                   "color": "#123456", "status": "Active"}
        r = client.post(f"{API}/projects", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["name"] == "TEST_Project_X"
        assert d["code"] == "TPX"
        assert "id" in d
        TestProjectCRUD.created_id = d["id"]

    def test_patch_project(self, client):
        assert TestProjectCRUD.created_id
        r = client.patch(f"{API}/projects/{TestProjectCRUD.created_id}",
                         json={"status": "Paused", "description": "Updated"})
        assert r.status_code == 200
        d = r.json()
        assert d["status"] == "Paused"
        assert d["description"] == "Updated"
        # verify persisted
        g = client.get(f"{API}/projects/{TestProjectCRUD.created_id}")
        assert g.json()["status"] == "Paused"

    def test_delete_unlinks_backlog_items(self, client):
        """DELETE removes project; linked backlog items get project_id=null and phase=null."""
        assert TestProjectCRUD.created_id
        pid = TestProjectCRUD.created_id
        # Create a backlog item linked to this project + phase
        item_payload = {
            "wb_ref": "TEST-PROJ-LINK-001",
            "title": "TEST item linked to TPX",
            "system": "Internal",
            "priority": "P3",
            "quarter": "Q3 2026",
            "story_points": 3,
            "project_id": pid,
            "phase": "Phase 1",
        }
        ci = client.post(f"{API}/backlog", json=item_payload)
        assert ci.status_code == 200
        item_id = ci.json()["id"]
        assert ci.json()["project_id"] == pid
        assert ci.json()["phase"] == "Phase 1"

        # Delete project
        d = client.delete(f"{API}/projects/{pid}")
        assert d.status_code == 200

        # Confirm project gone
        g = client.get(f"{API}/projects/{pid}")
        assert g.status_code == 404

        # Confirm item still exists, but project_id and phase are cleared
        gi = client.get(f"{API}/backlog/{item_id}")
        assert gi.status_code == 200
        body = gi.json()
        assert body["project_id"] is None, f"project_id should be unset, got {body['project_id']}"
        assert body["phase"] is None, f"phase should be unset, got {body['phase']}"

        # cleanup
        client.delete(f"{API}/backlog/{item_id}")


# ====================== Backlog ↔ Project/Phase fields ======================
class TestBacklogProjectFields:
    created_id = None

    def test_create_backlog_with_project_and_phase(self, client, by_code):
        sce_id = by_code["SCE"]["id"]
        payload = {
            "wb_ref": "TEST-PHASE-001",
            "title": "TEST item with phase",
            "system": "Nexora",
            "priority": "P2",
            "quarter": "Q3 2026",
            "story_points": 5,
            "project_id": sce_id,
            "phase": "Phase 2",
        }
        r = client.post(f"{API}/backlog", json=payload)
        assert r.status_code == 200
        d = r.json()
        assert d["project_id"] == sce_id
        assert d["phase"] == "Phase 2"
        TestBacklogProjectFields.created_id = d["id"]
        # verify persisted
        g = client.get(f"{API}/backlog/{d['id']}")
        assert g.json()["project_id"] == sce_id
        assert g.json()["phase"] == "Phase 2"

    def test_patch_change_project_and_phase(self, client, by_code):
        assert TestBacklogProjectFields.created_id
        bim_id = by_code["BIM"]["id"]
        r = client.patch(f"{API}/backlog/{TestBacklogProjectFields.created_id}",
                         json={"project_id": bim_id, "phase": "Phase 1"})
        assert r.status_code == 200
        d = r.json()
        assert d["project_id"] == bim_id
        assert d["phase"] == "Phase 1"
        # verify persisted
        g = client.get(f"{API}/backlog/{TestBacklogProjectFields.created_id}")
        assert g.json()["project_id"] == bim_id
        assert g.json()["phase"] == "Phase 1"

    def test_cleanup(self, client):
        if TestBacklogProjectFields.created_id:
            client.delete(f"{API}/backlog/{TestBacklogProjectFields.created_id}")
