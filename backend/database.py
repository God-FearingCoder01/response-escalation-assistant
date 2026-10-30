import os
import logging
import re
from pathlib import Path
from sqlmodel import create_engine, Session
from sqlalchemy import event
from sqlalchemy.pool import NullPool
from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

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
    is_prod = os.environ.get("ENVIRONMENT", "").lower() == "production" or is_vercel

    if raw_url:
        db_url = raw_url.strip()
        if db_url.startswith("postgres://"):
            db_url = db_url.replace("postgres://", "postgresql://", 1)
        is_pg = db_url.startswith("postgresql")
        return db_url, is_pg

    if is_prod:
        raise RuntimeError(
            "Production requires a PostgreSQL connection string. Set DATABASE_URL, POSTGRES_URL, "
            "POSTGRES_URL_NON_POOLING, or POSTGRESQL_URL."
        )

    # SQLite is for local development and tests only. Serverless /tmp storage
    # is ephemeral and must never silently replace the production database.
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

        if has_psycopg:
            engine_url = engine_url.replace("postgresql://", "postgresql+psycopg://", 1)
            driver_name = "psycopg"
        elif has_psycopg2:
            engine_url = engine_url.replace("postgresql://", "postgresql+psycopg2://", 1)
            driver_name = "psycopg2"
        else:
            driver_name = "unknown"
            logger.warning("Neither psycopg nor psycopg2 could be imported for PostgreSQL connection.")
    elif "psycopg2" in engine_url:
        driver_name = "psycopg2"
    elif "+psycopg" in engine_url:
        driver_name = "psycopg"
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
        # Keep connection details and credentials out of the public health response.
        diag["error"] = "Database connection failed; see server logs for details."
        return diag


def get_session():
    with Session(engine) as session:
        yield session
