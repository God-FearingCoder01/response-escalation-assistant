import os
from pathlib import Path
from sqlmodel import create_engine, SQLModel, Session

# PostgreSQL is the sole production source of truth (via DATABASE_URL env var)
DATABASE_URL = os.environ.get("DATABASE_URL")
IS_PRODUCTION = os.environ.get("VERCEL_ENV") == "production" or os.environ.get("ENVIRONMENT") == "production"

if DATABASE_URL:
    # Standardize PostgreSQL dialect prefix for SQLAlchemy (postgres:// -> postgresql://)
    if DATABASE_URL.startswith("postgres://"):
        DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

    connect_args = {}
    if DATABASE_URL.startswith("sqlite"):
        connect_args = {"check_same_thread": False}

    engine = create_engine(
        DATABASE_URL,
        connect_args=connect_args,
        pool_pre_ping=True,
    )
elif IS_PRODUCTION:
    raise RuntimeError(
        "DATABASE_URL is missing. PostgreSQL must be configured as the sole production source of truth."
    )
else:
    # Local development & test SQLite database
    BASE_DIR = Path(__file__).resolve().parent
    DATABASE_FILE = BASE_DIR / "backend_data.db"
    DATABASE_URL = f"sqlite:///{DATABASE_FILE}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def ping_database(session: Session) -> bool:
    from sqlmodel import text
    session.execute(text("SELECT 1"))
    return True


def get_session():
    with Session(engine) as session:
        yield session
