from __future__ import annotations

import base64
from io import BytesIO
import tempfile
import unittest
from pathlib import Path

from backend.app import create_app
from backend.extensions import db
from backend.models import AuditLog, Certificate, ContentItem, CourseProgress, EventRegistration, User


PNG = base64.b64decode("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=")
JPEG = b"\xff\xd8\xff" + b"\x00" * 20


class ExtendedBackendTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.app = create_app({"TESTING": True, "JWT_SECRET_KEY": "test-secret-that-is-at-least-32-bytes", "SQLALCHEMY_DATABASE_URI": f"sqlite:///{Path(self.tmp.name) / 'test.db'}", "RATE_LIMIT_PER_MINUTE": 1000})
        self.client = self.app.test_client()
        with self.app.app_context():
            admin = User(email="admin@climatify.org", name="Admin", role="admin", password_hash="")
            admin.set_password("password123")
            member = User(email="member@example.com", name="Member", role="member", password_hash="")
            member.set_password("password123")
            db.session.add_all([admin, member])
            db.session.flush()
            for kind, item_id, data in [
                ("courses", "course-1", {"titleEn":"Course", "titleAr":"مساق", "descriptionEn":"d", "descriptionAr":"و", "instructorEn":"i", "instructorAr":"م", "durationEn":"1 week", "durationAr":"أسبوع", "lessonsCount":2, "categoryEn":"c", "categoryAr":"ج", "image":"https://example.com/course.png"}),
                ("events", "event-1", {"titleEn":"Event", "titleAr":"فعالية", "descriptionEn":"d", "descriptionAr":"و", "date":"2026-12-01", "locationEn":"Dubai", "locationAr":"دبي", "categoryEn":"Education", "categoryAr":"التعليم", "registeredCount":0}),
                ("posts", "post-1", {"titleEn":"Post", "titleAr":"مقال", "excerptEn":"e", "excerptAr":"م", "contentEn":"c", "contentAr":"ن", "image":"https://example.com/post.png", "date":"2026-09-01", "authorEn":"A", "authorAr":"م", "categoryEn":"News", "categoryAr":"أخبار"}),
                ("programs", "program-1", {"titleEn":"Program", "titleAr":"برنامج", "descriptionEn":"d", "descriptionAr":"و", "icon":"Monitor"}),
            ]:
                db.session.add(ContentItem(id=item_id, kind=kind, data=data))
            db.session.commit()
        self.admin = self.login("admin@climatify.org")
        self.member = self.login("member@example.com")

    def tearDown(self):
        with self.app.app_context():
            db.session.remove(); db.engine.dispose()
        self.tmp.cleanup()

    def login(self, email):
        response = self.client.post("/api/admin/login" if email.startswith("admin") else "/api/auth/login", json={"email": email, "password": "password123"})
        return {"Authorization": f"Bearer {response.get_json()['token']}"}

    def test_lessons_crud_and_invalid_course(self):
        created = self.client.post("/api/admin/courses/course-1/lessons", headers=self.admin, json={"titleEn":"Lesson", "titleAr":"درس", "order":1})
        self.assertEqual(created.status_code, 201)
        lesson_id = created.get_json()["id"]
        self.assertEqual(len(self.client.get("/api/courses/course-1/lessons").get_json()), 1)
        self.assertEqual(self.client.put(f"/api/admin/lessons/{lesson_id}", headers=self.admin, json={"duration":"10 min"}).status_code, 200)
        self.assertEqual(self.client.delete(f"/api/admin/lessons/{lesson_id}", headers=self.admin).status_code, 200)
        self.assertEqual(self.client.post("/api/admin/courses/no-course/lessons", headers=self.admin, json={"titleEn":"x", "titleAr":"x", "order":1}).status_code, 404)
        self.assertEqual(self.client.post("/api/admin/courses/course-1/lessons", json={"titleEn":"x", "titleAr":"x", "order":1}).status_code, 401)

    def test_ticket_progress_impact_and_cancellation_persist(self):
        response = self.client.post("/api/events/register", json={"eventId":"event-1", "name":"Member", "email":"member@example.com", "phone":"123"})
        self.assertEqual(response.status_code, 201)
        ticket = response.get_json()["ticketCode"]
        self.assertTrue(ticket.startswith("CLM-"))
        with self.app.app_context():
            registration = db.session.query(EventRegistration).filter_by(ticket_code=ticket).one()
            self.assertEqual(registration.event_id, "event-1")
        self.assertEqual(self.client.post("/api/user/courses/course-1/progress", headers=self.member, json={"progress":60}).status_code, 200)
        self.assertEqual(self.client.post("/api/user/carbon-footprint", headers=self.member, json={"footprint":4.2}).status_code, 200)
        self.assertEqual(self.client.post("/api/user/trees", headers=self.member, json={"count":2}).status_code, 200)
        impact = self.client.get("/api/user/impact", headers=self.member).get_json()
        self.assertGreaterEqual(len(impact["history"]), 3)
        profile = self.client.get("/api/user/profile", headers=self.member).get_json()
        self.assertEqual(profile["registeredEvents"][0]["ticketCode"], ticket)
        cancelled = self.client.delete("/api/user/events/event-1", headers=self.member)
        self.assertEqual(cancelled.status_code, 200)
        self.assertEqual(self.client.delete("/api/user/events/event-1", headers=self.member).status_code, 404)

    def test_audit_records_capture_actions_without_secrets(self):
        self.client.post("/api/admin/settings", headers=self.admin, json={"siteName": "Audited", "contactEmail": "audit@example.com", "enableMaintenance": False})
        self.client.post("/api/admin/events", headers=self.admin, json={"titleEn":"E", "titleAr":"ف", "descriptionEn":"D", "descriptionAr":"و", "date":"2026-12-01", "locationEn":"Dubai", "locationAr":"دبي", "categoryEn":"Education", "categoryAr":"التعليم"})
        self.client.post("/api/contact", json={"firstName":"A", "lastName":"B", "email":"audit-contact@example.com", "subject":"S", "message":"M"})
        message_id = self.client.get("/api/admin/messages", headers=self.admin).get_json()[0]["id"]
        self.client.put(f"/api/admin/messages/{message_id}/read", headers=self.admin, json={"isRead": True})
        self.client.delete(f"/api/admin/messages/{message_id}", headers=self.admin)
        self.client.post("/api/upload", headers=self.admin, data={"file": (BytesIO(PNG), "audit.png", "image/png")}, content_type="multipart/form-data")
        self.client.post("/api/user/carbon-footprint", headers=self.member, json={"footprint": 1.5})
        with self.app.app_context():
            logs = db.session.query(AuditLog).all()
            actions = {log.action for log in logs}
            self.assertTrue({"login", "update", "create", "delete", "upload"} <= actions)
            for log in logs:
                self.assertNotIn("password", log.resource.lower())
                self.assertNotIn("token", log.resource.lower())

    def test_bookmarks_ownership_duplicates_and_missing_content(self):
        self.assertEqual(self.client.get("/api/user/bookmarks").status_code, 401)
        created = self.client.post("/api/user/bookmarks", headers=self.member, json={"contentType":"courses", "contentId":"course-1"})
        self.assertEqual(created.status_code, 201)
        bookmark_id = created.get_json()["id"]
        self.assertEqual(self.client.post("/api/user/bookmarks", headers=self.member, json={"contentType":"courses", "contentId":"course-1"}).status_code, 409)
        self.assertEqual(len(self.client.get("/api/user/bookmarks", headers=self.member).get_json()), 1)
        self.assertEqual(self.client.post("/api/user/bookmarks", headers=self.member, json={"contentType":"courses", "contentId":"missing"}).status_code, 404)
        self.assertEqual(self.client.delete(f"/api/user/bookmarks/{bookmark_id}", headers=self.member).status_code, 200)

    def test_stats_analytics_audit_and_date_validation(self):
        self.client.post("/api/admin/settings", headers=self.admin, json={"siteName":"New", "contactEmail":"admin@example.com", "enableMaintenance":False})
        stats = self.client.get("/api/admin/stats", headers=self.admin).get_json()
        for key in ["users", "admins", "contentItems", "courses", "events", "registrations", "contactMessages", "unreadMessages", "formSubmissions", "uploads", "auditLogs", "analyticsEvents"]:
            self.assertIn(key, stats)
        self.assertEqual(self.client.get("/api/admin/analytics/traffic?startDate=bad", headers=self.admin).status_code, 422)
        self.assertEqual(self.client.get("/api/admin/analytics/traffic", headers=self.admin).status_code, 200)
        self.assertEqual(self.client.get("/api/admin/analytics").status_code, 401)

    def test_upload_security_and_retrieval(self):
        missing = self.client.post("/api/upload", headers=self.admin)
        self.assertEqual(missing.status_code, 422)
        self.assertEqual(self.client.post("/api/upload", headers=self.admin, data={"file":(BytesIO(b"not-executable"), "..\\evil.exe")}, content_type="multipart/form-data").status_code, 422)
        fake = self.client.post("/api/upload", headers=self.admin, data={"file":(BytesIO(b"not-image"), "fake.png", "image/png")}, content_type="multipart/form-data")
        self.assertEqual(fake.status_code, 422)
        unsupported = self.client.post("/api/upload", headers=self.admin, data={"file":(BytesIO(b"text"), "file.txt", "text/plain")}, content_type="multipart/form-data")
        self.assertEqual(unsupported.status_code, 422)
        oversized = self.client.post("/api/upload", headers=self.admin, data={"file":(BytesIO(b"x" * (5 * 1024 * 1024 + 1)), "large.png", "image/png")}, content_type="multipart/form-data")
        self.assertEqual(oversized.status_code, 413)
        valid = self.client.post("/api/upload", headers=self.admin, data={"file":(BytesIO(JPEG), "pixel.jpg", "image/jpeg")}, content_type="multipart/form-data")
        self.assertEqual(valid.status_code, 200)
        retrieved = self.client.get(valid.get_json()["url"])
        try:
            retrieved.get_data()
            self.assertEqual(retrieved.status_code, 200)
        finally:
            retrieved.close()
        self.assertEqual(self.client.get("/api/uploads/nonexistent.png").status_code, 404)

    def test_all_contract_route_patterns_registered(self):
        routes = {(rule.rule, method) for rule in self.app.url_map.iter_rules() for method in rule.methods - {"HEAD", "OPTIONS"} if rule.rule.startswith("/api/")}
        required = {("/api/programs", "GET"), ("/api/programs/<item_id>", "GET"), ("/api/initiatives", "GET"), ("/api/events", "GET"), ("/api/courses", "GET"), ("/api/games", "GET"), ("/api/opportunities", "GET"), ("/api/posts", "GET"), ("/api/posts/<item_id>", "GET"), ("/api/team", "GET"), ("/api/careers", "GET"), ("/api/carbon-questions", "GET"), ("/api/curricula/download", "GET"), ("/api/contact", "POST"), ("/api/meetings", "POST"), ("/api/partnerships", "POST"), ("/api/workshops", "POST"), ("/api/events/register", "POST"), ("/api/opportunities/apply", "POST"), ("/api/newsletter/subscribe", "POST"), ("/api/user/profile", "GET"), ("/api/user/profile", "PUT"), ("/api/user/carbon-footprint", "POST"), ("/api/ai/chat", "POST"), ("/api/admin/login", "POST"), ("/api/admin/change-password", "POST"), ("/api/admin/settings", "GET"), ("/api/admin/settings", "POST"), ("/api/admin/stats", "GET"), ("/api/admin/analytics", "GET"), ("/api/admin/messages", "GET"), ("/api/admin/messages/<int:message_id>/read", "PUT"), ("/api/admin/messages/<int:message_id>", "DELETE")}
        for kind in ["events", "posts", "programs", "initiatives", "courses", "opportunities", "team"]:
            required.update({(f"/api/admin/{kind}", "POST"), (f"/api/admin/{kind}/<item_id>", "PUT"), (f"/api/admin/{kind}/<item_id>", "DELETE")})
        self.assertEqual(len(required), 54)
        non_cms = required - {(f"/api/admin/{kind}", method) for kind in ["events", "posts", "programs", "initiatives", "courses", "opportunities", "team"] for method in ["POST"]} - {(f"/api/admin/{kind}/<item_id>", method) for kind in ["events", "posts", "programs", "initiatives", "courses", "opportunities", "team"] for method in ["PUT", "DELETE"]}
        self.assertTrue(non_cms <= routes)
        self.assertIn(("/api/admin/<kind>", "POST"), routes)
        self.assertIn(("/api/admin/<kind>/<item_id>", "PUT"), routes)
        self.assertIn(("/api/admin/<kind>/<item_id>", "DELETE"), routes)

    # ---- Certificate regression tests ----

    def test_certificate_schema_created_on_fresh_db(self):
        """Fresh database via migrations includes certificates table with correct schema."""
        with self.app.app_context():
            inspector = db.inspect(db.engine)
            self.assertIn("certificates", inspector.get_table_names())
            cols = {c["name"] for c in inspector.get_columns("certificates")}
            self.assertEqual(cols, {"id", "user_id", "course_id", "certificate_id", "issued_at"})
            indexes = {idx["name"] for idx in inspector.get_indexes("certificates")}
            self.assertIn("ix_certificates_certificate_id", indexes)
            self.assertIn("ix_certificates_course_id", indexes)
            self.assertIn("ix_certificates_user_id", indexes)
            uqs = {uc["name"] for uc in inspector.get_unique_constraints("certificates")}
            self.assertIn("uq_user_course_certificate", uqs)
            fks = {(fk["constrained_columns"][0], fk["referred_table"]) for fk in inspector.get_foreign_keys("certificates")}
            self.assertIn(("user_id", "users"), fks)
            self.assertIn(("course_id", "content_items"), fks)

    def test_certificate_issuance_requires_100_progress(self):
        """Cannot issue certificate without 100% course progress."""
        # No progress recorded
        resp = self.client.post("/api/user/courses/course-1/certificate", headers=self.member)
        self.assertEqual(resp.status_code, 403)
        self.assertIn("Course not completed", resp.get_json()["error"])

        # Partial progress
        self.client.post("/api/user/courses/course-1/progress", headers=self.member, json={"progress": 50})
        resp = self.client.post("/api/user/courses/course-1/certificate", headers=self.member)
        self.assertEqual(resp.status_code, 403)

    def test_certificate_issued_at_100_progress(self):
        """Certificate issued when progress reaches 100%."""
        self.client.post("/api/user/courses/course-1/progress", headers=self.member, json={"progress": 100})
        resp = self.client.post("/api/user/courses/course-1/certificate", headers=self.member)
        self.assertEqual(resp.status_code, 201)
        data = resp.get_json()
        self.assertIn("certificateId", data)
        self.assertTrue(data["certificateId"].startswith("CLM-"))
        self.assertEqual(data["courseId"], "course-1")
        self.assertEqual(data["userId"], 2)  # member user id

    def test_certificate_persistence_and_listing(self):
        """Certificate persists and appears in list/get endpoints."""
        self.client.post("/api/user/courses/course-1/progress", headers=self.member, json={"progress": 100})
        self.client.post("/api/user/courses/course-1/certificate", headers=self.member)

        # List certificates
        listed = self.client.get("/api/user/certificates", headers=self.member).get_json()
        self.assertEqual(len(listed), 1)
        cert_id = listed[0]["certificateId"]

        # Get specific certificate
        gotten = self.client.get(f"/api/user/certificates/course-1", headers=self.member).get_json()
        self.assertEqual(gotten["certificateId"], cert_id)

    def test_certificate_isolation_between_users(self):
        """User A cannot see User B's certificate."""
        # Member (user 2) gets certificate
        self.client.post("/api/user/courses/course-1/progress", headers=self.member, json={"progress": 100})
        self.client.post("/api/user/courses/course-1/certificate", headers=self.member)

        # Create another member
        with self.app.app_context():
            other = User(email="other@example.com", name="Other", role="member", password_hash="")
            other.set_password("password123")
            db.session.add(other)
            db.session.commit()
        other_headers = self.login("other@example.com")

        # Other user lists certificates - should be empty
        listed = self.client.get("/api/user/certificates", headers=other_headers).get_json()
        self.assertEqual(len(listed), 0)

        # Other user tries to get certificate - 404
        resp = self.client.get("/api/user/certificates/course-1", headers=other_headers)
        self.assertEqual(resp.status_code, 404)

    def test_duplicate_certificate_idempotent(self):
        """Re-issuing certificate returns existing one (200)."""
        self.client.post("/api/user/courses/course-1/progress", headers=self.member, json={"progress": 100})
        first = self.client.post("/api/user/courses/course-1/certificate", headers=self.member)
        self.assertEqual(first.status_code, 201)
        cert_id = first.get_json()["certificateId"]

        second = self.client.post("/api/user/courses/course-1/certificate", headers=self.member)
        self.assertEqual(second.status_code, 200)
        self.assertEqual(second.get_json()["certificateId"], cert_id)

    def test_certificate_invalid_course_returns_404(self):
        """Invalid course ID returns 404, not 500."""
        self.client.post("/api/user/courses/course-1/progress", headers=self.member, json={"progress": 100})
        resp = self.client.post("/api/user/courses/nonexistent/certificate", headers=self.member)
        self.assertEqual(resp.status_code, 404)

    def test_certificate_auth_failures(self):
        """Unauthenticated/forbidden requests return 401/403."""
        self.client.post("/api/user/courses/course-1/progress", headers=self.member, json={"progress": 100})
        # No token
        resp = self.client.post("/api/user/courses/course-1/certificate")
        self.assertEqual(resp.status_code, 401)

        # Admin token (wrong role)
        resp = self.client.post("/api/user/courses/course-1/certificate", headers=self.admin)
        self.assertEqual(resp.status_code, 401)  # authenticated_member() requires member role


if __name__ == "__main__":
    unittest.main()
