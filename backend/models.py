from __future__ import annotations

from datetime import date, datetime, timezone
from typing import Any

from werkzeug.security import check_password_hash, generate_password_hash

from .extensions import db


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.Integer, primary_key=True)
    email = db.Column(db.String(255), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    name = db.Column(db.String(255), nullable=False, default="")
    city = db.Column(db.String(255), nullable=False, default="")
    bio = db.Column(db.Text, nullable=False, default="")
    role = db.Column(db.String(32), nullable=False, default="member", index=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    stats = db.relationship("UserStats", back_populates="user", uselist=False, cascade="all, delete-orphan")

    def set_password(self, value: str) -> None:
        self.password_hash = generate_password_hash(value)

    def check_password(self, value: str) -> bool:
        return bool(self.password_hash) and check_password_hash(self.password_hash, value)

    def public(self) -> dict[str, str]:
        return {"email": self.email, "role": self.role}


class ContentItem(db.Model):
    __tablename__ = "content_items"
    id = db.Column(db.String(64), primary_key=True)
    kind = db.Column(db.String(32), nullable=False, index=True)
    data = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)

    def public(self) -> dict[str, Any]:
        return {"id": self.id, **(self.data or {})}


class ContactMessage(db.Model):
    __tablename__ = "contact_messages"
    id = db.Column(db.Integer, primary_key=True)
    sender = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    subject = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    date = db.Column(db.Date, default=date.today, nullable=False)
    is_read = db.Column(db.Boolean, default=False, nullable=False)

    def public(self) -> dict[str, Any]:
        return {"id": str(self.id), "sender": self.sender, "email": self.email, "subject": self.subject, "message": self.message, "date": self.date.isoformat(), "isRead": self.is_read}


class FormSubmission(db.Model):
    __tablename__ = "form_submissions"
    id = db.Column(db.Integer, primary_key=True)
    kind = db.Column(db.String(40), nullable=False, index=True)
    email = db.Column(db.String(255), nullable=False, default="")
    payload = db.Column(db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class EventRegistration(db.Model):
    __tablename__ = "event_registrations"
    id = db.Column(db.Integer, primary_key=True)
    event_id = db.Column(db.String(64), db.ForeignKey("content_items.id"), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    name = db.Column(db.String(255), nullable=False)
    email = db.Column(db.String(255), nullable=False)
    phone = db.Column(db.String(64), nullable=False)
    ticket_code = db.Column(db.String(32), unique=True, nullable=False)
    status = db.Column(db.String(32), default="Confirmed", nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class UserStats(db.Model):
    __tablename__ = "user_stats"
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)
    eco_points = db.Column(db.Integer, default=0, nullable=False)
    virtual_trees = db.Column(db.Integer, default=0, nullable=False)
    earned_badges = db.Column(db.Integer, default=0, nullable=False)
    user = db.relationship("User", back_populates="stats")


class UserActivity(db.Model):
    __tablename__ = "user_activities"
    id = db.Column(db.String(64), primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    title_ar = db.Column(db.String(255), nullable=False)
    title_en = db.Column(db.String(255), nullable=False)
    detail_ar = db.Column(db.Text, nullable=False)
    detail_en = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    def public(self) -> dict[str, str]:
        return {"id": self.id, "titleAr": self.title_ar, "titleEn": self.title_en, "detailAr": self.detail_ar, "detailEn": self.detail_en}


class CourseProgress(db.Model):
    __tablename__ = "course_progress"
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), primary_key=True)
    course_id = db.Column(db.String(64), db.ForeignKey("content_items.id"), primary_key=True)
    progress = db.Column(db.Integer, default=0, nullable=False)


class Lesson(db.Model):
    __tablename__ = "lessons"
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.String(64), db.ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False, index=True)
    title_en = db.Column(db.String(255), nullable=False)
    title_ar = db.Column(db.String(255), nullable=False)
    description_en = db.Column(db.Text, nullable=False, default="")
    description_ar = db.Column(db.Text, nullable=False, default="")
    lesson_order = db.Column(db.Integer, nullable=False)
    duration = db.Column(db.String(80), nullable=False, default="")
    content_url = db.Column(db.String(500), nullable=False, default="")
    content_en = db.Column(db.Text, nullable=False, default="")
    content_ar = db.Column(db.Text, nullable=False, default="")
    is_published = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    updated_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), onupdate=lambda: datetime.now(timezone.utc), nullable=False)
    __table_args__ = (db.UniqueConstraint("course_id", "lesson_order", name="uq_lesson_course_order"),)

    def public(self) -> dict[str, Any]:
        return {
            "id": str(self.id), "courseId": self.course_id,
            "titleEn": self.title_en, "titleAr": self.title_ar,
            "descriptionEn": self.description_en, "descriptionAr": self.description_ar,
            "order": self.lesson_order, "duration": self.duration,
            "contentUrl": self.content_url, "contentEn": self.content_en,
            "contentAr": self.content_ar, "isPublished": self.is_published,
        }


