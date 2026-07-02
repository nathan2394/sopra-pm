"""Email + password authentication for SOPRA PM.

Accounts are admin-seeded: there is no self-service signup. An admin sets
Email + PasswordHash on a dbo.TeamMembers row via manage_users.py, and that
person can then log in at POST /api/auth/login to receive a JWT bearer token.
Every /api/* route (except /api/auth/login and /api/health) requires that
token via the Authorization: Bearer <token> header.
"""
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Optional

import bcrypt
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

JWT_SECRET = os.environ.get("JWT_SECRET", "")
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_MINUTES = int(os.environ.get("JWT_EXPIRE_MINUTES", str(60 * 24 * 7)))  # 7 days

if not JWT_SECRET:
    # Fail loud in real deployments — a missing secret must never silently
    # fall back to something guessable. Devs must set JWT_SECRET in backend/.env.
    raise RuntimeError(
        "JWT_SECRET is not set. Add JWT_SECRET=<a long random string> to backend/.env"
    )

bearer_scheme = HTTPBearer(auto_error=False)


# ---------------- Password hashing ----------------
def hash_password(plain_password: str) -> str:
    return bcrypt.hashpw(plain_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(plain_password: str, password_hash: str) -> bool:
    if not password_hash:
        return False
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), password_hash.encode("utf-8"))
    except ValueError:
        return False


# ---------------- JWT ----------------
def create_access_token(subject: int, email: Optional[str], role: Optional[str]) -> str:
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(subject),
        "email": email,
        "role": role,
        "iat": now,
        "exp": now + timedelta(minutes=JWT_EXPIRE_MINUTES),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def decode_access_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Session expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# ---------------- FastAPI dependency ----------------
async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
) -> dict:
    """Resolve the caller's dbo.TeamMembers row from the bearer token.

    Imports db lazily to avoid a circular import (db.py has no dependency on
    this module, but server.py imports both).
    """
    if credentials is None or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )

    payload = decode_access_token(credentials.credentials)
    user_id = payload.get("sub")
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    from db import fetch_one  # lazy import, see docstring

    row = await fetch_one("SELECT * FROM dbo.TeamMembers WHERE Id=%s", (int(user_id),))
    if not row or not row.get("PasswordHash"):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Account disabled")
    return row
