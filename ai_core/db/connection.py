"""
connection.py – SQLAlchemy sync engine + session factory for Bank_Buddy.

Uses the existing 'learnnode' PostgreSQL database.
Override DATABASE_URL via environment variable or a .env file.
"""

import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

# ---------------------------------------------------------------------------
# Database URL – falls back to the shared learnnode dev instance
# ---------------------------------------------------------------------------
DATABASE_URL: str = os.getenv(
    "DATABASE_URL",
    "postgresql://postgresdb:Yuhu123@localhost:5432/learnnode",
)

# ---------------------------------------------------------------------------
# Engine – pool_pre_ping ensures stale connections are recycled automatically
# ---------------------------------------------------------------------------
engine = create_engine(
    DATABASE_URL,
    echo=False,           # set to True for SQL debug output
    pool_pre_ping=True,   # reconnect on dropped connections
    pool_size=5,
    max_overflow=10,
)

# ---------------------------------------------------------------------------
# Session factory
# ---------------------------------------------------------------------------
SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

# ---------------------------------------------------------------------------
# Declarative base – all ORM models inherit from this
# ---------------------------------------------------------------------------
class Base(DeclarativeBase):
    """Shared declarative base for all Bank_Buddy ORM models."""
    pass


# ---------------------------------------------------------------------------
# FastAPI / dependency-injection compatible DB session provider
# ---------------------------------------------------------------------------
def get_db():
    """
    Yield a SQLAlchemy session and guarantee it is closed afterwards.

    Usage (FastAPI):
        @app.get("/")
        def route(db: Session = Depends(get_db)):
            ...
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
