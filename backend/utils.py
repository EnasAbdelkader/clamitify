from __future__ import annotations

import re
import secrets
from datetime import date, datetime
from functools import wraps
from typing import Any, Callable, TypeVar, cast

from flask import jsonify, request
from flask_jwt_extended import get_jwt, get_jwt_identity, jwt_required, verify_jwt_in_request

from .extensions import db
from .models import AuditLog, User

View = TypeVar("View", bound=Callable[..., Any])
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
DATE_RE = re.compile(r"^\d{4}-\d{2}-\d{2}$")
TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def error(message: str, status: int, **extra: Any):
    return jsonify({"success": False, "error": message, **extra}), status


def payload() -> dict[str, Any] | None:
    value = request.get_json(silent=True)
    return value if isinstance(value, dict) else None


def required(data: dict[str, Any], fields: list[str]) -> str | None:
    missing = [field for field in fields if not isinstance(data.get(field), str) or not data[field].strip()]
    return f"Missing required fields: {', '.join(missing)}" if missing else None


def validate_email(value: Any) -> bool:
    return isinstance(value, str) and bool(EMAIL_RE.match(value.strip()))


def validate_date(value: Any) -> bool:
    if not isinstance(value, str) or not DATE_RE.match(value):
        return False
    try:
        date.fromisoformat(value)
        return True
    except ValueError:
        return False


def validate_time(value: Any) -> bool:
    return isinstance(value, str) and bool(TIME_RE.match(value))


def validate_url(value: Any) -> bool:
    return isinstance(value, str) and (value.startswith("https://") or value.startswith("/")) and not value.lower().startswith(("javascript:", "data:", "vbscript:", "file:"))


def admin_required(view: View) -> View:
    @wraps(view)
    @jwt_required()
    def guarded(*args: Any, **kwargs: Any):
        if get_jwt().get("role") != "admin":
            return error("Admin privileges required", 403)
        return view(*args, **kwargs)
    return cast(View, guarded)


def optional_user() -> User | None:
    try:
        verify_jwt_in_request(optional=True)
        identity = get_jwt_identity()
    except Exception:
        return None
    if identity:
        return db.session.query(User).filter_by(email=identity).first()
    return None


def audit(action: str, resource: str) -> None:
    actor = optional_user()
    db.session.add(AuditLog(actor_id=actor.id if actor else None, action=action, resource=resource, ip_address=request.remote_addr))


def ticket_code() -> str:
    return f"CLM-{secrets.token_hex(5).upper()}"


def slug_id() -> str:
    return secrets.token_urlsafe(8).replace("_", "-").replace("/", "-")
