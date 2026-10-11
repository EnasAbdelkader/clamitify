from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

from .config import Config
from .extensions import db, jwt, migrate
from .rate_limit import RateLimiter
from .routes_admin import bp as admin_bp
from .routes_auth import bp as auth_bp
from .routes_content import bp as content_bp
from .routes_extra import bp as extra_bp
from .routes_forms import bp as forms_bp
from .routes_member import bp as member_bp

# Compatibility exports for existing backend integrations.
from .models import User
from .models import AnalyticsEvent


def create_app(test_config: dict[str, Any] | None = None) -> Flask:
    app = Flask(__name__, static_folder=None)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)
    if not app.config.get("JWT_SECRET_KEY"):
        if app.config.get("TESTING"):
            app.config["JWT_SECRET_KEY"] = "test-secret-that-is-at-least-32-bytes"
        else:
            raise RuntimeError("JWT_SECRET_KEY must be set outside testing")
    else:
        # In production, enforce minimum secret length to avoid InsecureKeyLengthWarning
        is_dev = app.config.get("FLASK_ENV") == "development" or app.config.get("ENVIRONMENT") == "development"
        if not is_dev and len(app.config["JWT_SECRET_KEY"]) < 32:
            raise RuntimeError("JWT_SECRET_KEY must be at least 32 characters in production")
    app.config["UPLOAD_FOLDER"] = Path(app.config["UPLOAD_FOLDER"])

    db.init_app(app)
    jwt.init_app(app)
    limiter = RateLimiter(app.config["RATE_LIMIT_PER_MINUTE"])
    migrate.init_app(app, db)
    CORS(app, resources={r"/api/*": {"origins": app.config["CORS_ORIGINS"]}}, methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"], allow_headers=["Content-Type", "Authorization"])

    app.register_blueprint(auth_bp)
    app.register_blueprint(content_bp)
    app.register_blueprint(forms_bp)
    app.register_blueprint(member_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(extra_bp)

    @app.before_request
    def protect_api_rate():
        if request.path.startswith("/api/") and request.method != "OPTIONS" and not limiter.allow(limiter.key()):
            return jsonify({"success": False, "error": "Too many requests"}), 429

    @app.after_request
    def json_errors(response):
        if response.status_code == 404 and request.path.startswith("/api/") and not response.is_json:
            return jsonify({"success": False, "error": "Resource not found"}), 404
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
        if response.status_code == 429:
            response.headers.setdefault("Retry-After", "60")
        if request.method == "GET" and request.path.startswith("/api/") and response.status_code < 500:
            db.session.add(AnalyticsEvent(event_type="page_view", path=request.path))
            db.session.commit()
        return response

    @jwt.unauthorized_loader
    def missing_token(_: str): return jsonify({"success": False, "error": "Authorization token required"}), 401

    @jwt.invalid_token_loader
    def invalid_token(_: str): return jsonify({"success": False, "error": "Invalid authorization token"}), 401

    @jwt.expired_token_loader
    def expired_token(_, __): return jsonify({"success": False, "error": "Authorization token has expired"}), 401

    @app.errorhandler(413)
    def too_large(_): return jsonify({"success": False, "error": "Uploaded file is too large"}), 413

    @app.errorhandler(405)
    def method_not_allowed(_): return jsonify({"success": False, "error": "Method not allowed"}), 405

    @app.errorhandler(500)
    def server_error(_):
        db.session.rollback()
        return jsonify({"success": False, "error": "A server error occurred"}), 500

    @app.route("/", defaults={"path": ""})
    @app.route("/<path:path>")
    def spa_fallback(path: str):
        if path.startswith("api/"):
            return jsonify({"success": False, "error": "Resource not found"}), 404
        dist: Path = Path(app.config["FRONTEND_DIST"])
        requested = dist / path if path else None
        if requested and requested.is_file():
            return send_from_directory(dist, path)
        index = dist / "index.html"
        if index.is_file():
            return send_from_directory(dist, "index.html")
        return jsonify({"success": False, "error": "Frontend build not found"}), 404

    if app.config.get("TESTING") or app.config.get("AUTO_CREATE_TABLES", False):
        with app.app_context():
            db.create_all()

    @app.cli.command("seed-admin")
    def seed_admin_command() -> None:
        from .seed import seed_content
        seed_content()

    return app


# The module-level app supports `flask --app backend.app run`; production must set the secret.
# Skip module-level app creation during test imports (pytest/unittest sets PYTEST_CURRENT_TEST or similar)
import sys
if "pytest" not in sys.modules and "unittest" not in sys.modules:
    if os.getenv("JWT_SECRET_KEY"):
        app = create_app()
    else:
        # Only allow fallback for local development, never in production
        if os.getenv("FLASK_ENV") == "development" or os.getenv("ENVIRONMENT") == "development":
            app = create_app({"JWT_SECRET_KEY": "development-only-change-this-secret-32-chars"})
        else:
            raise RuntimeError("JWT_SECRET_KEY must be set in production. Set FLASK_ENV=development for local dev fallback.")
else:
    # During tests, don't create module-level app; tests create their own via create_app()
    app = None  # type: ignore


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=int(os.getenv("PORT", "5000")))
