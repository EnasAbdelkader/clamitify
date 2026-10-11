from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from .extensions import db
from .models import AdminSettings, AnalyticsEvent, AuditLog, ContentItem, ContactMessage, EventRegistration, FormSubmission, Lesson, Upload, User
from .schemas import ENTITY_FIELDS, validate_entity
from .utils import admin_required, audit, error, payload, slug_id, validate_date

bp = Blueprint("admin", __name__, url_prefix="/api/admin")
CMS_KINDS = set(ENTITY_FIELDS)


@bp.get("/settings")
@admin_required
def get_settings():
    settings = db.session.get(AdminSettings, 1)
    if settings is None:
        settings = AdminSettings(id=1)
        db.session.add(settings)
        db.session.commit()
    return jsonify(settings.public())


@bp.post("/settings")
@admin_required
def save_settings():
    data = payload()
    if data is None or not isinstance(data.get("siteName"), str) or not isinstance(data.get("contactEmail"), str) or not isinstance(data.get("enableMaintenance"), bool):
        return error("إعدادات الموقع غير صحيحة", 422)
    settings = db.session.get(AdminSettings, 1) or AdminSettings(id=1)
    settings.site_name = data["siteName"].strip()
    settings.contact_email = data["contactEmail"].strip()
    settings.enable_maintenance = data["enableMaintenance"]
    db.session.add(settings)
    audit("update", "settings")
    db.session.commit()
    return jsonify({"success": True})


@bp.get("/stats")
@admin_required
def stats():
    upcoming = db.session.query(ContentItem).filter_by(kind="events").count()
    published = db.session.query(ContentItem).filter_by(kind="posts").count()
    recent = db.session.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(5).all()
    return jsonify({"totalVisitors": str(db.session.query(AnalyticsEvent).count()), "activeMembers": str(db.session.query(User).filter_by(role="member").count()), "upcomingEvents": str(upcoming), "publishedPosts": str(published), "users": db.session.query(User).count(), "admins": db.session.query(User).filter_by(role="admin").count(), "contentItems": db.session.query(ContentItem).count(), "courses": db.session.query(ContentItem).filter_by(kind="courses").count(), "events": upcoming, "registrations": db.session.query(EventRegistration).count(), "contactMessages": db.session.query(ContactMessage).count(), "unreadMessages": db.session.query(ContactMessage).filter_by(is_read=False).count(), "formSubmissions": db.session.query(FormSubmission).count(), "uploads": db.session.query(Upload).count(), "auditLogs": db.session.query(AuditLog).count(), "analyticsEvents": db.session.query(AnalyticsEvent).count(), "recentActivities": [{"textAr": f"تم تنفيذ {item.action} على {item.resource}", "textEn": f"{item.action.title()} {item.resource}", "timeAr": item.created_at.strftime("%Y-%m-%d"), "timeEn": item.created_at.strftime("%Y-%m-%d")} for item in recent]})


@bp.get("/analytics")
@admin_required
def analytics():
    total = db.session.query(AnalyticsEvent).count()
    members = db.session.query(User).filter_by(role="member").count()
    registrations = db.session.query(EventRegistration).count()
    return jsonify([
        {"labelAr": "زيارات هذا الشهر", "labelEn": "Visits This Month", "value": str(total), "icon": "BarChart3"},
        {"labelAr": "مستخدمون جدد", "labelEn": "New Users", "value": str(members), "icon": "Users"},
        {"labelAr": "معدل التسجيل", "labelEn": "Registration Rate", "value": str(registrations), "icon": "TrendingUp"},
        {"labelAr": "تذاكر محجوزة", "labelEn": "Tickets Booked", "value": str(registrations), "icon": "Ticket"},
    ])


@bp.get("/analytics/traffic")
@admin_required
def traffic():
    start = request.args.get("startDate")
    end = request.args.get("endDate")
    if start and not validate_date(start) or end and not validate_date(end): return error("Date filters must use YYYY-MM-DD", 422)
    query = db.session.query(func.date(AnalyticsEvent.created_at), func.count(AnalyticsEvent.id)).filter(AnalyticsEvent.event_type == "page_view")
    if start: query = query.filter(func.date(AnalyticsEvent.created_at) >= start)
    if end: query = query.filter(func.date(AnalyticsEvent.created_at) <= end)
    rows = query.group_by(func.date(AnalyticsEvent.created_at)).order_by(func.date(AnalyticsEvent.created_at)).all()
    return jsonify([{"date": day, "visits": count} for day, count in rows])


@bp.get("/messages")
@admin_required
def messages(): return jsonify([message.public() for message in db.session.query(ContactMessage).order_by(ContactMessage.date.desc()).all()])


@bp.put("/messages/<int:message_id>/read")
@admin_required
def mark_message_read(message_id: int):
    message = db.session.get(ContactMessage, message_id)
    data = payload()
    if not message: return error("Message not found", 404)
    if data is None or not isinstance(data.get("isRead"), bool): return error("isRead must be a boolean", 422)
    message.is_read = data["isRead"]
    audit("update", f"message:{message_id}")
    db.session.commit()
    return jsonify({"success": True})


