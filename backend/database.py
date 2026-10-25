import os
import logging
import re
from pathlib import Path
from sqlmodel import create_engine, SQLModel, Session
from sqlalchemy import inspect, text, event
from sqlalchemy.pool import NullPool

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
    # On Vercel, the application directory is read-only; use /tmp if running without DATABASE_URL
    if is_vercel:
        database_file = Path("/tmp") / "backend_data.db"
    else:
        base_dir = Path(__file__).resolve().parent
        database_file = base_dir / "backend_data.db"
    return f"sqlite:///{database_file}", False


def get_engine_url(db_url: str) -> tuple[str, str]:
    """
    Adapts database URL for SQLAlchemy engine creation:
    1. If PostgreSQL, selects an installed driver (preferring psycopg v3, then psycopg2).
    2. Ensures sslmode=require for remote cloud PostgreSQL if not specified.
    Returns (engine_url, driver_name).
    """
    driver_name = "sqlite"
    engine_url = db_url

    if db_url.startswith("postgres://"):
        engine_url = db_url.replace("postgres://", "postgresql://", 1)

    if engine_url.startswith("postgresql://"):
        has_psycopg = False
        try:
            import psycopg  # noqa: F401
            has_psycopg = True
        except ImportError:
            pass

        has_psycopg2 = False
        try:
            import psycopg2  # noqa: F401
            has_psycopg2 = True
        except ImportError:
            pass

        if has_psycopg and not has_psycopg2:
            engine_url = engine_url.replace("postgresql://", "postgresql+psycopg://", 1)
            driver_name = "psycopg"
        elif has_psycopg2:
            engine_url = engine_url.replace("postgresql://", "postgresql+psycopg2://", 1)
            driver_name = "psycopg2"
        elif has_psycopg:
            engine_url = engine_url.replace("postgresql://", "postgresql+psycopg://", 1)
            driver_name = "psycopg"
        else:
            driver_name = "unknown"
            logger.warning("Neither psycopg nor psycopg2 could be imported for PostgreSQL connection.")
    elif "psycopg" in engine_url:
        driver_name = "psycopg"
    elif "psycopg2" in engine_url:
        driver_name = "psycopg2"
    elif engine_url.startswith("sqlite"):
        driver_name = "sqlite"

    # Enforce sslmode=require on cloud PostgreSQL if not explicitly specified
    if (
        engine_url.startswith("postgresql")
        and "localhost" not in engine_url
        and "127.0.0.1" not in engine_url
        and "sslmode=" not in engine_url
    ):
        sep = "&" if "?" in engine_url else "?"
        engine_url = f"{engine_url}{sep}sslmode=require"

    return engine_url, driver_name


DATABASE_URL, IS_POSTGRES = get_database_url()
IS_VERCEL = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))
ENGINE_URL, ACTIVE_DRIVER = get_engine_url(DATABASE_URL)

if IS_POSTGRES:
    if IS_VERCEL:
        # In serverless functions, use NullPool to prevent connection exhaustion
        engine = create_engine(
            ENGINE_URL,
            poolclass=NullPool,
            pool_pre_ping=True,
        )
    else:
        engine = create_engine(
            ENGINE_URL,
            pool_size=10,
            max_overflow=20,
            pool_recycle=300,
            pool_pre_ping=True,
        )
else:
    connect_args = {"check_same_thread": False, "timeout": 30} if ENGINE_URL.startswith("sqlite") else {}
    engine = create_engine(
        ENGINE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
    )
    if ENGINE_URL.startswith("sqlite"):
        @event.listens_for(engine, "connect")
        def set_sqlite_pragma(dbapi_connection, connection_record):
            try:
                cursor = dbapi_connection.cursor()
                cursor.execute("PRAGMA journal_mode=WAL;")
                cursor.execute("PRAGMA busy_timeout=10000;")
                cursor.close()
            except Exception:
                pass


