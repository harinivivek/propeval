"""Backfill report_date and set NOT NULL on reports.report_date

Revision ID: b7c2e9f1a4d3
Revises: 038e25c5619a
Create Date: 2026-05-14

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "b7c2e9f1a4d3"
down_revision: Union[str, None] = "038e25c5619a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        """
        UPDATE reports
        SET report_date = ((created_at AT TIME ZONE 'UTC')::date)
        WHERE report_date IS NULL
        """
    )
    op.alter_column(
        "reports",
        "report_date",
        existing_type=sa.Date(),
        nullable=False,
    )


def downgrade() -> None:
    op.alter_column(
        "reports",
        "report_date",
        existing_type=sa.Date(),
        nullable=True,
    )
