---
name: fastapi-async-backend
description: "Production guidelines for modern Python backends using FastAPI, Pydantic v2, SQLAlchemy 2.0 AsyncSession, dependency injection, and asyncpg connection pooling."
category: backend
tags: [fastapi, python, async, pydantic, sqlalchemy, postgresql, rest-api]
license: "MIT"
---

# FastAPI Async Backend Architecture

## Overview

Comprehensive engineering patterns for modern, high-concurrency Python backend services. Enforces async-first architecture, type-safe data validation via Pydantic v2, non-blocking database I/O with SQLAlchemy 2.0 and `asyncpg`, modular dependency injection, and OpenAPI contract documentation.

## Project Structure

```
app/
├── api/
│   ├── v1/
│   │   ├── endpoints/      # Route controllers (auth, users, items)
│   │   └── router.py       # Aggregate APIRouter
│   └── deps.py             # Reusable dependencies (DB session, current user)
├── core/
│   ├── config.py           # Pydantic BaseSettings environment parsing
│   ├── security.py         # Passlib password hashing, JWT creation/verification
│   └── database.py         # AsyncEngine and async_sessionmaker setup
├── models/                 # SQLAlchemy 2.0 declarative database models
├── schemas/                # Pydantic v2 request/response models
├── services/               # Business logic decoupling
└── main.py                 # FastAPI application factory
```

## Database Connection with SQLAlchemy 2.0 Async

```python
from collections.abc import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

DATABASE_URL = "postgresql+asyncpg://user:pass@localhost:5432/mydb"

engine = create_async_engine(
    DATABASE_URL,
    echo=False,
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,
)

async_session_maker = async_sessionmaker(
    engine, class_=AsyncSession, expire_on_commit=False
)

class Base(DeclarativeBase):
    pass

async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    async with async_session_maker() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
```

## Pydantic v2 Schema Modeling

```python
from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field

class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=64)
    full_name: str | None = None

class UserRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    email: EmailStr
    full_name: str | None
    is_active: bool
    created_at: datetime
```

## Modular Endpoint with Dependency Injection

```python
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_db_session
from app.models.user import User
from app.schemas.user import UserCreate, UserRead

router = APIRouter(prefix="/users", tags=["users"])

@router.post("/", response_model=UserRead, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> User:
    # 1. Check existing record
    stmt = select(User).where(User.email == payload.email)
    existing = await session.scalar(stmt)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User with this email already exists",
        )

    # 2. Persist new user
    user = User(
        email=payload.email,
        full_name=payload.full_name,
        # hashed_password=get_password_hash(payload.password),
    )
    session.add(user)
    await session.flush()
    await session.refresh(user)
    return user
```

## Core Invariants

1. **Strict Non-Blocking Execution**: Never invoke blocking I/O calls (`requests.get`, `time.sleep`, standard `open()`) inside `async def` endpoints. Use `httpx.AsyncClient`, `asyncio.sleep`, and `aiofiles`.
2. **SQLAlchemy 2.0 Syntax**: Use `select()`, `update()`, and `delete()` statement constructs executed through `session.execute()` or `session.scalars()`. Avoid legacy 1.x `session.query()` calls.
3. **Pydantic v2 Compatibility**: Use `model_config = ConfigDict(...)` and `model_dump()`; avoid deprecated v1 methods (`dict()`, `json()`).
4. **Structured RFC 9457 Error Handling**: Use custom exception handlers to format all API errors uniformly with `status`, `detail`, and `instance` fields.
