"""Create/upgrade application schema and seed data once during deployment."""

from alembic import op
from sqlalchemy import inspect, text
from sqlmodel import Session, SQLModel

from backend import models  # noqa: F401 - populate metadata
from backend.services.seed_service import sync_default_data_if_needed

revision = "20261030_0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    existing_tables = set(inspect(bind).get_table_names())
    # Create tables absent from older databases, then add model columns that
    # were introduced after a table already existed.
    SQLModel.metadata.create_all(bind=bind, checkfirst=True)
    inspector = inspect(bind)
    for table in SQLModel.metadata.sorted_tables:
        if table.name not in existing_tables:
            continue
        existing_columns = {col["name"].lower() for col in inspector.get_columns(table.name)}
        for column in table.columns:
            if column.name.lower() in existing_columns:
                continue
            add_column = column.copy()
            # Existing rows must remain migratable when a newly added model
            # field has only an application-side default.
            add_column.nullable = True
            if column.default is not None and not callable(column.default.arg):
                value = column.default.arg
                if isinstance(value, bool):
                    add_column.server_default = text("true" if value else "false")
                elif isinstance(value, (int, float)):
                    add_column.server_default = text(str(value))
                elif isinstance(value, str):
                    add_column.server_default = text("'" + value.replace("'", "''") + "'")
            op.add_column(table.name, add_column)
    SQLModel.metadata.create_all(bind=bind, checkfirst=True)

    if "extractionrule" in set(inspect(bind).get_table_names()):
        rows = bind.execute(
            text("SELECT id, name FROM extractionrule WHERE result_field IS NULL OR result_field = ''")
        ).mappings().all()
        import re
        for row in rows:
            base_key = re.sub(r"[^a-z0-9]+", "_", (row["name"] or "extracted_value").strip().lower()).strip("_")
            bind.execute(
                text("UPDATE extractionrule SET result_field = :value WHERE id = :id"),
                {"value": f"{base_key or 'extracted_value'}_{row['id']}", "id": row["id"]},
            )

    with Session(bind=bind) as session:
        sync_default_data_if_needed(session)


def downgrade():
    # This is a baseline/adoption migration for existing installations. A
    # destructive downgrade could drop tenant data, so rollback is forward-only.
    pass
