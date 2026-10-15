"""
connection.py — Database connection handler

Supports two backends:
  - SQLite: for local development (no Snowflake account needed)
  - Snowflake: for SPCS deployment and production

The backend is selected via the DATA_BACKEND environment variable.
When running inside SPCS, Snowflake automatically mounts an OAuth token
at /snowflake/session/token — no credentials needed in environment variables.
"""

import os
import snowflake.connector
import sqlite3
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DATA_BACKEND = os.getenv("DATA_BACKEND", "sqlite")


# ── SQLite connection (local development) ─────────────────────────────────────

def get_sqlite_connection():
    """Returns a SQLite connection to the local Gold database."""
    db_path = os.getenv("SQLITE_PATH", "../data/novacart_gold.db")
    db_path = Path(__file__).parent / db_path
    if not db_path.exists():
        raise FileNotFoundError(
            f"SQLite database not found at {db_path}. "
            "Make sure novacart_gold.db is in the data/ folder."
        )
    conn = sqlite3.connect(str(db_path))
    conn.row_factory = sqlite3.Row  # allows dict-like access to columns
    return conn


# ── Snowflake connection ──────────────────────────────────────────────────────

def get_snowflake_connection():
    """
    Returns a Snowflake connection.

    When running inside SPCS: uses the OAuth token mounted at /snowflake/session/token.
    When running locally: uses keypair authentication from environment variables.
    """
    import snowflake.connector
    from cryptography.hazmat.primitives import serialization

    token_path = "/snowflake/session/token"

    # SPCS mode — OAuth token mounted by the platform
    if Path(token_path).exists():
        token = Path(token_path).read_text("ascii")
        return snowflake.connector.connect(
            account=os.getenv("SNOWFLAKE_ACCOUNT"),
            host=os.getenv("SNOWFLAKE_HOST"),
            authenticator="oauth",
            token=token,
            database=os.getenv("SNOWFLAKE_DATABASE"),
            schema=os.getenv("SNOWFLAKE_SCHEMA"),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
        )
    
    account = os.getenv("SNOWFLAKE_ACCOUNT")

    # The connector sometimes mis-derives the host from a "<locator>.<region>"
    # style account identifier (it can land on a dead *.PUBLIC.* load-balancer
    # hostname instead of the real one). Passing host explicitly sidesteps that.
    host = os.getenv("SNOWFLAKE_HOST") or f"{account}.snowflakecomputing.com"

    # Local mode — password auth (simplest, no keypair registration needed)
    password = os.getenv("SNOWFLAKE_PASSWORD")
    if password:
        return snowflake.connector.connect(
            account=account,
            host=host,
            user=os.getenv("SNOWFLAKE_USERNAME"),
            password=password,
            role=os.getenv("SNOWFLAKE_ROLE"),
            warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
            database=os.getenv("SNOWFLAKE_DATABASE"),
            schema=os.getenv("SNOWFLAKE_SCHEMA"),
        )

    # Local mode — keypair authentication (fallback if no password given)
    from cryptography.hazmat.primitives import serialization

    private_key_path = os.getenv("SNOWFLAKE_PRIVATE_KEY_PATH")
    if not private_key_path:
        raise ValueError(
            "Either SNOWFLAKE_PASSWORD or SNOWFLAKE_PRIVATE_KEY_PATH is required "
            "for local Snowflake connections. See .env.example for setup instructions."
        )

    # Local mode — keypair authentication
    private_key_path = os.getenv("SNOWFLAKE_PRIVATE_KEY_PATH")
    if not private_key_path:
        raise ValueError(
            "SNOWFLAKE_PRIVATE_KEY_PATH is required for local Snowflake connections. "
            "See .env.example for setup instructions."
        )

    with open(private_key_path, "rb") as key_file:
        private_key = serialization.load_pem_private_key(key_file.read(), password=None)

    private_key_bytes = private_key.private_bytes(
        encoding=serialization.Encoding.DER,
        format=serialization.PrivateFormat.PKCS8,
        encryption_algorithm=serialization.NoEncryption(),
    )

    return snowflake.connector.connect(
        account=os.getenv("SNOWFLAKE_ACCOUNT"),
        user=os.getenv("SNOWFLAKE_USERNAME"),
        private_key=private_key_bytes,
        role=os.getenv("SNOWFLAKE_ROLE"),
        warehouse=os.getenv("SNOWFLAKE_WAREHOUSE"),
        database=os.getenv("SNOWFLAKE_DATABASE"),
        schema=os.getenv("SNOWFLAKE_SCHEMA"),
    )


# ── Public interface ──────────────────────────────────────────────────────────

def get_connection():
    """
    Returns the appropriate database connection based on DATA_BACKEND.
    Use this in all route handlers.

    Example:
        conn = get_connection()
        results = execute_query(conn, "SELECT * FROM fact_orders LIMIT 10")
    """
    if DATA_BACKEND == "snowflake":
        return get_snowflake_connection()
    return get_sqlite_connection()


def execute_query(conn, query: str, params: tuple = ()) -> list[dict]:
    """
    Executes a query and returns results as a list of dicts.
    Works with both SQLite and Snowflake connections.

    Args:
        conn: database connection (SQLite or Snowflake)
        query: SQL query string
        params: query parameters (use ? for SQLite, %s for Snowflake)

    Returns:
        list of dicts, one per row
    """
    if DATA_BACKEND == "snowflake":
        cursor = conn.cursor(snowflake.connector.DictCursor)
        cursor.execute(query, params)
        rows = cursor.fetchall()
        cursor.close()
        # Snowflake returns uppercase keys — normalize to lowercase
        return [{k.lower(): v for k, v in row.items()} for row in rows]
    else:
        cursor = conn.execute(query, params)
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
