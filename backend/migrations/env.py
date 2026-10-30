from logging.config import fileConfig
from pathlib import Path
import sys

from alembic import context
from sqlalchemy import engine_from_config, pool, text

PROJECT_ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(PROJECT_ROOT))

from backend.database import ENGINE_URL
from backend.models import SQLModel
import backend.models  # noqa: F401 - register all model metadata

config = context.config
config.set_main_option("sqlalchemy.url", ENGINE_URL.replace("%", "%%"))
if config.config_file_name:
    fileConfig(config.config_file_name)

target_metadata = SQLModel.metadata


def run_migrations_offline():
    context.configure(
        url=ENGINE_URL,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online():
    connectable = engine_from_config(
        {"sqlalchemy.url": ENGINE_URL},
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        migration_lock = connection.dialect.name == "postgresql"
        if migration_lock:
            connection.execute(text("SELECT pg_advisory_lock(1380270925)"))
            # SQLAlchemy 2.x starts a transaction on the first statement. If it is left
            # open, Alembic treats it as an outer transaction it does not own, never
            # commits it, and everything the migration did is rolled back when the
            # connection closes - while still exiting with code 0. Commit it now; the
            # session-level advisory lock survives the commit.
            connection.commit()
        try:
            context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
            with context.begin_transaction():
                context.run_migrations()
            # Belt and braces: never let a finished migration be silently rolled back.
            if connection.in_transaction():
                connection.commit()
        finally:
            if migration_lock:
                if connection.in_transaction():
                    connection.rollback()
                connection.execute(text("SELECT pg_advisory_unlock(1380270925)"))
                connection.commit()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
