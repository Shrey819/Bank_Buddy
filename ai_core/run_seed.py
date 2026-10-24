"""
Run this script once to:
1. Apply the database schema (schema.sql)
2. Seed demo data for customer C1001

Usage: python ai_core/run_seed.py
       (from the Bank_Buddy project root)
"""
import os
import sys
import psycopg2
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgresdb:Yuhu123@localhost:5432/learnnode')


def apply_schema() -> None:
    """Execute schema.sql against the configured Postgres database."""
    schema_path = Path(__file__).parent / 'db' / 'schema.sql'
    print(f'Applying schema from {schema_path}...')

    from urllib.parse import urlparse
    parsed = urlparse(DATABASE_URL)

    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port or 5432,
        user=parsed.username,
        password=parsed.password,
        dbname=parsed.path.lstrip('/')
    )
    conn.autocommit = True
    cur = conn.cursor()

    with open(schema_path, 'r') as f:
        sql = f.read()

    cur.execute(sql)
    print('Schema applied successfully.')
    cur.close()
    conn.close()


def run_seed() -> None:
    """Import and run the seed function from db/seed.py."""
    sys.path.insert(0, str(Path(__file__).parent))
    from db.seed import seed
    seed()


if __name__ == '__main__':
    print('=== Bank Buddy DB Setup ===')
    apply_schema()
    run_seed()
    print('=== Setup complete! ===')
    print('Start the AI core with: uvicorn main:app --host 127.0.0.1 --port 8000 --reload')
