import datetime as dt
from pydantic import BaseModel, EmailStr, ConfigDict


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    email: EmailStr
    created_at: dt.datetime


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class ScanCreate(BaseModel):
    target_domain: str
    authorized: bool  # must be True — enforced in the router


class HostOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    subdomain: str
    is_live: bool
    status_code: int | None
    scheme: str | None
    title: str | None
    tech: list | None
    headers: dict | None
    exposed_paths: list | None
    ai_score: float | None
    ai_reason: str | None


class ScanOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    target_domain: str
    status: str
    authorized: bool
    authorized_at: dt.datetime | None
    ai_summary: str | None
    ai_provider: str | None
    error: str | None
    created_at: dt.datetime
    updated_at: dt.datetime


class ScanDetail(ScanOut):
    hosts: list[HostOut] = []
