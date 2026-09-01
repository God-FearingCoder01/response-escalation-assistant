import os
import logging
from pathlib import Path
from sqlmodel import create_engine, SQLModel, Session
from sqlalchemy import inspect, text

logger = logging.getLogger("rea_database")


def get_database_url() -> tuple[str, bool]:
    """
    Resolves the active database URL and returns (db_url, is_postgres).
    Checks DATABASE_URL, POSTGRES_URL, POSTGRES_URL_NON_POOLING, and POSTGRESQL_URL.
    """
    raw_url = (
        os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL")
        or os.environ.get("POSTGRES_URL_NON_POOLING")
        or os.environ.get("POSTGRESQL_URL")
    )
    is_vercel = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))
    is_prod = os.environ.get("ENVIRONMENT") == "production" or is_vercel

    if raw_url:
        db_url = raw_url.strip()
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        is_pg = db_url.startswith("postgresql")
        return db_url, is_pg

    if is_prod:
        logger.warning(
            "Production environment detected but no PostgreSQL connection string (DATABASE_URL or POSTGRES_URL) was found. "
            "For permanent production persistence across deployments, please set DATABASE_URL (e.g. Neon, Supabase, Vercel Postgres)."
        )

    # Local development & test SQLite database
    BASE_DIR = Path(__file__).resolve().parent
    DATABASE_FILE = BASE_DIR / "backend_data.db"
    return f"sqlite:///{DATABASE_FILE}", False


DATABASE_URL, IS_POSTGRES = get_database_url()
IS_VERCEL = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))

if IS_POSTGRES:
    engine = create_engine(
        DATABASE_URL,
        pool_size=10,
        max_overflow=20,
        pool_recycle=300,
        pool_pre_ping=True,
    )
else:
    connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
    )


def create_db_and_tables():
    """
    Creates all database tables using SQLModel metadata and executes
    dialect-agnostic column migrations for existing tables missing new attributes.
    """
    SQLModel.metadata.create_all(engine)

    try:
        inspector = inspect(engine)
        existing_tables = set(inspector.get_table_names())

        def column_exists(table_name: str, col_name: str) -> bool:
            if table_name not in existing_tables:
                return False
            columns = [c["name"].lower() for c in inspector.get_columns(table_name)]
            return col_name.lower() in columns

        migrations = [
            ("agent", "company_id", "INTEGER DEFAULT 1"),
            ("agent", "pin", "VARCHAR"),
            ("agent", "is_active", "BOOLEAN DEFAULT TRUE"),
            ("template", "company_id", "INTEGER DEFAULT 1"),
            ("template", "category_type", "VARCHAR DEFAULT 'tech_escalation'"),
            ("template", "category", "VARCHAR"),
            ("template", "subcategory", "VARCHAR"),
            ("template", "placeholder_config", "VARCHAR"),
            ("company", "is_active", "BOOLEAN DEFAULT TRUE"),
            ("company", "reporting_week_start", "VARCHAR DEFAULT 'Monday'"),
            ("company", "logo_url", "TEXT"),
            ("suggestion", "company_id", "INTEGER DEFAULT 1"),
            ("suggestion", "suggested_by_name", "VARCHAR DEFAULT 'Support Agent'"),
            ("suggestion", "suggested_by_initials", "VARCHAR DEFAULT 'SA'"),
            ("suggestion", "status", "VARCHAR DEFAULT 'pending'"),
            ("suggestion", "created_at", "TIMESTAMP"),
            ("suggestion", "updated_at", "TIMESTAMP"),
        ]

        with engine.begin() as conn:
            for table_name, col_name, col_type in migrations:
                if table_name in existing_tables and not column_exists(table_name, col_name):
                    try:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                    except Exception:
                        pass
    except Exception:
        pass


def ping_database(session: Session) -> bool:
    from sqlmodel import select
    try:
        session.exec(select(1))
        return True
    except Exception:
        return False


def get_session():
    with Session(engine) as session:
        yield session

