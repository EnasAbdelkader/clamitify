from __future__ import annotations

import hashlib
from pathlib import Path
from typing import Any

from flask import Blueprint, current_app, jsonify, request, send_from_directory
from flask_jwt_extended import get_jwt_identity
from werkzeug.utils import secure_filename

from .extensions import db
from .models import ContentItem, Lesson, Upload
from .services import record_analytics
from .utils import admin_required, audit, error, payload, validate_url

bp = Blueprint("extra", __name__, url_prefix="/api")
ALLOWED = {"image/png": ".png", "image/jpeg": ".jpg", "image/webp": ".webp"}


def valid_image_bytes(content_type: str, raw: bytes) -> bool:
    signatures = {
        "image/png": raw.startswith(b"\x89PNG\r\n\x1a\n"),
        "image/jpeg": raw.startswith(b"\xff\xd8\xff"),
        "image/webp": raw.startswith(b"RIFF") and raw[8:12] == b"WEBP",
    }
    return signatures.get(content_type, False)


@bp.post("/upload")
@admin_required
def upload():
    file = request.files.get("file")
    if file is None or not file.filename: return error("Image file is required", 422)
    if file.mimetype not in ALLOWED: return error("Only PNG, JPEG, and WebP images are supported", 422)
    raw = file.read()
    if not raw or len(raw) > current_app.config["MAX_CONTENT_LENGTH"]: return error("Image must be smaller than 5 MB", 422)
    if not valid_image_bytes(file.mimetype, raw): return error("The uploaded file is not a valid image", 422)
    digest = hashlib.sha256(raw).hexdigest()[:24]
    folder: Path = current_app.config["UPLOAD_FOLDER"]; folder.mkdir(parents=True, exist_ok=True)
    filename = f"{digest}{ALLOWED[file.mimetype]}"; (folder / filename).write_bytes(raw)
    url = f"/api/uploads/{filename}"
    db.session.add(Upload(filename=filename, url=url, content_type=file.mimetype, size=len(raw))); audit("upload", filename); db.session.commit()
    return jsonify({"url": url})


@bp.get("/uploads/<path:filename>")
def uploaded_file(filename: str):
    safe_name = secure_filename(filename)
    path = Path(current_app.config["UPLOAD_FOLDER"]) / safe_name
    if not safe_name or not path.is_file(): return error("Uploaded file not found", 404)
    return send_from_directory(current_app.config["UPLOAD_FOLDER"], safe_name)


@bp.get("/curricula/download")
def curriculum():
    return jsonify({"url": "/static/climate-curriculum.pdf"})


@bp.get("/courses/<course_id>/lessons")
def lessons(course_id: str):
    course = db.session.query(ContentItem).filter_by(kind="courses", id=course_id).first()
    if not course: return error("Course not found", 404)
    lessons = db.session.query(Lesson).filter_by(course_id=course_id, is_published=True).order_by(Lesson.lesson_order).all()
    if lessons: return jsonify([lesson.public() for lesson in lessons])
    count = int(course.data.get("lessonsCount", 1)); titles = course.data.get("lessons", [])
    return jsonify(titles if isinstance(titles, list) and titles else [{"id": f"{course_id}-{i}", "courseId": course_id, "order": i, "titleEn": f"Training Module {i}", "titleAr": f"الوحدة التدريبية رقم {i}", "contentEn": "", "contentAr": ""} for i in range(1, count + 1)])


@bp.post("/ai/chat")
def ai_chat():
    data = payload()
    if data is None or not isinstance(data.get("prompt"), str) or data.get("language") not in {"ar", "en"}: return error("Prompt and language are required", 422)
    if not current_app.config.get("AI_PROVIDER_URL") or not current_app.config.get("AI_PROVIDER_KEY"):
        return error("AI service is not configured", 503)
    return error("AI provider integration is not enabled", 503)
