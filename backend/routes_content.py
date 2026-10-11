from __future__ import annotations

from typing import Any

from flask import Blueprint, jsonify

from .extensions import db
from .models import ContentItem, EventRegistration
from .utils import error

bp = Blueprint("content", __name__, url_prefix="/api")
KINDS = {"programs", "initiatives", "events", "courses", "games", "opportunities", "posts", "team", "careers", "carbon-questions"}


def _list(kind: str) -> list[dict[str, Any]]:
    return [item.public() for item in db.session.query(ContentItem).filter_by(kind=kind).order_by(ContentItem.created_at.desc()).all()]


@bp.get("/programs")
def programs(): return jsonify(_list("programs"))

@bp.get("/programs/<item_id>")
def program(item_id: str): return _detail("programs", item_id, "Program not found")

@bp.get("/initiatives")
def initiatives(): return jsonify(_list("initiatives"))

@bp.get("/events")
def events():
    values = _list("events")
    for value in values:
        value["registeredCount"] = db.session.query(EventRegistration).filter_by(event_id=value["id"], status="Confirmed").count()
    return jsonify(values)

@bp.get("/courses")
def courses(): return jsonify(_list("courses"))

@bp.get("/games")
def games(): return jsonify(_list("games"))

@bp.get("/opportunities")
def opportunities(): return jsonify(_list("opportunities"))

@bp.get("/posts")
def posts(): return jsonify(_list("posts"))

@bp.get("/posts/<item_id>")
def post(item_id: str): return _detail("posts", item_id, "Post not found")

@bp.get("/team")
def team(): return jsonify(_list("team"))

@bp.get("/careers")
def careers(): return jsonify(_list("careers"))

@bp.get("/carbon-questions")
def carbon_questions(): return jsonify(_list("carbon-questions"))


def _detail(kind: str, item_id: str, message: str):
    item = db.session.query(ContentItem).filter_by(kind=kind, id=item_id).first()
    return jsonify(item.public()) if item else error(message, 404)