@bp.delete("/messages/<int:message_id>")
@admin_required
def delete_message(message_id: int):
    message = db.session.get(ContactMessage, message_id)
    if not message: return error("Message not found", 404)
    db.session.delete(message)
    audit("delete", f"message:{message_id}")
    db.session.commit()
    return jsonify({"success": True})


@bp.post("/courses/<course_id>/lessons")
@admin_required
def create_lesson(course_id: str):
    course = db.session.query(ContentItem).filter_by(kind="courses", id=course_id).first()
    data = payload()
    if not course: return error("Course not found", 404)
    if data is None or not isinstance(data.get("titleEn"), str) or not isinstance(data.get("titleAr"), str) or not isinstance(data.get("order"), int): return error("titleEn, titleAr, and order are required", 422)
    if data["order"] < 1 or db.session.query(Lesson).filter_by(course_id=course_id, lesson_order=data["order"]).first(): return error("Lesson order must be unique and positive", 422)
    lesson = Lesson(course_id=course_id, title_en=data["titleEn"].strip(), title_ar=data["titleAr"].strip(), description_en=data.get("descriptionEn", ""), description_ar=data.get("descriptionAr", ""), lesson_order=data["order"], duration=data.get("duration", ""), content_url=data.get("contentUrl", ""), content_en=data.get("contentEn", ""), content_ar=data.get("contentAr", ""), is_published=data.get("isPublished", True))
    db.session.add(lesson); audit("create", f"lesson:{course_id}"); db.session.commit(); return jsonify(lesson.public()), 201


@bp.put("/lessons/<int:lesson_id>")
@admin_required
def update_lesson(lesson_id: int):
    lesson = db.session.get(Lesson, lesson_id); data = payload()
    if not lesson: return error("Lesson not found", 404)
    if data is None: return error("Request body must be a JSON object", 400)
    fields = {"titleEn": "title_en", "titleAr": "title_ar", "descriptionEn": "description_en", "descriptionAr": "description_ar", "duration": "duration", "contentUrl": "content_url", "contentEn": "content_en", "contentAr": "content_ar", "isPublished": "is_published"}
    for key, attr in fields.items():
        if key in data: setattr(lesson, attr, data[key])
    if "order" in data:
        if not isinstance(data["order"], int) or data["order"] < 1: return error("Lesson order must be positive", 422)
        conflict = db.session.query(Lesson).filter(Lesson.course_id == lesson.course_id, Lesson.lesson_order == data["order"], Lesson.id != lesson.id).first()
        if conflict: return error("Lesson order must be unique", 422)
        lesson.lesson_order = data["order"]
    audit("update", f"lesson:{lesson_id}"); db.session.commit(); return jsonify(lesson.public())


@bp.delete("/lessons/<int:lesson_id>")
@admin_required
def delete_lesson(lesson_id: int):
    lesson = db.session.get(Lesson, lesson_id)
    if not lesson: return error("Lesson not found", 404)
    db.session.delete(lesson); audit("delete", f"lesson:{lesson_id}"); db.session.commit(); return jsonify({"success": True})


@bp.post("/<kind>")
@admin_required
def create_content(kind: str):
    if kind not in CMS_KINDS: return error("Resource not found", 404)
    data = payload()
    if data is None: return error("Request body must be a JSON object", 400)
    problem = validate_entity(kind, data)
    if problem: return error(problem, 422)
    item = ContentItem(id=slug_id(), kind=kind, data={key: value for key, value in data.items() if key != "id"})
    if kind == "events": item.data["registeredCount"] = 0
    db.session.add(item)
    audit("create", f"{kind}:{item.id}")
    db.session.commit()
    return jsonify(item.public()), 201


@bp.put("/<kind>/<item_id>")
@admin_required
def update_content(kind: str, item_id: str):
    if kind not in CMS_KINDS: return error("Resource not found", 404)
    item = db.session.query(ContentItem).filter_by(kind=kind, id=item_id).first()
    if not item: return error("Resource not found", 404)
    data = payload()
    if data is None: return error("Request body must be a JSON object", 400)
    merged = {**(item.data or {}), **data}
    problem = validate_entity(kind, merged)
    if problem: return error(problem, 422)
    item.data = {key: value for key, value in merged.items() if key not in {"id", "registeredCount"}}
    audit("update", f"{kind}:{item_id}")
    db.session.commit()
    return jsonify(item.public())


@bp.delete("/<kind>/<item_id>")
@admin_required
def delete_content(kind: str, item_id: str):
    if kind not in CMS_KINDS: return error("Resource not found", 404)
    item = db.session.query(ContentItem).filter_by(kind=kind, id=item_id).first()
    if not item: return error("Resource not found", 404)
    db.session.delete(item)
    audit("delete", f"{kind}:{item_id}")
    db.session.commit()
    return jsonify({"success": True})
