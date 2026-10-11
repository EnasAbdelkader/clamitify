from __future__ import annotations

from datetime import timedelta
from typing import Any

from flask import Blueprint, jsonify
from flask_jwt_extended import create_access_token, get_jwt, get_jwt_identity, jwt_required

from .extensions import db
from .models import User, UserStats
from .utils import admin_required, audit, error, payload, required

bp = Blueprint("auth", __name__, url_prefix="/api")


def _token(user: User) -> str:
    return create_access_token(identity=user.email, additional_claims={"role": user.role})


@bp.post("/admin/login")
def admin_login():
    data = payload()
    if data is None:
        return error("بيانات تسجيل الدخول غير صحيحة", 422)
    email = data.get("email") if isinstance(data.get("email"), str) else ""
    password = data.get("password") if isinstance(data.get("password"), str) else ""
    user = db.session.query(User).filter_by(email=email.strip().lower()).first()
    if not user or user.role != "admin" or not user.check_password(password):
        return jsonify({"success": False, "error": "بريد إلكتروني أو كلمة مرور غير صحيحة"}), 401
    audit("login", "admin")
    db.session.commit()
    return jsonify({"success": True, "token": _token(user), "user": user.public()}), 200


@bp.post("/admin/change-password")
@admin_required
def change_password():
    data = payload()
    if data is None or not isinstance(data.get("currentPassword"), str) or not isinstance(data.get("newPassword"), str):
        return error("بيانات كلمة المرور غير صحيحة", 400)
    if len(data["newPassword"]) < 8:
        return error("يجب أن تتكون كلمة المرور الجديدة من 8 أحرف على الأقل", 422)
    user = db.session.query(User).filter_by(email=get_jwt_identity()).first()
    if not user or not user.check_password(data["currentPassword"]):
        return jsonify({"success": False, "message": "كلمة المرور الحالية غير صحيحة"}), 401
    user.set_password(data["newPassword"])
    audit("password_change", f"user:{user.id}")
    db.session.commit()
    return jsonify({"success": True, "message": "تم تحديث كلمة المرور بنجاح!"})


@bp.post("/auth/register")
def member_register():
    data = payload()
    if data is None:
        return error("بيانات التسجيل غير صحيحة", 422)
    message = required(data, ["name", "email", "password"])
    if message:
        return error(message, 422)
    email = data["email"].strip().lower()
    if "@" not in email or len(data["password"]) < 6:
        return error("البريد الإلكتروني أو كلمة المرور غير صحيحة", 422)
    if db.session.query(User).filter_by(email=email).first():
        return error("البريد الإلكتروني مستخدم بالفعل", 409)
    user = User(email=email, name=data["name"].strip(), role="member", password_hash="")
    user.set_password(data["password"])
    db.session.add(user)
    db.session.flush()
    db.session.add(UserStats(user_id=user.id))
    db.session.commit()
    return jsonify({"success": True, "token": _token(user), "user": user.public()}), 201


@bp.post("/auth/login")
def member_login():
    data = payload()
    email = data.get("email", "").strip().lower() if data else ""
    password = data.get("password", "") if data else ""
    user = db.session.query(User).filter_by(email=email, role="member").first()
    if not user or not user.check_password(password):
        return error("بريد إلكتروني أو كلمة مرور غير صحيحة", 401)
    return jsonify({"success": True, "token": _token(user), "user": user.public()}), 200
