from __future__ import annotations

import re

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.main import unhandled_exception_handler
from app.middleware import CorrelationIdMiddleware


def test_middleware_generates_request_id_and_processing_time() -> None:
    test_app = FastAPI()
    test_app.add_middleware(CorrelationIdMiddleware)

    @test_app.get("/ok")
    async def ok() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(test_app) as client:
        response = client.get("/ok")

    assert response.status_code == 200
    assert re.fullmatch(r"req-[0-9a-f]{8}", response.headers["x-request-id"])
    assert float(response.headers["x-response-time-ms"]) >= 0


def test_middleware_propagates_incoming_request_id() -> None:
    test_app = FastAPI()
    test_app.add_middleware(CorrelationIdMiddleware)

    @test_app.get("/ok")
    async def ok() -> dict[str, bool]:
        return {"ok": True}

    with TestClient(test_app) as client:
        response = client.get("/ok", headers={"x-request-id": "req-team-a"})

    assert response.headers["x-request-id"] == "req-team-a"


def test_unhandled_exception_returns_correlated_safe_response() -> None:
    test_app = FastAPI()
    test_app.add_exception_handler(Exception, unhandled_exception_handler)
    test_app.add_middleware(CorrelationIdMiddleware)

    @test_app.get("/failure")
    async def failure() -> None:
        raise RuntimeError("internal database details")

    with TestClient(test_app, raise_server_exceptions=False) as client:
        response = client.get("/failure", headers={"x-request-id": "req-failure"})

    assert response.status_code == 500
    assert response.headers["x-request-id"] == "req-failure"
    assert response.json() == {
        "detail": "InternalServerError",
        "correlation_id": "req-failure",
    }
    assert "internal database details" not in response.text
