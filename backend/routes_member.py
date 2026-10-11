from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from flask import Blueprint, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required

from .extensions import db
from .models import Bookmark, CarbonFootprint, Certificate, ContentItem, CourseProgress, EventRegistration, ImpactHistory, User, UserActivity, UserStats
from .services import add_activity, add_impact, get_or_create_member
from .utils import error, optional_user, payload, required, ticket_code

bp = Blueprint("member", __name__, url_prefix="/api/user")


def authenticated_member() -> User:
    """Get the authenticated member user. Requires valid JWT with member role."""
    user = optional_user()
    if user and user.role == "member":
        return user
    # This should not be reached if @jwt_required() is used on the endpoint
    # but we raise an error for safety
    from flask import abort
    abort(401, description="Member authentication required")


def profile(user: User):
    stats = user.stats or UserStats(user_id=user.id)
    if not user.stats:
        db.session.add(stats)
        db.session.flush()
    courses = db.session.query(CourseProgress, ContentItem).join(ContentItem, ContentItem.id == CourseProgress.course_id).filter(CourseProgress.user_id == user.id).all()
    registrations = db.session.query(EventRegistration, ContentItem).join(ContentItem, ContentItem.id == EventRegistration.event_id).filter(EventRegistration.user_id == user.id).all()
    return {"name": user.name, "email": "" if user.email == "guest@climatify.local" else user.email, "city": user.city, "bio": user.bio, "stats": {"ecoPoints": stats.eco_points, "virtualTrees": stats.virtual_trees, "earnedBadges": stats.earned_badges}, "recentActivities": [item.public() for item in db.session.query(UserActivity).filter_by(user_id=user.id).order_by(UserActivity.created_at.desc()).limit(20).all()], "registeredCourses": [{"id": item.id, "titleAr": item.data.get("titleAr", ""), "titleEn": item.data.get("titleEn", ""), "progress": progress.progress} for progress, item in courses], "registeredEvents": [{"id": item.id, "titleAr": item.data.get("titleAr", ""), "titleEn": item.data.get("titleEn", ""), "date": item.data.get("date", ""), "status": registration.status, "ticketCode": registration.ticket_code} for registration, item in registrations]}


@bp.get("/profile")
@jwt_required()
def get_profile():
    user = authenticated_member()
    result = profile(user)
    db.session.commit()
    return jsonify(result)


@bp.put("/profile")
@jwt_required()
def update_profile():
    data = payload()
    if data is None or (problem := required(data, ["name", "city", "bio"])):
        return error(problem or "بيانات الملف الشخصي غير صحيحة", 422)
    user = authenticated_member()
    user.name, user.city, user.bio = data["name"].strip(), data["city"].strip(), data["bio"].strip()
    db.session.commit()
    return jsonify({"success": True, "message": "تم تحديث الملف الشخصي بنجاح!"})


@bp.post("/carbon-footprint")
@jwt_required()
def carbon_footprint():
    data = payload()
    if data is None or not isinstance(data.get("footprint"), (int, float)) or data["footprint"] < 0:
        return error("قيمة البصمة الكربونية غير صحيحة", 422)
    user = authenticated_member()
    stats = user.stats or UserStats(user_id=user.id)
    user.stats = stats
    stats.eco_points = stats.eco_points or 0
    stats.eco_points += 50
    db.session.add(CarbonFootprint(user_id=user.id, footprint=float(data["footprint"])))
    add_impact(user.id, "carbon_footprint", float(data["footprint"]), {"unit": "tons_co2e_per_year"})
    add_activity(user.id, "حساب البصمة الكربونية", "Carbon Footprint Calculation", f"تم حساب بصمتك: {data['footprint']}", f"Calculated footprint: {data['footprint']}")
    db.session.commit()
    return jsonify({"success": True, "message": "تم حفظ النتيجة بنجاح!"})


@bp.post("/events")
@jwt_required()
def add_event():
    data = payload()
    if data is None or not isinstance(data.get("eventId"), str):
        return error("eventId is required", 422)
    user = authenticated_member()
    event = db.session.query(ContentItem).filter_by(kind="events", id=data["eventId"]).first()
    if not event:
        return error("Event not found", 404)
    existing = db.session.query(EventRegistration).filter_by(user_id=user.id, event_id=event.id, status="Confirmed").first()
    if not existing:
        code = ticket_code()
        db.session.add(EventRegistration(event_id=event.id, user_id=user.id, name=user.name or "Member", email=user.email, phone="", ticket_code=code))
        add_impact(user.id, "event_registration", 1, {"eventId": event.id, "ticketCode": code})
        db.session.commit()
    return jsonify({"success": True, "message": "تمت إضافة الفعالية بنجاح!"})


@bp.delete("/events/<event_id>")
@jwt_required()
def remove_event(event_id: str):
    user = authenticated_member()
    registration = db.session.query(EventRegistration).filter_by(user_id=user.id, event_id=event_id, status="Confirmed").first()
    if not registration:
        return error("Event registration not found", 404)
    registration.status = "Cancelled"
    add_impact(user.id, "event_cancellation", 0, {"eventId": event_id, "ticketCode": registration.ticket_code})
    db.session.commit()
    return jsonify({"success": True, "message": "تم إلغاء التسجيل بنجاح!"})


