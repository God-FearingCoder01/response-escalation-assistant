from fastapi import APIRouter
from sqlmodel import Session

from backend.database import engine, ping_database

router = APIRouter(tags=["Health"])


@router.get("/health")
def health_check():
    with Session(engine) as session:
        ping_database(session)
    return {"status": "ok", "database": "connected", "message": "Backend is ready"}
