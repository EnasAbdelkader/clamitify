from __future__ import annotations

import tempfile
import unittest
from pathlib import Path

from backend.app import create_app
from backend.extensions import db


class RateLimitTests(unittest.TestCase):
    def test_api_requests_are_limited_with_retry_header(self):
        temporary = tempfile.TemporaryDirectory()
        app = create_app({"TESTING": True, "JWT_SECRET_KEY": "test-secret-that-is-at-least-32-bytes", "SQLALCHEMY_DATABASE_URI": f"sqlite:///{Path(temporary.name) / 'test.db'}", "RATE_LIMIT_PER_MINUTE": 1})
        client = app.test_client()
        self.assertEqual(client.get("/api/programs").status_code, 200)
        limited = client.get("/api/programs")
        self.assertEqual(limited.status_code, 429)
        self.assertEqual(limited.headers.get("Retry-After"), "60")
        with app.app_context():
            db.session.remove(); db.engine.dispose()
        temporary.cleanup()


if __name__ == "__main__":
    unittest.main()
