from __future__ import annotations

import os

from .app import create_app
from .extensions import db
from .models import ContentItem, User, UserStats


DEFAULTS = [
    ("programs", "digital-transformation", {"titleEn": "Digital Transformation", "titleAr": "التحول الرقمي", "descriptionEn": "Climate technology and digital services.", "descriptionAr": "خدمات التكنولوجيا والرقمنة المناخية.", "icon": "Monitor"}),
    ("events", "climate-action-day", {"titleEn": "Climate Action Day", "titleAr": "يوم العمل المناخي", "descriptionEn": "A community climate action event.", "descriptionAr": "فعالية مجتمعية للعمل المناخي.", "date": "2026-12-01", "locationEn": "Dubai", "locationAr": "دبي", "categoryEn": "Education", "categoryAr": "التعليم", "registeredCount": 0}),
    ("courses", "intro-climate-digitization", {"titleEn": "Introduction to Climate Digitization", "titleAr": "مقدمة في الرقمنة المناخية", "descriptionEn": "Learn the foundations of climate technology.", "descriptionAr": "تعلم أساسيات التكنولوجيا المناخية.", "instructorEn": "Climatify Academy", "instructorAr": "أكاديمية كلايمتيفاي", "durationEn": "4 weeks", "durationAr": "4 أسابيع", "lessonsCount": 3, "categoryEn": "Climate Tech", "categoryAr": "تكنولوجيا المناخ", "image": "/logo-dark.png"}),
    ("opportunities", "community-outreach", {"titleEn": "Community Outreach Volunteer", "titleAr": "متطوع للتوعية المجتمعية", "descriptionEn": "Join local climate education activities.", "descriptionAr": "شارك في أنشطة التوعية المناخية.", "typeEn": "Volunteering", "typeAr": "تطوع", "locationEn": "Dubai", "locationAr": "دبي", "postedDate": "2026-07-15"}),
]


def seed_content() -> None:
    app = create_app()
    with app.app_context():
        for kind, item_id, data in DEFAULTS:
            if not db.session.get(ContentItem, item_id): db.session.add(ContentItem(id=item_id, kind=kind, data=data))
        email = os.getenv("ADMIN_BOOTSTRAP_EMAIL", "admin@climatify.org").lower()
        password = os.getenv("ADMIN_BOOTSTRAP_PASSWORD")
        if password and not db.session.query(User).filter_by(email=email).first():
            user = User(email=email, role="admin", password_hash=""); user.set_password(password); db.session.add(user); db.session.flush(); db.session.add(UserStats(user_id=user.id))
        db.session.commit()


if __name__ == "__main__": seed_content()
