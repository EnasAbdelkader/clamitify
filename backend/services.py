from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from .extensions import db
from .models import AnalyticsEvent, ContentItem, ImpactHistory, User, UserActivity, UserStats
from .utils import audit


def record_analytics(event_type: str, path: str = "") -> None:
    db.session.add(AnalyticsEvent(event_type=event_type, path=path))


def get_or_create_member(email: str, name: str = "") -> User:
    user = db.session.query(User).filter_by(email=email.lower()).first()
    if user is None:
        user = User(email=email.lower(), name=name, role="member", password_hash="")
        db.session.add(user)
        db.session.flush()
        db.session.add(UserStats(user_id=user.id))
    if name and not user.name:
        user.name = name
    return user


def add_activity(user_id: int, title_ar: str, title_en: str, detail_ar: str, detail_en: str) -> None:
    db.session.add(UserActivity(id=f"activity-{datetime.now(timezone.utc).timestamp()}-{user_id}", user_id=user_id, title_ar=title_ar, title_en=title_en, detail_ar=detail_ar, detail_en=detail_en))


def add_impact(user_id: int, action_type: str, value: float = 0, metadata: dict[str, Any] | None = None) -> None:
    db.session.add(ImpactHistory(user_id=user_id, action_type=action_type, value=value, metadata_json=metadata or {}))


def content_response(item: ContentItem) -> dict[str, Any]:
    return item.public()


def log_mutation(action: str, resource: str) -> None:
    audit(action, resource)
