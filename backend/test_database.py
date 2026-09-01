import os
import pytest
from unittest.mock import patch
from backend.database import get_database_url, ping_database, get_session
from sqlmodel import Session


def test_get_database_url_postgresql_conversion():
    env = {"DATABASE_URL": "postgres://user:secret@localhost:5432/readb"}
    with patch.dict(os.environ, env, clear=True):
        url, is_pg = get_database_url()
        assert url == "postgresql://user:secret@localhost:5432/readb"
        assert is_pg is True


def test_get_database_url_postgres_url_var():
    env = {"POSTGRES_URL": "postgresql://pguser:pgpass@neon.tech/prod_db"}
    with patch.dict(os.environ, env, clear=True):
        url, is_pg = get_database_url()
        assert url == "postgresql://pguser:pgpass@neon.tech/prod_db"
        assert is_pg is True


def test_get_database_url_sqlite_local_default():
    with patch.dict(os.environ, {}, clear=True):
        url, is_pg = get_database_url()
        assert url.startswith("sqlite:///")
        assert is_pg is False


def test_ping_database():
    from backend.database import engine
    with Session(engine) as session:
        assert ping_database(session) is True
