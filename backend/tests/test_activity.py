"""Backend tests for Activity Log + Comments feature (Iteration 3)."""
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


@pytest.fixture(scope="module")
def backlog_item(client):
    """Create a fresh backlog item for activity tests; clean up at end."""
    payload = {
        "wb_ref": "TEST-ACT-001",
        "title": "TEST activity item",
        "system": "WMS",
        "priority": "P3",
        "quarter": "Q3 2026",
        "story_points": 5,
        "status": "Backlog",
        "percent_done": 0,
    }
    r = client.post(f"{API}/backlog", json=payload)
    assert r.status_code == 200
    item = r.json()
    yield item
    client.delete(f"{API}/backlog/{item['id']}")


@pytest.fixture(scope="module")
def actor_id(client):
    """Pick an existing team member as actor."""
    r = client.get(f"{API}/team")
    assert r.status_code == 200
    team = r.json()
    assert len(team) > 0
    return team[0]["id"]


# ============ Comments ============
class TestComments:
    created_comment_id = None

    def test_create_comment_with_actor(self, client, backlog_item, actor_id):
        r = client.post(
            f"{API}/backlog/{backlog_item['id']}/comments",
            json={"text": "First comment", "actor_id": actor_id},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["kind"] == "comment"
        assert d["text"] == "First comment"
        assert d["actor_id"] == actor_id
        assert d["item_id"] == backlog_item["id"]
        TestComments.created_comment_id = d["id"]

    def test_create_comment_guest(self, client, backlog_item):
        r = client.post(
            f"{API}/backlog/{backlog_item['id']}/comments",
            json={"text": "Guest comment"},
        )
        assert r.status_code == 200
        d = r.json()
        assert d["kind"] == "comment"
        assert d["actor_id"] is None
        assert d["text"] == "Guest comment"

    def test_empty_comment_400(self, client, backlog_item):
        r = client.post(
            f"{API}/backlog/{backlog_item['id']}/comments",
            json={"text": "   "},
        )
        assert r.status_code == 400

    def test_comment_for_missing_item_404(self, client):
        r = client.post(
            f"{API}/backlog/does-not-exist/comments",
            json={"text": "hi"},
        )
        assert r.status_code == 404


# ============ Activity feed sorting ============
class TestActivityFeed:
    def test_feed_newest_first(self, client, backlog_item, actor_id):
        # Seed activity inside this test so it works under parallel runners
        client.post(f"{API}/backlog/{backlog_item['id']}/comments",
                    json={"text": "feed-a", "actor_id": actor_id})
        client.post(f"{API}/backlog/{backlog_item['id']}/comments",
                    json={"text": "feed-b", "actor_id": actor_id})
        r = client.get(f"{API}/backlog/{backlog_item['id']}/activity")
        assert r.status_code == 200
        items = r.json()
        assert len(items) >= 2
        timestamps = [i["created_at"] for i in items]
        assert timestamps == sorted(timestamps, reverse=True), "Activity not newest-first"


# ============ Auto-log on PATCH ============
class TestAutoLogChanges:
    def test_status_change_logged(self, client, backlog_item, actor_id):
        # Pre-count change rows
        before = client.get(f"{API}/backlog/{backlog_item['id']}/activity").json()
        before_changes = [a for a in before if a["kind"] == "change"]
        r = client.patch(
            f"{API}/backlog/{backlog_item['id']}",
            params={"actor_id": actor_id},
            json={"status": "In Progress"},
        )
        assert r.status_code == 200
        after = client.get(f"{API}/backlog/{backlog_item['id']}/activity").json()
        after_changes = [a for a in after if a["kind"] == "change"]
        new_rows = [a for a in after_changes if a not in before_changes]
        # Status field row must exist
        status_row = next((a for a in new_rows if a["field"] == "status"), None)
        assert status_row is not None
        assert status_row["from_value"] == "Backlog"
        assert status_row["to_value"] == "In Progress"
        assert status_row["actor_id"] == actor_id
        assert status_row["kind"] == "change"

    def test_multi_field_change_creates_multiple_rows(self, client, backlog_item, actor_id):
        before = client.get(f"{API}/backlog/{backlog_item['id']}/activity").json()
        before_ids = {a["id"] for a in before}
        r = client.patch(
            f"{API}/backlog/{backlog_item['id']}",
            params={"actor_id": actor_id},
            json={"priority": "P1", "story_points": 13, "percent_done": 40},
        )
        assert r.status_code == 200
        after = client.get(f"{API}/backlog/{backlog_item['id']}/activity").json()
        new = [a for a in after if a["id"] not in before_ids]
        fields = {a["field"] for a in new if a["kind"] == "change"}
        assert "priority" in fields
        assert "story_points" in fields
        assert "percent_done" in fields

    def test_no_change_no_log(self, client, backlog_item, actor_id):
        # Patch with the SAME values
        cur = client.get(f"{API}/backlog/{backlog_item['id']}").json()
        before = client.get(f"{API}/backlog/{backlog_item['id']}/activity").json()
        before_change_count = sum(1 for a in before if a["kind"] == "change")
        r = client.patch(
            f"{API}/backlog/{backlog_item['id']}",
            params={"actor_id": actor_id},
            json={"status": cur["status"], "priority": cur["priority"]},
        )
        assert r.status_code == 200
        after = client.get(f"{API}/backlog/{backlog_item['id']}/activity").json()
        after_change_count = sum(1 for a in after if a["kind"] == "change")
        assert after_change_count == before_change_count, "Unchanged PATCH must not log"

    def test_patch_without_actor_logs_null(self, client, backlog_item):
        before = client.get(f"{API}/backlog/{backlog_item['id']}/activity").json()
        before_ids = {a["id"] for a in before}
        # change phase (currently None) to something
        r = client.patch(
            f"{API}/backlog/{backlog_item['id']}",
            json={"phase": "Phase 1"},
        )
        assert r.status_code == 200
        after = client.get(f"{API}/backlog/{backlog_item['id']}/activity").json()
        new = [a for a in after if a["id"] not in before_ids and a["kind"] == "change"]
        phase_row = next((a for a in new if a["field"] == "phase"), None)
        assert phase_row is not None
        assert phase_row["actor_id"] is None
        assert phase_row["to_value"] == "Phase 1"


# ============ Delete activity rules ============
class TestDeleteActivity:
    def test_delete_comment_ok(self, client, backlog_item):
        # create a comment we can delete
        r = client.post(
            f"{API}/backlog/{backlog_item['id']}/comments",
            json={"text": "to be deleted"},
        )
        cid = r.json()["id"]
        d = client.delete(f"{API}/activity/{cid}")
        assert d.status_code == 200
        # confirm gone
        feed = client.get(f"{API}/backlog/{backlog_item['id']}/activity").json()
        assert all(a["id"] != cid for a in feed)

    def test_cannot_delete_change_row(self, client, backlog_item, actor_id):
        # Force a change to ensure at least one change row exists
        client.patch(
            f"{API}/backlog/{backlog_item['id']}",
            params={"actor_id": actor_id},
            json={"percent_done": 75},
        )
        feed = client.get(f"{API}/backlog/{backlog_item['id']}/activity").json()
        change_row = next((a for a in feed if a["kind"] == "change"), None)
        assert change_row is not None
        d = client.delete(f"{API}/activity/{change_row['id']}")
        assert d.status_code == 404


# ============ Cascade on backlog delete ============
class TestCascadeOnDelete:
    def test_delete_item_removes_activity(self, client, actor_id):
        # Make a new throwaway item, add comment + change, then delete and check
        payload = {
            "wb_ref": "TEST-ACT-CASCADE",
            "title": "Cascade test",
            "system": "WMS",
            "priority": "P3",
            "quarter": "Q3 2026",
            "story_points": 1,
        }
        item = client.post(f"{API}/backlog", json=payload).json()
        client.post(
            f"{API}/backlog/{item['id']}/comments",
            json={"text": "comment to be cascaded", "actor_id": actor_id},
        )
        client.patch(
            f"{API}/backlog/{item['id']}",
            params={"actor_id": actor_id},
            json={"status": "In Progress"},
        )
        feed = client.get(f"{API}/backlog/{item['id']}/activity").json()
        assert len(feed) >= 2

        d = client.delete(f"{API}/backlog/{item['id']}")
        assert d.status_code == 200
        feed_after = client.get(f"{API}/backlog/{item['id']}/activity").json()
        assert feed_after == [], "Activity rows for deleted item must be removed"
