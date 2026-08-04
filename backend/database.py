from sqlmodel import create_engine, SQLModel, Session


DATABASE_URL = "sqlite:///./backend_data.db"

# For SQLite we need check_same_thread False
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})


def create_db_and_tables():
    SQLModel.metadata.create_all(engine)


def get_session():
    with Session(engine) as session:
        yield session
