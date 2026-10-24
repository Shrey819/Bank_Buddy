"""
connection.py – SQLAlchemy sync engine + session factory for Bank_Buddy.

Uses the configured database URL with automatic fallback to local SQLite
if PostgreSQL is unreachable or times out.
"""

import os
import re
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, DeclarativeBase
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL: str = os.getenv(
    "AI_DATABASE_URL",
    os.getenv("DATABASE_URL", "sqlite:///ai_core/banking.db")
)

# Normalize postgresql prefix for psycopg2 if configured
normalized_url = DATABASE_URL
if normalized_url.startswith("postgresql://"):
    normalized_url = normalized_url.replace("postgresql://", "postgresql+psycopg2://", 1)
if "channel_binding=" in normalized_url:
    normalized_url = re.sub(r"[?&]channel_binding=[^&]+", "", normalized_url)

fallback_sqlite = False
engine = None

if "postgresql" in normalized_url:
    try:
        test_engine = create_engine(
            normalized_url,
            echo=False,
            pool_pre_ping=True,
            connect_args={"connect_timeout": 3}
        )
        with test_engine.connect() as conn:
            pass
        engine = test_engine
    except Exception as e:
        print(f"[DB Notice] Remote PostgreSQL connection failed or timed out: {e}")
        fallback_sqlite = True
else:
    fallback_sqlite = True

if fallback_sqlite or engine is None:
    db_file = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "banking.db"))
    print(f"[DB] Using local SQLite database at: {db_file}")
    sqlite_url = f"sqlite:///{db_file}"
    engine = create_engine(sqlite_url, echo=False)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

class Base(DeclarativeBase):
    """Shared declarative base for all Bank_Buddy ORM models."""
    pass

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
