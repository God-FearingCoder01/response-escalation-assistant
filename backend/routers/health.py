import logging

from fastapi import APIRouter, HTTPException
from sqlmodel import Session

from backend.database import engine, ping_database

router = APIRouter(tags=["Health"])
logger = logging.getLogger("rea_health")


@router.get("/health")
def health_check():
    try:
        with Session(engine) as session:
            if not ping_database(session):
                raise HTTPException(status_code=503, detail={
                    "status": "error",
                    "database": "unavailable",
                    "message": "Database connection failed",
                })
        return {"status": "ok", "database": "connected", "message": "Backend is ready"}
    except HTTPException:
        raise
    except Exception:
        logger.exception("Health check could not connect to the database")
        raise HTTPException(status_code=503, detail={
            "status": "error",
            "database": "unavailable",
            "message": "Database connection failed",
        })
