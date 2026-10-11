from __future__ import annotations

from typing import Any

from .utils import validate_date, validate_email, validate_time, validate_url

ENTITY_FIELDS: dict[str, list[str]] = {
    "programs": ["titleEn", "titleAr", "descriptionEn", "descriptionAr", "icon"],
    "initiatives": ["titleEn", "titleAr", "descriptionEn", "descriptionAr", "image", "categoryEn", "categoryAr", "progress", "targetEn", "targetAr"],
    "events": ["titleEn", "titleAr", "descriptionEn", "descriptionAr", "date", "locationEn", "locationAr", "categoryEn", "categoryAr"],
    "courses": ["titleEn", "titleAr", "descriptionEn", "descriptionAr", "instructorEn", "instructorAr", "durationEn", "durationAr", "lessonsCount", "categoryEn", "categoryAr", "image"],
    "posts": ["titleEn", "titleAr", "excerptEn", "excerptAr", "contentEn", "contentAr", "image", "date", "authorEn", "authorAr", "categoryEn", "categoryAr"],
    "opportunities": ["titleEn", "titleAr", "descriptionEn", "descriptionAr", "typeEn", "typeAr", "locationEn", "locationAr", "postedDate"],
    "team": ["nameEn", "nameAr", "roleEn", "roleAr", "image"],
}


def validate_entity(kind: str, data: dict[str, Any], partial: bool = False) -> str | None:
    required = [] if partial else ENTITY_FIELDS.get(kind, [])
    missing = [field for field in required if not isinstance(data.get(field), str) or not data[field].strip() if field not in {"progress", "lessonsCount"}]
    if missing:
        return f"Missing required fields: {', '.join(missing)}"
    if kind == "initiatives" and (not isinstance(data.get("progress"), (int, float)) or not 0 <= data["progress"] <= 100):
        return "Progress must be a number between 0 and 100"
    if kind == "courses" and (not isinstance(data.get("lessonsCount"), int) or data["lessonsCount"] < 1):
        return "Lessons count must be a positive integer"
    if "date" in data and not validate_date(data["date"]):
        return "Date must use YYYY-MM-DD format"
    if "postedDate" in data and not validate_date(data["postedDate"]):
        return "Posted date must use YYYY-MM-DD format"
    if "startDate" in data and data["startDate"] and not validate_date(data["startDate"]):
        return "Start date must use YYYY-MM-DD format"
    for key in ("image",):
        if key in data and not validate_url(data[key]):
            return "Image must be an https URL or a relative URL"
    if kind == "opportunities" and data.get("typeEn") not in {"Job", "Internship", "Volunteering"}:
        return "Opportunity type is invalid"
    if kind == "team" and ("borderColor" in data and not isinstance(data["borderColor"], str) or "gradient" in data and not isinstance(data["gradient"], str)):
        return "Team styling values must be strings"
    return None
