from __future__ import annotations

import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()
BASE_DIR = Path(__file__).resolve().parent


def _resolve_db_path() -> str:
    """Resolve database path to absolute for production safety."""
    raw = os.getenv("DATABASE_URL", "").strip()
    if raw:
        if raw.startswith("sqlite:///") and not raw.startswith("sqlite:////"):
            # Relative sqlite path - make it absolute relative to BASE_DIR
            rel_path = raw[10:]  # strip "sqlite:///"
            abs_path = (BASE_DIR / rel_path).resolve()
            return f"sqlite:///{abs_path}"
        return raw
    # Default: absolute path in backend directory
    return f"sqlite:///{BASE_DIR / 'climatify.db'}"


class Config:
    SQLALCHEMY_DATABASE_URI = _resolve_db_path()
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    SQLALCHEMY_ENGINE_OPTIONS = {
        "pool_pre_ping": True,
        "connect_args": {"check_same_thread": False},
    }
    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(days=7)
    UPLOAD_FOLDER = Path(os.getenv("UPLOAD_FOLDER", str(BASE_DIR / "uploads")))
    MAX_CONTENT_LENGTH = 5 * 1024 * 1024
    AI_PROVIDER_URL = os.getenv("AI_PROVIDER_URL")
    AI_PROVIDER_KEY = os.getenv("AI_PROVIDER_KEY")
    FRONTEND_DIST = Path(os.getenv("FRONTEND_DIST", str(BASE_DIR.parent / "dist")))
    RATE_LIMIT_PER_MINUTE = int(os.getenv("RATE_LIMIT_PER_MINUTE", "120"))
    CORS_ORIGINS = [origin.strip() for origin in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://127.0.0.1:5173").split(",") if origin.strip()]
    TESTING = False


class TestConfig(Config):
    TESTING = True
    JWT_SECRET_KEY = "test-secret-that-is-at-least-32-bytes"
    SQLALCHEMY_DATABASE_URI = "sqlite:///:memory:"
