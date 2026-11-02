import asyncio

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from starlette.types import Message, Receive, Scope, Send

from app.main import MAX_REQUEST_BYTES, MAX_UPLOAD_REQUEST_BYTES
from app.middleware import BodySizeLimitMiddleware


def test_oversized_request_is_rejected(client: TestClient) -> None:
    response = client.post("/api/auth/login", content=b"x" * (MAX_REQUEST_BYTES + 1))

    assert response.status_code == 413


def test_oversized_upload_is_rejected_before_authentication(client: TestClient) -> None:
    files = {"file": ("notes.pdf", b"x" * MAX_UPLOAD_REQUEST_BYTES, "application/pdf")}

    response = client.post("/api/decks/1/generate", files=files)

    assert response.status_code == 413


def test_a_body_that_arrives_in_pieces_is_counted_in_full() -> None:
    """Servers deliver a body in many small pieces, unlike the test client."""
    pieces = [
        {"type": "http.request", "body": b"x" * 400, "more_body": True},
        {"type": "http.request", "body": b"x" * 400, "more_body": True},
        {"type": "http.request", "body": b"x" * 400, "more_body": False},
    ]

    async def receive() -> Message:
        return pieces.pop(0)

    async def read_body(scope: Scope, receive: Receive, send: Send) -> None:
        while (await receive())["more_body"]:
            pass

    middleware = BodySizeLimitMiddleware(
        read_body, max_bytes=1000, max_upload_bytes=1000
    )
    scope = {"type": "http", "path": "/api/auth/login"}

    with pytest.raises(HTTPException) as error:
        asyncio.run(middleware(scope, receive, None))

    assert error.value.status_code == 413