def create_db_and_tables():
    """
    Creates all database tables using SQLModel metadata and executes
    dialect-agnostic column migrations for existing tables missing new attributes.
    """
    try:
        SQLModel.metadata.create_all(engine)
    except Exception as e:
        logger.exception("create_all failed: %s", e)
        raise

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
            ("agentuserdata", "custom_categories_json", "TEXT DEFAULT '[]'"),
            ("extractionrule", "result_field", "VARCHAR DEFAULT ''"),
            ("extractionrule", "extraction_method", "VARCHAR DEFAULT 'regex'"),
            ("extractionrule", "description", "TEXT"),
            ("extractionrule", "is_enabled", "BOOLEAN DEFAULT TRUE"),
            ("extractionrule", "company_id", "INTEGER DEFAULT 1"),
            ("extractionrule", "created_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
            ("extractionrule", "updated_at", "TIMESTAMP DEFAULT CURRENT_TIMESTAMP"),
        ]

        with engine.begin() as conn:
            for table_name, col_name, col_type in migrations:
                if table_name in existing_tables and not column_exists(table_name, col_name):
                    try:
                        conn.execute(text(f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"))
                    except Exception as e:
                        logger.warning("Column migration skipped for %s.%s: %s", table_name, col_name, e)

            # Older rule rows have a name but no result_field. Backfill a
            # stable key from the rule name so those rows remain usable and
            # can be edited after upgrading the schema.
            if "extractionrule" in existing_tables and column_exists("extractionrule", "result_field"):
                rows = conn.execute(
                    text("SELECT id, name, result_field FROM extractionrule WHERE result_field IS NULL OR result_field = ''")
                ).mappings().all()
                for row in rows:
                    base_key = re.sub(r"[^a-z0-9]+", "_", (row["name"] or "extracted_value").strip().lower()).strip("_")
                    result_field = f"{base_key or 'extracted_value'}_{row['id']}"
                    conn.execute(
                        text("UPDATE extractionrule SET result_field = :result_field WHERE id = :id"),
                        {"result_field": result_field, "id": row["id"]},
                    )
    except Exception as e:
        logger.exception("Error executing column migrations: %s", e)


def ping_database(session: Session) -> bool:
    from sqlmodel import select
    try:
        session.exec(select(1))
        return True
    except Exception as e:
        logger.warning("Database ping failed: %s", e)
        return False


def get_database_health() -> dict:
    """
    Returns diagnostics on database connectivity, driver, and configuration.
    """
    from sqlmodel import select
    has_configured_pg = bool(
        os.environ.get("DATABASE_URL")
        or os.environ.get("POSTGRES_URL")
        or os.environ.get("POSTGRES_URL_NON_POOLING")
        or os.environ.get("POSTGRESQL_URL")
    )
    masked_url = re.sub(r"://([^:]+):([^@]+)@", r"://\1:***@", ENGINE_URL)

    diag = {
        "status": "ok",
        "database": "connected",
        "is_postgres": IS_POSTGRES,
        "driver": ACTIVE_DRIVER,
        "is_vercel": IS_VERCEL,
        "database_url_configured": has_configured_pg,
        "engine_url_masked": masked_url,
    }
    try:
        with Session(engine) as session:
            session.exec(select(1))
        return diag
    except Exception as e:
        logger.exception("Database health ping failed: %s", e)
        diag["status"] = "error"
        diag["database"] = "unavailable"
        diag["error"] = str(e)
        return diag


def get_session():
    with Session(engine) as session:
        yield session


_db_initialized = False


def ensure_db_initialized():
    global _db_initialized
    if not _db_initialized:
        try:
            create_db_and_tables()
            from backend.services.seed_service import sync_default_data_if_needed
            with Session(engine) as session:
                sync_default_data_if_needed(session)
            _db_initialized = True
        except Exception as e:
            logger.exception("Failed to initialize database tables or seed data: %s", e)



