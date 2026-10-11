from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.extensions import db
from backend.models import ContentItem, User
from backend.app import create_app


class ContractApiTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.app = create_app({"TESTING": True, "JWT_SECRET_KEY": "test-secret-that-is-at-least-32-bytes", "SQLALCHEMY_DATABASE_URI": f"sqlite:///{Path(self.tmp.name) / 'test.db'}"})
        self.client = self.app.test_client()
        with self.app.app_context():
            admin = User(email="admin@climatify.org", role="admin", password_hash=""); admin.set_password("password123"); db.session.add(admin); db.session.commit()
        body = self.client.post("/api/admin/login", json={"email": "admin@climatify.org", "password": "password123"}).get_json()
        self.headers = {"Authorization": f"Bearer {body['token']}"}

    def tearDown(self):
        with self.app.app_context(): db.session.remove(); db.engine.dispose()
        self.tmp.cleanup()

    def test_public_routes_are_json_and_lists(self):
        for path in ["programs", "initiatives", "events", "courses", "games", "opportunities", "posts", "team", "careers", "carbon-questions"]:
            response = self.client.get(f"/api/{path}")
            self.assertEqual(response.status_code, 200, path)
            self.assertIsInstance(response.get_json(), list)

    def test_admin_cms_crud_returns_full_entity(self):
        event = {"titleEn":"Test", "titleAr":"اختبار", "descriptionEn":"Description", "descriptionAr":"وصف", "date":"2026-12-01", "locationEn":"Dubai", "locationAr":"دبي", "categoryEn":"Education", "categoryAr":"التعليم"}
        created = self.client.post("/api/admin/events", headers=self.headers, json=event)
        self.assertEqual(created.status_code, 201); item = created.get_json(); self.assertEqual(item["registeredCount"], 0)
        updated = self.client.put(f"/api/admin/events/{item['id']}", headers=self.headers, json={"titleEn":"Updated"})
        self.assertEqual(updated.status_code, 200); self.assertEqual(updated.get_json()["titleEn"], "Updated")
        self.assertEqual(self.client.delete(f"/api/admin/events/{item['id']}", headers=self.headers).status_code, 200)

    def test_forms_and_authorization(self):
        response = self.client.post("/api/contact", json={"firstName":"A","lastName":"B","email":"a@example.com","subject":"Hi","message":"Hello"})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.client.get("/api/admin/messages").status_code, 401)
        self.assertEqual(self.client.get("/api/admin/messages", headers=self.headers).status_code, 200)


if __name__ == "__main__": unittest.main()
