import logging

from fastapi import APIRouter, HTTPException

from backend.database import ensure_db_initialized, get_database_health

router = APIRouter(tags=["Health"])
logger = logging.getLogger("rea_health")


@router.get("/health")
def health_check():
    ensure_db_initialized()
    health = get_database_health()
    if health.get("status") != "ok":
        error_msg = health.get("error", "Database connection failed")
        logger.error("Health check failed: %s", error_msg)
        raise HTTPException(
            status_code=503,
            detail={
                "status": "error",
                "database": "unavailable",
                "message": f"Database connection failed: {error_msg}",
                "is_postgres": health.get("is_postgres", False),
                "driver": health.get("driver"),
                "is_vercel": health.get("is_vercel", False),
                "database_url_configured": health.get("database_url_configured", False),
                "hint": (
                    "Make sure DATABASE_URL or POSTGRES_URL is configured in your production environment variables (e.g. Neon, Supabase, Vercel Postgres)."
                    if not health.get("database_url_configured")
                    else "Verify that your PostgreSQL database credentials, host, and SSL settings are correct."
                ),
            },
        )
    return {
        "status": "ok",
        "database": "connected",
        "is_postgres": health.get("is_postgres", False),
        "driver": health.get("driver"),
        "message": "Backend is ready",
    }

