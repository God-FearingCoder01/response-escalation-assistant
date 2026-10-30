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
        try:
            context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
            with context.begin_transaction():
                context.run_migrations()
        finally:
            if migration_lock:
                connection.execute(text("SELECT pg_advisory_unlock(1380270925)"))


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
