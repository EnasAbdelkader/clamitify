from __future__ import annotations

from flask import Blueprint, jsonify

from .extensions import db
from .models import ContactMessage, ContentItem, EventRegistration, FormSubmission
from .services import add_impact, get_or_create_member, record_analytics
from .utils import error, payload, required, ticket_code, validate_date, validate_email, validate_time

bp = Blueprint("forms", __name__, url_prefix="/api")


def save_form(kind: str, data: dict, message: str):
    db.session.add(FormSubmission(kind=kind, email=data.get("email", ""), payload=data))
    record_analytics("form_submission", kind)
    db.session.commit()
    return jsonify({"success": True, "message": message}), 201


@bp.post("/contact")
def contact():
    data = payload()
    if data is None or (problem := required(data, ["firstName", "lastName", "email", "subject", "message"])): return error(problem or "بيانات الرسالة غير صحيحة", 422)
    if not validate_email(data["email"]): return error("البريد الإلكتروني غير صحيح", 422)
    db.session.add(ContactMessage(sender=f"{data['firstName'].strip()} {data['lastName'].strip()}", email=data["email"].strip(), subject=data["subject"].strip(), message=data["message"].strip()))
    return save_form("contact", data, "تم إرسال رسالتك بنجاح!")


@bp.post("/meetings")
def meetings():
    data = payload()
    if data is None or (problem := required(data, ["name", "email", "date", "time"])): return error(problem or "بيانات الموعد غير صحيحة", 422)
    if not isinstance(data.get("notes", ""), str): return error("Notes must be a string", 422)
    if not validate_email(data["email"]) or not validate_date(data["date"]) or not validate_time(data["time"]): return error("تحقق من البريد والتاريخ والوقت", 422)
    return save_form("meeting", data, "تم حجز الموعد بنجاح!")


@bp.post("/partnerships")
def partnerships():
    data = payload()
    if data is None or (problem := required(data, ["orgName", "orgType", "contactPerson", "email", "proposal"])): return error(problem or "بيانات الشراكة غير صحيحة", 422)
    if data["orgType"] not in {"corporate", "government", "ngo", "academic"} or not validate_email(data["email"]): return error("بيانات الشراكة غير صحيحة", 422)
    return save_form("partnership", data, "تم إرسال طلب الشراكة بنجاح!")


@bp.post("/workshops")
def workshops():
    data = payload()
    if data is None or (problem := required(data, ["institutionName", "city", "studentCount", "workshopType", "email"])): return error(problem or "بيانات الورشة غير صحيحة", 422)
    if data["workshopType"] not in {"climate-basics", "carbon-calculator", "ghaf-planting"} or not str(data["studentCount"]).isdigit() or not validate_email(data["email"]): return error("بيانات الورشة غير صحيحة", 422)
    return save_form("workshop", data, "تم تسجيل طلب ورشة العمل بنجاح!")


@bp.post("/events/register")
def event_register():
    data = payload()
    if data is None or (problem := required(data, ["eventId", "name", "email", "phone"])): return error(problem or "بيانات التسجيل غير صحيحة", 422)
    event = db.session.query(ContentItem).filter_by(kind="events", id=data["eventId"]).first()
    if not event: return error("Event not found", 404)
    if not validate_email(data["email"]): return error("البريد الإلكتروني غير صحيح", 422)
    if db.session.query(EventRegistration).filter_by(event_id=event.id, email=data["email"].strip().lower(), status="Confirmed").first(): return error("هذا البريد مسجل بالفعل في الفعالية", 409)
    member = get_or_create_member(data["email"], data["name"])
    ticket = ticket_code()
    db.session.add(EventRegistration(event_id=event.id, user_id=member.id, name=data["name"].strip(), email=data["email"].strip().lower(), phone=data["phone"].strip(), ticket_code=ticket))
    db.session.add(FormSubmission(kind="event_registration", email=data["email"].strip().lower(), payload=data))
    add_impact(member.id, "event_registration", 1, {"eventId": event.id, "ticketCode": ticket})
    record_analytics("event_registration", event.id)
    db.session.commit()
    return jsonify({"success": True, "message": "تم التسجيل في الفعالية بنجاح!", "ticketCode": ticket}), 201


@bp.post("/opportunities/apply")
def opportunity_apply():
    data = payload()
    if data is None or (problem := required(data, ["opportunityId", "name", "email", "portfolio", "coverLetter"])): return error(problem or "بيانات التقديم غير صحيحة", 422)
    if not validate_email(data["email"]): return error("البريد الإلكتروني غير صحيح", 422)
    if not db.session.query(ContentItem).filter_by(kind="opportunities", id=data["opportunityId"]).first(): return error("Opportunity not found", 404)
    return save_form("opportunity_application", data, "تم إرسال طلب التقديم بنجاح!")


@bp.post("/newsletter/subscribe")
def newsletter():
    data = payload()
    if data is None or not validate_email(data.get("email")): return error("البريد الإلكتروني غير صحيح", 422)
    existing = db.session.query(FormSubmission).filter_by(kind="newsletter", email=data["email"].strip().lower()).first()
    if existing: return jsonify({"success": True, "message": "تم الاشتراك في النشرة الإخبارية بنجاح!"})
    return save_form("newsletter", {"email": data["email"].strip().lower()}, "تم الاشتراك في النشرة الإخبارية بنجاح!")