@bp.post("/courses/<course_id>/progress")
@jwt_required()
def course_progress(course_id: str):
    data = payload()
    if data is None or not isinstance(data.get("progress"), int) or not 0 <= data["progress"] <= 100:
        return error("Progress must be an integer from 0 to 100", 422)
    user = authenticated_member()
    course = db.session.query(ContentItem).filter_by(kind="courses", id=course_id).first()
    if not course:
        return error("Course not found", 404)
    row = db.session.get(CourseProgress, {"user_id": user.id, "course_id": course_id})
    previous = 0 if row is None else row.progress
    if row is None:
        row = CourseProgress(user_id=user.id, course_id=course_id, progress=data["progress"])
        db.session.add(row)
    else:
        row.progress = max(row.progress, data["progress"])
    if data["progress"] > previous:
        add_impact(user.id, "course_progress", data["progress"] - previous, {"courseId": course_id, "progress": data["progress"]})
    db.session.commit()
    return jsonify({"success": True, "message": "تم حفظ التقدم بنجاح!"})


@bp.post("/trees")
@jwt_required()
def trees():
    data = payload() or {}
    count = data.get("count", 1)
    if not isinstance(count, int) or count < 0:
        return error("count must be a positive integer", 422)
    user = authenticated_member()
    stats = user.stats or UserStats(user_id=user.id)
    user.stats = stats
    stats.virtual_trees = stats.virtual_trees or 0
    stats.virtual_trees += count
    add_impact(user.id, "tree_planting", count, {"count": count})
    db.session.commit()
    return jsonify({"success": True, "message": "تم حفظ عدد الأشجار بنجاح!"})


@bp.get("/impact")
@jwt_required()
def impact():
    year = request.args.get("year", str(datetime.now(timezone.utc).year))
    if not year.isdigit() or len(year) != 4:
        return error("year must be a four-digit year", 422)
    user = authenticated_member()
    history = db.session.query(ImpactHistory).filter_by(user_id=user.id).filter(db.func.strftime("%Y", ImpactHistory.created_at) == year).order_by(ImpactHistory.created_at.desc()).all()
    stats = user.stats or UserStats(user_id=user.id)
    stats.virtual_trees = stats.virtual_trees or 0
    stats.eco_points = stats.eco_points or 0
    footprint = db.session.query(db.func.coalesce(db.func.sum(CarbonFootprint.footprint), 0)).filter_by(user_id=user.id).scalar() or 0
    return jsonify({"year": year, "carbonFootprint": footprint, "trees": stats.virtual_trees, "ecoPoints": stats.eco_points, "history": [entry.public() for entry in history]})


BOOKMARK_TYPES = {"courses", "events", "posts", "programs", "opportunities", "initiatives"}


@bp.get("/bookmarks")
@jwt_required()
def list_bookmarks():
    user = authenticated_member()
    return jsonify([bookmark.public() for bookmark in db.session.query(Bookmark).filter_by(user_id=user.id).order_by(Bookmark.created_at.desc()).all()])


@bp.post("/bookmarks")
@jwt_required()
def add_bookmark():
    data = payload()
    if data is None or data.get("contentType") not in BOOKMARK_TYPES or not isinstance(data.get("contentId"), str):
        return error("contentType and contentId are required", 422)
    user = authenticated_member()
    if not db.session.query(ContentItem).filter_by(kind=data["contentType"], id=data["contentId"]).first():
        return error("Content not found", 404)
    if db.session.query(Bookmark).filter_by(user_id=user.id, content_type=data["contentType"], content_id=data["contentId"]).first():
        return error("Bookmark already exists", 409)
    bookmark = Bookmark(user_id=user.id, content_type=data["contentType"], content_id=data["contentId"])
    db.session.add(bookmark)
    db.session.commit()
    return jsonify(bookmark.public()), 201


@bp.delete("/bookmarks/<int:bookmark_id>")
@jwt_required()
def remove_bookmark(bookmark_id: int):
    user = authenticated_member()
    bookmark = db.session.query(Bookmark).filter_by(id=bookmark_id, user_id=user.id).first()
    if not bookmark:
        return error("Bookmark not found", 404)
    db.session.delete(bookmark)
    db.session.commit()
    return jsonify({"success": True})


@bp.get("/certificates")
@jwt_required()
def list_certificates():
    user = authenticated_member()
    certificates = db.session.query(Certificate).filter_by(user_id=user.id).order_by(Certificate.issued_at.desc()).all()
    return jsonify([cert.public() for cert in certificates])


@bp.get("/certificates/<course_id>")
@jwt_required()
def get_certificate(course_id: str):
    user = authenticated_member()
    cert = db.session.query(Certificate).filter_by(user_id=user.id, course_id=course_id).first()
    if not cert:
        return error("Certificate not found", 404)
    return jsonify(cert.public())


@bp.post("/courses/<course_id>/certificate")
@jwt_required()
def issue_certificate(course_id: str):
    user = authenticated_member()
    # Check if course exists
    course = db.session.query(ContentItem).filter_by(kind="courses", id=course_id).first()
    if not course:
        return error("Course not found", 404)
    # Check if user has completed the course (100% progress)
    progress = db.session.query(CourseProgress).filter_by(user_id=user.id, course_id=course_id).first()
    if not progress or progress.progress < 100:
        return error("Course not completed", 403)
    # Check if certificate already exists
    existing = db.session.query(Certificate).filter_by(user_id=user.id, course_id=course_id).first()
    if existing:
        return jsonify(existing.public()), 200
    # Generate unique certificate ID
    import secrets
    cert_id = f"CLM-{course_id.upper()}-{secrets.token_hex(4).upper()}"
    cert = Certificate(user_id=user.id, course_id=course_id, certificate_id=cert_id)
    db.session.add(cert)
    add_impact(user.id, "certificate_earned", 1, {"courseId": course_id, "certificateId": cert_id})
    db.session.commit()
    return jsonify(cert.public()), 201