class ImpactHistory(db.Model):
    __tablename__ = "impact_history"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    action_type = db.Column(db.String(80), nullable=False, index=True)
    value = db.Column(db.Float, nullable=False, default=0)
    metadata_json = db.Column("metadata", db.JSON, nullable=False, default=dict)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)

    def public(self) -> dict[str, Any]:
        return {"id": str(self.id), "type": self.action_type, "value": self.value, "metadata": self.metadata_json or {}, "timestamp": self.created_at.isoformat() + "Z"}


class CarbonFootprint(db.Model):
    __tablename__ = "carbon_footprints"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    footprint = db.Column(db.Float, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)


class Bookmark(db.Model):
    __tablename__ = "bookmarks"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    content_type = db.Column(db.String(40), nullable=False)
    content_id = db.Column(db.String(64), nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    __table_args__ = (db.UniqueConstraint("user_id", "content_type", "content_id", name="uq_user_bookmark"),)

    def public(self) -> dict[str, Any]:
        return {"id": str(self.id), "contentType": self.content_type, "contentId": self.content_id, "createdAt": self.created_at.isoformat() + "Z"}


class AdminSettings(db.Model):
    __tablename__ = "admin_settings"
    id = db.Column(db.Integer, primary_key=True, default=1)
    site_name = db.Column(db.String(255), nullable=False, default="Climatify")
    contact_email = db.Column(db.String(255), nullable=False, default="info@climatify-youth.com")
    enable_maintenance = db.Column(db.Boolean, nullable=False, default=False)

    def public(self) -> dict[str, Any]:
        return {"siteName": self.site_name, "contactEmail": self.contact_email, "enableMaintenance": self.enable_maintenance}


class AuditLog(db.Model):
    __tablename__ = "audit_logs"
    id = db.Column(db.Integer, primary_key=True)
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    action = db.Column(db.String(80), nullable=False)
    resource = db.Column(db.String(120), nullable=False)
    ip_address = db.Column(db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)


class AnalyticsEvent(db.Model):
    __tablename__ = "analytics_events"
    id = db.Column(db.Integer, primary_key=True)
    event_type = db.Column(db.String(80), nullable=False, index=True)
    path = db.Column(db.String(255), nullable=False, default="")
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)


class Certificate(db.Model):
    __tablename__ = "certificates"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    course_id = db.Column(db.String(64), db.ForeignKey("content_items.id", ondelete="CASCADE"), nullable=False, index=True)
    certificate_id = db.Column(db.String(64), unique=True, nullable=False, index=True)
    issued_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    __table_args__ = (db.UniqueConstraint("user_id", "course_id", name="uq_user_course_certificate"),)

    def public(self) -> dict[str, Any]:
        return {
            "id": str(self.id),
            "certificateId": self.certificate_id,
            "courseId": self.course_id,
            "userId": self.user_id,
            "issuedAt": self.issued_at.isoformat() + "Z",
        }


class Upload(db.Model):
    __tablename__ = "uploads"
    id = db.Column(db.Integer, primary_key=True)
    filename = db.Column(db.String(255), nullable=False)
    url = db.Column(db.String(500), nullable=False)
    content_type = db.Column(db.String(100), nullable=False)
    size = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
