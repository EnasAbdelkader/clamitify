"""Initial Climatify backend schema.

This baseline uses the application's complete SQLAlchemy metadata so it can
bootstrap a fresh SQLite/PostgreSQL database while preserving pre-existing
local tables when upgrading the development database.
"""

from alembic import op

from backend.extensions import db

revision = "c07e2cb2d634"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    db.metadata.create_all(bind=op.get_bind())


def downgrade() -> None:
    # The baseline is intentionally non-destructive. Use an explicit database
    # backup/administrative migration for destructive teardown.
    pass
