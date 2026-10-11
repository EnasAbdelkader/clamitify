from __future__ import annotations

import tempfile
import unittest
import uuid
from pathlib import Path

from backend.app import create_app
from backend.extensions import db
from backend.models import ContentItem, ContactMessage, User


class ContractEndpointMatrixTests(unittest.TestCase):
    """Functional status/JSON matrix for all 54 API contract method/path pairs."""

    def setUp(self) -> None:
        self.tmp = tempfile.TemporaryDirectory()
        self.app = create_app({
            "TESTING": True,
            "JWT_SECRET_KEY": "test-secret-that-is-at-least-32-bytes",
            "SQLALCHEMY_DATABASE_URI": f"sqlite:///{Path(self.tmp.name) / 'contract.db'}",
            "RATE_LIMIT_PER_MINUTE": 10000,
        })
        self.client = self.app.test_client()
        with self.app.app_context():
            admin = User(email="matrix-admin@example.com", name="Admin", role="admin", password_hash="")
            admin.set_password("password123")
            member = User(email="matrix-member@example.com", name="Member", role="member", password_hash="")
            member.set_password("password123")
            db.session.add_all([admin, member])
            db.session.flush()
            for kind, item_id, data in self.content():
                db.session.add(ContentItem(id=item_id, kind=kind, data=data))
            db.session.add(ContactMessage(sender="Sender", email="sender@example.com", subject="Subject", message="Message"))
            db.session.commit()
        self.admin = self.login("/api/admin/login", "matrix-admin@example.com")
        self.member = self.login("/api/auth/login", "matrix-member@example.com")

    def tearDown(self) -> None:
        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()
        self.tmp.cleanup()

    @staticmethod
    def content():
        return [
            ("programs", "program-1", {"titleEn": "Program", "titleAr": "برنامج", "descriptionEn": "Description", "descriptionAr": "وصف", "icon": "Monitor"}),
            ("initiatives", "initiative-1", {"titleEn": "Initiative", "titleAr": "مبادرة", "descriptionEn": "Description", "descriptionAr": "وصف", "image": "https://example.com/i.png", "categoryEn": "Outreach", "categoryAr": "توعية", "progress": 20, "targetEn": "Target", "targetAr": "هدف"}),
            ("events", "event-1", {"titleEn": "Event", "titleAr": "فعالية", "descriptionEn": "Description", "descriptionAr": "وصف", "date": "2026-12-01", "locationEn": "Dubai", "locationAr": "دبي", "categoryEn": "Education", "categoryAr": "التعليم", "registeredCount": 0}),
            ("courses", "course-1", {"titleEn": "Course", "titleAr": "مساق", "descriptionEn": "Description", "descriptionAr": "وصف", "instructorEn": "Instructor", "instructorAr": "مدرب", "durationEn": "1 week", "durationAr": "أسبوع", "lessonsCount": 1, "categoryEn": "Tech", "categoryAr": "تقنية", "image": "https://example.com/c.png"}),
            ("games", "game-1", {"titleEn": "Game", "titleAr": "لعبة", "descriptionEn": "Description", "descriptionAr": "وصف", "categoryEn": "Education", "categoryAr": "تعليمي", "icon": "Activity", "playUrl": "/games/game-1"}),
            ("opportunities", "opportunity-1", {"titleEn": "Opportunity", "titleAr": "فرصة", "descriptionEn": "Description", "descriptionAr": "وصف", "typeEn": "Job", "typeAr": "وظيفة", "locationEn": "Dubai", "locationAr": "دبي", "postedDate": "2026-07-15"}),
            ("posts", "post-1", {"titleEn": "Post", "titleAr": "مقال", "excerptEn": "Excerpt", "excerptAr": "مقتطف", "contentEn": "Content", "contentAr": "محتوى", "image": "https://example.com/p.png", "date": "2026-07-15", "authorEn": "Author", "authorAr": "كاتب", "categoryEn": "News", "categoryAr": "أخبار"}),
            ("team", "team-1", {"nameEn": "Member", "nameAr": "عضو", "roleEn": "Role", "roleAr": "دور", "image": "https://example.com/t.png"}),
            ("careers", "career-1", {"titleEn": "Career", "titleAr": "مسار", "skillsEn": ["Skill"], "skillsAr": ["مهارة"], "salaryEn": "$1", "salaryAr": "1", "pathEn": "Path", "pathAr": "مسار", "demand": "High"}),
            ("carbon-questions", "question-1", {"questionEn": "Question", "questionAr": "سؤال", "options": [{"textEn": "Walk", "textAr": "مشي", "value": 0}]}),
        ]

    def login(self, path: str, email: str) -> dict[str, str]:
        response = self.client.post(path, json={"email": email, "password": "password123"})
        self.assertEqual(response.status_code, 200, response.get_json())
        return {"Authorization": f"Bearer {response.get_json()['token']}"}

    def assert_json(self, response, statuses=(200, 201)):
        self.assertIn(response.status_code, statuses, response.get_data(as_text=True))
        self.assertTrue(response.is_json, response.get_data(as_text=True))
        return response.get_json()

    def test_public_reads_and_invalid_ids(self):
        list_paths = ["programs", "initiatives", "events", "courses", "games", "opportunities", "posts", "team", "careers", "carbon-questions"]
        for path in list_paths:
            self.assertIsInstance(self.assert_json(self.client.get(f"/api/{path}")), list)
        self.assertIsInstance(self.assert_json(self.client.get("/api/curricula/download"))["url"], str)
        for path in ["programs/program-1", "posts/post-1"]:
            self.assert_json(self.client.get(f"/api/{path}"))
        self.assertEqual(self.client.get("/api/programs/missing").status_code, 404)
        self.assertEqual(self.client.get("/api/posts/missing").status_code, 404)

    def test_public_forms_valid_and_invalid(self):
        suffix = uuid.uuid4().hex[:8]
        valid = [
            ("/api/contact", {"firstName": "A", "lastName": "B", "email": f"contact-{suffix}@example.com", "subject": "S", "message": "M"}),
            ("/api/meetings", {"name": "A", "email": f"meeting-{suffix}@example.com", "date": "2026-12-01", "time": "14:00", "notes": ""}),
            ("/api/partnerships", {"orgName": "Org", "orgType": "ngo", "contactPerson": "A", "email": f"partner-{suffix}@example.com", "proposal": "P"}),
            ("/api/workshops", {"institutionName": "School", "city": "Dubai", "studentCount": "10", "workshopType": "climate-basics", "email": f"workshop-{suffix}@example.com"}),
            ("/api/opportunities/apply", {"opportunityId": "opportunity-1", "name": "A", "email": f"apply-{suffix}@example.com", "portfolio": "https://example.com", "coverLetter": "C"}),
            ("/api/newsletter/subscribe", {"email": f"newsletter-{suffix}@example.com"}),
        ]
        for path, body in valid:
            self.assert_json(self.client.post(path, json=body), (200, 201))
            self.assertIn(self.client.post(path, json={}).status_code, (400, 422))
        event = self.client.post("/api/events/register", json={"eventId": "event-1", "name": "A", "email": f"event-{suffix}@example.com", "phone": "123"})
        self.assert_json(event, (201,))
        self.assertIn(self.client.post("/api/events/register", json={"eventId": "missing", "name": "A", "email": "other@example.com", "phone": "123"}).status_code, (400, 404, 422))

    def test_member_endpoints_persist_and_validate(self):
        self.assert_json(self.client.get("/api/user/profile", headers=self.member))
        self.assert_json(self.client.put("/api/user/profile", headers=self.member, json={"name": "Updated", "city": "Dubai", "bio": "Bio"}))
        profile = self.assert_json(self.client.get("/api/user/profile", headers=self.member))
        self.assertEqual(profile["name"], "Updated")
        self.assert_json(self.client.post("/api/user/carbon-footprint", headers=self.member, json={"footprint": 3.2}))
        self.assert_json(self.client.post("/api/user/courses/course-1/progress", headers=self.member, json={"progress": 50}))
        self.assertEqual(self.client.post("/api/user/courses/missing/progress", headers=self.member, json={"progress": 50}).status_code, 404)
        self.assert_json(self.client.post("/api/user/trees", headers=self.member, json={"count": 2}))
        impact = self.assert_json(self.client.get("/api/user/impact", headers=self.member))
        self.assertGreaterEqual(len(impact["history"]), 3)
        self.assertEqual(self.client.get("/api/user/impact?year=bad", headers=self.member).status_code, 422)
        self.assertEqual(self.client.post("/api/user/trees", headers=self.member, json={"count": -1}).status_code, 422)

    def test_admin_auth_dashboard_messages_and_settings(self):
        for path in ["/api/admin/settings", "/api/admin/stats", "/api/admin/analytics", "/api/admin/messages"]:
            self.assert_json(self.client.get(path, headers=self.admin))
            self.assertEqual(self.client.get(path).status_code, 401)
        self.assert_json(self.client.post("/api/admin/settings", headers=self.admin, json={"siteName": "C", "contactEmail": "c@example.com", "enableMaintenance": False}))
        self.assertIn(self.client.post("/api/admin/settings", headers=self.admin, json={}).status_code, (400, 422))
        message_id = self.client.get("/api/admin/messages", headers=self.admin).get_json()[0]["id"]
        self.assert_json(self.client.put(f"/api/admin/messages/{message_id}/read", headers=self.admin, json={"isRead": True}))
        self.assertEqual(self.client.put("/api/admin/messages/99999/read", headers=self.admin, json={"isRead": True}).status_code, 404)
        self.assert_json(self.client.delete(f"/api/admin/messages/{message_id}", headers=self.admin))
        self.assertEqual(self.client.delete("/api/admin/messages/99999", headers=self.admin).status_code, 404)

    def test_all_cms_groups_have_functional_create_update_delete(self):
        cms_data = {kind: data for kind, _, data in self.content() if kind in {"events", "posts", "programs", "initiatives", "courses", "opportunities", "team"}}
        for kind, data in cms_data.items():
            created = self.assert_json(self.client.post(f"/api/admin/{kind}", headers=self.admin, json=data), (201,))
            item_id = created["id"]
            self.assert_json(self.client.put(f"/api/admin/{kind}/{item_id}", headers=self.admin, json={"titleEn": "Updated"} if kind != "team" else {"nameEn": "Updated"}))
            self.assertEqual(self.client.delete(f"/api/admin/{kind}/{item_id}", headers=self.admin).status_code, 200)
            self.assertEqual(self.client.put(f"/api/admin/{kind}/missing", headers=self.admin, json={}).status_code, 404)
            self.assertEqual(self.client.post(f"/api/admin/{kind}", headers=self.member, json=data).status_code, 403)

    def test_ai_is_controlled_when_provider_is_not_configured(self):
        response = self.client.post("/api/ai/chat", json={"prompt": "hello", "language": "en"})
        self.assertEqual(response.status_code, 503)
        self.assertTrue(response.is_json)
        self.assertIn(self.client.post("/api/ai/chat", json={}).status_code, (400, 422))


if __name__ == "__main__":
    unittest.main()
