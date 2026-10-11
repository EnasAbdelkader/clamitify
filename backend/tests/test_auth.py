from __future__ import annotations

import json
import tempfile
import unittest
from pathlib import Path

from flask_jwt_extended import create_access_token

from backend.app import User, create_app, db


class AuthenticationApiTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp_dir = tempfile.TemporaryDirectory()
        database_uri = f"sqlite:///{Path(self.temp_dir.name) / 'test.db'}"
        self.app = create_app({"TESTING": True, "JWT_SECRET_KEY": "test-secret-that-is-at-least-32-bytes", "SQLALCHEMY_DATABASE_URI": database_uri})
        self.client = self.app.test_client()
        with self.app.app_context():
            admin = User(email="admin@climatify.org", role="admin", password_hash="")
            admin.set_password("old-password")
            db.session.add(admin)
            db.session.commit()

    def tearDown(self) -> None:
        with self.app.app_context():
            db.session.remove()
            db.engine.dispose()
        self.temp_dir.cleanup()

    def test_login_returns_contract_compliant_jwt_with_admin_claims(self) -> None:
        response = self.client.post(
            "/api/admin/login",
            json={"email": "admin@climatify.org", "password": "old-password"},
        )
        body = response.get_json()

        self.assertEqual(response.status_code, 200)
        self.assertTrue(body["success"])
        self.assertEqual(body["user"], {"email": "admin@climatify.org", "role": "admin"})
        self.assertEqual(len(body["token"].split(".")), 3)
        self.assertIsInstance(json.loads(__import__("base64").urlsafe_b64decode(body["token"].split(".")[1] + "=="))["exp"], int)

    def test_invalid_credentials_use_uniform_401_response(self) -> None:
        response = self.client.post(
            "/api/admin/login",
            json={"email": "admin@climatify.org", "password": "wrong-password"},
        )
        self.assertEqual(response.status_code, 401)
        self.assertEqual(response.get_json()["success"], False)
        self.assertIn("error", response.get_json())

    def test_change_password_requires_auth_and_rotates_hash(self) -> None:
        missing = self.client.post(
            "/api/admin/change-password",
            json={"currentPassword": "old-password", "newPassword": "new-password"},
        )
        self.assertEqual(missing.status_code, 401)

        login = self.client.post(
            "/api/admin/login",
            json={"email": "admin@climatify.org", "password": "old-password"},
        )
        token = login.get_json()["token"]
        response = self.client.post(
            "/api/admin/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"currentPassword": "old-password", "newPassword": "new-password"},
        )
        self.assertEqual(response.status_code, 200)

        old_login = self.client.post(
            "/api/admin/login",
            json={"email": "admin@climatify.org", "password": "old-password"},
        )
        new_login = self.client.post(
            "/api/admin/login",
            json={"email": "admin@climatify.org", "password": "new-password"},
        )
        self.assertEqual(old_login.status_code, 401)
        self.assertEqual(new_login.status_code, 200)

    def test_valid_non_admin_token_is_forbidden(self) -> None:
        with self.app.app_context():
            token = create_access_token(identity="member@example.com", additional_claims={"role": "member"})
        response = self.client.post(
            "/api/admin/change-password",
            headers={"Authorization": f"Bearer {token}"},
            json={"currentPassword": "old-password", "newPassword": "new-password"},
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.get_json()["error"], "Admin privileges required")


if __name__ == "__main__":
    unittest.main()
