import os
from pathlib import Path
from sqlmodel import create_engine, SQLModel, Session

# Priority 1: External Production Database URL (PostgreSQL / Supabase / Neon / Turso / Railway)
DATABASE_URL = os.environ.get("DATABASE_URL")

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
elif os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
    # Priority 2: Ephemeral serverless fallback with Cloud Persistence Sync
    DATABASE_FILE = Path("/tmp/backend_data.db")
    DATABASE_URL = f"sqlite:///{DATABASE_FILE}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
else:
    # Priority 3: Local SQLite database
    BASE_DIR = Path(__file__).resolve().parent
    DATABASE_FILE = BASE_DIR / "backend_data.db"
    DATABASE_URL = f"sqlite:///{DATABASE_FILE}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
