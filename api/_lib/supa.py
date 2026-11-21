"""Thin Supabase REST client.

Two modes:
- as_user(token): PostgREST calls carry the caller's JWT, so row-level
  security decides what they can see and change.
- service: calls carry the server-only secret key and bypass RLS. Used only
  for the worker queue, storage signing and writing results.
"""
from __future__ import annotations

from typing import Any

import httpx

from .config import settings


class SupabaseError(Exception):
    def __init__(self, status: int, message: str, code: str | None = None):
        super().__init__(message)
        self.status = status
        self.message = message
        self.code = code


_client: httpx.AsyncClient | None = None


def client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(timeout=httpx.Timeout(20.0, connect=8.0))
    return _client


def _user_headers(token: str) -> dict[str, str]:
    return {"apikey": settings.supabase_publishable_key, "Authorization": f"Bearer {token}"}


def _service_headers() -> dict[str, str]:
    if not settings.supabase_secret_key:
        raise SupabaseError(503, "Server is missing SUPABASE_SECRET_KEY")
    return {"apikey": settings.supabase_secret_key, "Authorization": f"Bearer {settings.supabase_secret_key}"}


def _raise_for(resp: httpx.Response) -> None:
    if resp.status_code < 400:
        return
    try:
        body = resp.json()
    except ValueError:
        body = {"message": resp.text[:300]}
    message = body.get("message") or body.get("error_description") or body.get("error") or "Database error"
    raise SupabaseError(resp.status_code, str(message), body.get("code"))


class Rest:
    def __init__(self, headers: dict[str, str]):
        self.headers = headers
        self.base = f"{settings.supabase_url}/rest/v1"

    async def select(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        resp = await client().get(f"{self.base}/{table}", params=params, headers=self.headers)
        _raise_for(resp)
        return resp.json()

    async def insert(self, table: str, row: dict[str, Any] | list[dict[str, Any]], upsert: str | None = None) -> list[dict[str, Any]]:
        headers = {**self.headers, "Prefer": "return=representation"}
        params = {}
        if upsert:
            headers["Prefer"] += ",resolution=merge-duplicates"
            params["on_conflict"] = upsert
        resp = await client().post(f"{self.base}/{table}", json=row, params=params, headers=headers)
        _raise_for(resp)
        return resp.json()

    async def update(self, table: str, params: dict[str, str], values: dict[str, Any]) -> list[dict[str, Any]]:
        headers = {**self.headers, "Prefer": "return=representation"}
        resp = await client().patch(f"{self.base}/{table}", params=params, json=values, headers=headers)
        _raise_for(resp)
        return resp.json()

    async def delete(self, table: str, params: dict[str, str]) -> list[dict[str, Any]]:
        headers = {**self.headers, "Prefer": "return=representation"}
        resp = await client().delete(f"{self.base}/{table}", params=params, headers=headers)
        _raise_for(resp)
        return resp.json()

    async def rpc(self, fn: str, args: dict[str, Any]) -> Any:
        resp = await client().post(f"{self.base}/rpc/{fn}", json=args, headers=self.headers)
        _raise_for(resp)
        return resp.json()


def as_user(token: str) -> Rest:
    return Rest(_user_headers(token))


def service() -> Rest:
    return Rest(_service_headers())


async def get_user(token: str) -> dict[str, Any] | None:
    resp = await client().get(f"{settings.supabase_url}/auth/v1/user", headers=_user_headers(token))
    if resp.status_code != 200:
        return None
    return resp.json()


# ---- storage (service only) ----

async def storage_object_info(bucket: str, path: str) -> dict[str, Any] | None:
    resp = await client().get(
        f"{settings.supabase_url}/storage/v1/object/info/{bucket}/{path}", headers=_service_headers()
    )
    if resp.status_code == 200:
        return resp.json()
    if resp.status_code in (400, 404):
        return None
    _raise_for(resp)
    return None


async def storage_sign(bucket: str, path: str, expires_in: int = 900) -> str:
    resp = await client().post(
        f"{settings.supabase_url}/storage/v1/object/sign/{bucket}/{path}",
        json={"expiresIn": expires_in},
        headers=_service_headers(),
    )
    _raise_for(resp)
    signed = resp.json().get("signedURL") or resp.json().get("signedUrl")
    return f"{settings.supabase_url}/storage/v1{signed}"


async def storage_upload(bucket: str, path: str, data: bytes, content_type: str) -> None:
    resp = await client().post(
        f"{settings.supabase_url}/storage/v1/object/{bucket}/{path}",
        content=data,
        headers={**_service_headers(), "Content-Type": content_type, "x-upsert": "true"},
    )
    _raise_for(resp)


async def storage_remove(bucket: str, paths: list[str]) -> None:
    if not paths:
        return
    resp = await client().request(
        "DELETE",
        f"{settings.supabase_url}/storage/v1/object/{bucket}",
        json={"prefixes": paths},
        headers=_service_headers(),
    )
    _raise_for(resp)
