"""Add agent.sort_order so administrators can choose the Welcome screen order."""

import sqlalchemy as sa
from alembic import op
from sqlalchemy import inspect, text

revision = "20261116_0002"
down_revision = "20261030_0001"
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = inspect(bind)
    if "agent" not in inspector.get_table_names():
        return  # a brand-new database: the first revision already created the column
    if "sort_order" in {col["name"].lower() for col in inspector.get_columns("agent")}:
        return  # already present, nothing to do

    op.add_column("agent", sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"))

    # Keep today's order: number each organization's agents by id, starting at 0.
    rows = bind.execute(text("SELECT id, company_id FROM agent ORDER BY company_id, id")).mappings().all()
    positions = {}
    for row in rows:
        position = positions.get(row["company_id"], 0)
        bind.execute(
            text("UPDATE agent SET sort_order = :position WHERE id = :id"),
            {"position": position, "id": row["id"]},
        )
        positions[row["company_id"]] = position + 1


def downgrade():
    bind = op.get_bind()
    columns = {col["name"].lower() for col in inspect(bind).get_columns("agent")}
    if "sort_order" in columns:
        op.drop_column("agent", "sort_order")
