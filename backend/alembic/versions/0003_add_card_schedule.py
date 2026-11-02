"""add card schedule

Revision ID: 0003
Revises: 0002
Create Date: 2026-11-01 21:21:32.364647

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | Sequence[str] | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "cards",
        sa.Column(
            "due_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
    )
    op.add_column(
        "cards",
        sa.Column("interval_days", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "cards", sa.Column("ease", sa.Double(), server_default="2.5", nullable=False)
    )
    op.add_column(
        "cards",
        sa.Column("repetitions", sa.Integer(), server_default="0", nullable=False),
    )
    op.drop_index(op.f("ix_cards_deck_id"), table_name="cards")
    op.create_index(
        "ix_cards_deck_id_due_at", "cards", ["deck_id", "due_at"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_cards_deck_id_due_at", table_name="cards")
    op.create_index(op.f("ix_cards_deck_id"), "cards", ["deck_id"], unique=False)
    op.drop_column("cards", "repetitions")
    op.drop_column("cards", "ease")
    op.drop_column("cards", "interval_days")
    op.drop_column("cards", "due_at")
