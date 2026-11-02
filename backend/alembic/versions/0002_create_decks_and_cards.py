"""create decks and cards

Revision ID: 0002
Revises: 0001
Create Date: 2026-11-01 21:09:13.904266

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | Sequence[str] | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "decks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("owner_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["owner_id"],
            ["users.id"],
            name=op.f("fk_decks_owner_id_users"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_decks")),
    )
    op.create_index(op.f("ix_decks_owner_id"), "decks", ["owner_id"], unique=False)
    op.create_table(
        "cards",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("deck_id", sa.Integer(), nullable=False),
        sa.Column("front", sa.Text(), nullable=False),
        sa.Column("back", sa.Text(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(
            ["deck_id"],
            ["decks.id"],
            name=op.f("fk_cards_deck_id_decks"),
            ondelete="CASCADE",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_cards")),
    )
    op.create_index(op.f("ix_cards_deck_id"), "cards", ["deck_id"], unique=False)


def downgrade() -> None:
    op.drop_index(op.f("ix_cards_deck_id"), table_name="cards")
    op.drop_table("cards")
    op.drop_index(op.f("ix_decks_owner_id"), table_name="decks")
    op.drop_table("decks")
