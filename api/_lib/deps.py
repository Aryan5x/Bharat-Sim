"""Request dependencies: authentication, worker token check, simple rate limiting."""
from __future__ import annotations

import hmac
import time
from collections import defaultdict, deque
from dataclasses import dataclass

from fastapi import Header, HTTPException, Request

from .config import settings
from .supa import get_user

_TOKEN_CACHE: dict[str, tuple[float, dict]] = {}
_TOKEN_TTL = 60.0


@dataclass
class Caller:
    user_id: str
    email: str | None
    token: str


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Sign in first")
    token = authorization.split(" ", 1)[1].strip()
    if not token or len(token) > 4096:
        raise HTTPException(status_code=401, detail="Sign in first")
    return token


async def current_user(authorization: str | None = Header(default=None)) -> Caller:
    token = _bearer(authorization)
    now = time.monotonic()
    cached = _TOKEN_CACHE.get(token)
    if cached and now - cached[0] < _TOKEN_TTL:
        user = cached[1]
    else:
        user = await get_user(token)
        if not user or not user.get("id"):
            raise HTTPException(status_code=401, detail="Your session has expired. Sign in again")
        if len(_TOKEN_CACHE) > 2000:
            _TOKEN_CACHE.clear()
        _TOKEN_CACHE[token] = (now, user)
    return Caller(user_id=user["id"], email=user.get("email"), token=token)


def require_worker(authorization: str | None = Header(default=None)) -> None:
    expected = settings.worker_token
    if not expected or len(expected) < 32:
        raise HTTPException(status_code=503, detail="Worker access is not configured")
    token = _bearer(authorization)
    if not hmac.compare_digest(token.encode(), expected.encode()):
        raise HTTPException(status_code=401, detail="Invalid worker token")


class RateLimiter:
    """Per-instance sliding window. The database enforces the durable quotas."""

    def __init__(self, limit: int, window: float):
        self.limit = limit
        self.window = window
        self.hits: dict[str, deque] = defaultdict(deque)

    def check(self, key: str) -> None:
        now = time.monotonic()
        bucket = self.hits[key]
        while bucket and now - bucket[0] > self.window:
            bucket.popleft()
        if len(bucket) >= self.limit:
            raise HTTPException(status_code=429, detail="Too many requests. Try again in a minute")
        bucket.append(now)
        if len(self.hits) > 5000:
            self.hits.clear()


general_limiter = RateLimiter(limit=120, window=60)
sarvam_limiter = RateLimiter(limit=12, window=60)


def client_ip(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    return forwarded.split(",")[0].strip() or (request.client.host if request.client else "unknown")
