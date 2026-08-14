import os
from pathlib import Path
from sqlmodel import create_engine, SQLModel, Session

# Database URL configuration
DATABASE_URL = os.environ.get("DATABASE_URL")
IS_VERCEL = bool(os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"))

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
elif IS_VERCEL:
    # Serverless Vercel fallback if DATABASE_URL is not set yet in Vercel environment variables.
    # NOTE: /tmp SQLite storage is ephemeral on serverless platforms. For permanent persistence 
    # of company renames, PIN resets, and templates across deployments, set DATABASE_URL (e.g., PostgreSQL/Neon).
    tmp_db = Path("/tmp") / "rea_prod.db"
    DATABASE_URL = f"sqlite:///{tmp_db}"
    engine = create_engine(
        DATABASE_URL,
        connect_args={"check_same_thread": False},
        pool_pre_ping=True,
    )
else:
    # Local development & test SQLite database
    BASE_DIR = Path(__file__).resolve().parent
    DATABASE_FILE = BASE_DIR / "backend_data.db"
    DATABASE_URL = f"sqlite:///{DATABASE_FILE}"
    engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


from sqlmodel import text


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)

    # Run lightweight schema migrations for existing databases missing newly added columns
    try:
        with engine.begin() as conn:
            migrations = [
                "ALTER TABLE agent ADD COLUMN IF NOT EXISTS company_id INTEGER DEFAULT 1",
                "ALTER TABLE agent ADD COLUMN IF NOT EXISTS pin VARCHAR",
                "ALTER TABLE template ADD COLUMN IF NOT EXISTS company_id INTEGER DEFAULT 1",
                "ALTER TABLE template ADD COLUMN IF NOT EXISTS category_type VARCHAR DEFAULT 'tech_escalation'",
                "ALTER TABLE template ADD COLUMN IF NOT EXISTS category VARCHAR",
                "ALTER TABLE template ADD COLUMN IF NOT EXISTS subcategory VARCHAR",
                "ALTER TABLE company ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE",
            ]
            for statement in migrations:
                try:
                    conn.execute(text(statement))
                except Exception:
                    pass
    except Exception:
        pass


def ping_database(session: Session) -> bool:
    from sqlmodel import text
    try:
        session.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


def get_session():
    with Session(engine) as session:
        yield session
