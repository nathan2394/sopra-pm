"""SQL Server connection helper for SOPRA PM.

Uses pymssql (sync driver) wrapped with asyncio.to_thread for async endpoints.
Connection pooling: reuse a single-thread ThreadPoolExecutor and open per-query
connections with a small internal reusable pool via contextvar.
"""
from __future__ import annotations

import asyncio
import contextlib
import os
from typing import Any, Iterable, Optional

import pymssql


def _config() -> dict:
    return {
        "server": os.environ["MSSQL_HOST"],
        "port": int(os.environ["MSSQL_PORT"]),
        "user": os.environ["MSSQL_USER"],
        "password": os.environ["MSSQL_PASSWORD"],
        "database": os.environ["MSSQL_DB"],
        "as_dict": True,
        "autocommit": True,
        "charset": "UTF-8",
        "login_timeout": 15,
        "timeout": 30,
    }


def _new_conn():
    return pymssql.connect(**_config())


def _run(fn, *args, **kwargs):
    """Run a sync DB callable in a worker thread."""
    return asyncio.to_thread(fn, *args, **kwargs)


# ---------------- Sync core primitives ----------------
def _fetch_all_sync(sql: str, params: Optional[Iterable] = None) -> list[dict]:
    with contextlib.closing(_new_conn()) as conn:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        return list(cur.fetchall())


def _fetch_one_sync(sql: str, params: Optional[Iterable] = None) -> Optional[dict]:
    with contextlib.closing(_new_conn()) as conn:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        return cur.fetchone()


def _execute_sync(sql: str, params: Optional[Iterable] = None) -> int:
    """Execute a non-query statement. Returns affected row count."""
    with contextlib.closing(_new_conn()) as conn:
        cur = conn.cursor()
        cur.execute(sql, params or ())
        return cur.rowcount


def _insert_returning_id_sync(sql: str, params: Optional[Iterable] = None) -> int:
    """Execute an INSERT and return SCOPE_IDENTITY() as int."""
    with contextlib.closing(_new_conn()) as conn:
        cur = conn.cursor()
        cur.execute(sql + "; SELECT CAST(SCOPE_IDENTITY() AS INT) AS Id", params or ())
        # SCOPE_IDENTITY sits on the next set
        while True:
            row = cur.fetchone()
            if row and row.get("Id") is not None:
                return int(row["Id"])
            if not cur.nextset():
                break
        raise RuntimeError("INSERT did not return SCOPE_IDENTITY")


def _executemany_sync(sql: str, seq_of_params: list) -> int:
    with contextlib.closing(_new_conn()) as conn:
        cur = conn.cursor()
        cur.executemany(sql, seq_of_params)
        return cur.rowcount


# ---------------- Async wrappers used by routes ----------------
async def fetch_all(sql: str, params: Optional[Iterable] = None) -> list[dict]:
    return await _run(_fetch_all_sync, sql, params)


async def fetch_one(sql: str, params: Optional[Iterable] = None) -> Optional[dict]:
    return await _run(_fetch_one_sync, sql, params)


async def execute(sql: str, params: Optional[Iterable] = None) -> int:
    return await _run(_execute_sync, sql, params)


async def insert_returning_id(sql: str, params: Optional[Iterable] = None) -> int:
    return await _run(_insert_returning_id_sync, sql, params)


async def executemany(sql: str, seq: list) -> int:
    return await _run(_executemany_sync, sql, seq)


async def ping() -> str:
    row = await fetch_one("SELECT @@VERSION AS V")
    return (row or {}).get("V", "")[:80]


# ---------------- Row helpers ----------------
def iso(dt) -> Optional[str]:
    """datetime | date | None -> ISO string."""
    if dt is None:
        return None
    if hasattr(dt, "isoformat"):
        return dt.isoformat()
    return str(dt)


def csv_split(s: Optional[str]) -> list[str]:
    if not s:
        return []
    return [x.strip() for x in s.split(",") if x.strip()]


def csv_join(items: Optional[list]) -> Optional[str]:
    if not items:
        return None
    return ",".join(items)
