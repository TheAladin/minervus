from collections.abc import Callable
from datetime import UTC, datetime, timedelta

import httpx2
import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.config import settings
from app.dependencies import SESSION_COOKIE
from app.models import Role, User
from app.security import JWT_ALGORITHM, create_session_token, read_session_token

ClientFactory = Callable[[], TestClient]

CREDENTIALS = {"email": "ada@example.com", "password": "correct horse"}


def register(client: TestClient, **overrides: object) -> httpx2.Response:
    return client.post("/api/auth/register", json=CREDENTIALS | overrides)


def log_in(client: TestClient, **overrides: object) -> httpx2.Response:
    return client.post("/api/auth/login", json=CREDENTIALS | overrides)


def deactivate(db: Session, user_id: int) -> None:
    db.get(User, user_id).is_active = False
    db.commit()


def forged_token(secret: str = settings.jwt_secret, **claims: object) -> str:
    defaults = {"sub": "1", "exp": datetime.now(UTC) + timedelta(hours=1)}
    return jwt.encode(defaults | claims, secret, algorithm=JWT_ALGORITHM)


def test_register_creates_a_user_and_starts_a_session(client: TestClient) -> None:
    response = register(client)

    assert response.status_code == 201
    body = response.json()
    assert body["email"] == "ada@example.com"
    assert body["role"] == "user"
    assert body["is_active"] is True
    assert "password_hash" not in body
    assert client.get("/api/auth/me").json() == body


def test_passwords_are_stored_hashed(client: TestClient, db: Session) -> None:
    user_id = register(client).json()["id"]

    assert db.get(User, user_id).password_hash.startswith("$argon2")


def test_register_ignores_a_requested_role(client: TestClient, db: Session) -> None:
    response = register(client, role="admin", is_active=False)

    assert response.status_code == 201
    user = db.get(User, response.json()["id"])
    assert user.role is Role.USER
    assert user.is_active


def test_an_email_can_only_register_once(client_factory: ClientFactory) -> None:
    register(client_factory())
    second = client_factory()

    response = register(second, email="ADA@example.com")

    assert response.status_code == 409
    assert SESSION_COOKIE not in second.cookies


@pytest.mark.parametrize(
    "invalid",
    [
        {"email": "not-an-email"},
        {"email": "nul\x00@example.com"},
        {"password": "x" * 7},
        {"password": "x" * 129},
    ],
)
def test_register_rejects_invalid_input(client: TestClient, invalid: dict) -> None:
    assert register(client, **invalid).status_code == 422


@pytest.mark.parametrize(
    "password", ["x" * 8, "x" * 128, "nul\x00 inside", "pässwörd ✓"]
)
def test_any_valid_password_can_log_in(
    client_factory: ClientFactory, password: str
) -> None:
    assert register(client_factory(), password=password).status_code == 201
    assert log_in(client_factory(), password=password).status_code == 200


def test_validation_errors_do_not_echo_the_password(client: TestClient) -> None:
    response = register(client, password="hunter2")

    assert response.status_code == 422
    assert "hunter2" not in response.text
    assert response.json()["detail"][0]["loc"] == ["body", "password"]


def test_text_that_cannot_be_encoded_is_a_validation_error(client: TestClient) -> None:
    response = client.post(
        "/api/auth/register",
        content=b'{"email": "ada@example.com", "password": "\\ud800 not text"}',
        headers={"Content-Type": "application/json"},
    )

    assert response.status_code == 422


def test_session_cookie_is_http_only_and_lasts_a_week(client: TestClient) -> None:
    cookie = register(client).headers["set-cookie"].lower()

    assert cookie.startswith(f"{SESSION_COOKIE}=")
    assert "httponly" in cookie
    assert "samesite=lax" in cookie
    assert "max-age=604800" in cookie


@pytest.mark.parametrize("secure", [True, False])
def test_cookie_secure_flag_follows_the_setting(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, secure: bool
) -> None:
    monkeypatch.setattr(settings, "cookie_secure", secure)

    cookie = register(client).headers["set-cookie"].lower()

    assert ("; secure" in cookie) is secure


def test_login_starts_a_session_and_ignores_email_case(
    client_factory: ClientFactory,
) -> None:
    register(client_factory())
    client = client_factory()

    response = log_in(client, email="Ada@Example.com")

    assert response.status_code == 200
    assert client.get("/api/auth/me").json()["email"] == "ada@example.com"


@pytest.mark.parametrize(
    "wrong", [{"password": "wrong password"}, {"email": "nobody@example.com"}]
)
def test_login_failures_look_the_same(
    client_factory: ClientFactory, wrong: dict
) -> None:
    register(client_factory())
    client = client_factory()

    response = log_in(client, **wrong)

    assert response.status_code == 401
    assert response.json() == {"detail": "Incorrect email or password"}
    assert SESSION_COOKIE not in client.cookies


def test_login_rejects_an_overlong_password(client: TestClient) -> None:
    assert log_in(client, password="x" * 129).status_code == 422


def test_deactivated_user_cannot_log_in(
    client_factory: ClientFactory, db: Session
) -> None:
    deactivate(db, register(client_factory()).json()["id"])

    assert log_in(client_factory()).status_code == 403


def test_wrong_password_does_not_reveal_a_deactivated_account(
    client_factory: ClientFactory, db: Session
) -> None:
    deactivate(db, register(client_factory()).json()["id"])

    assert log_in(client_factory(), password="wrong password").status_code == 401


def test_deactivation_ends_a_live_session(client: TestClient, db: Session) -> None:
    user_id = register(client).json()["id"]
    assert client.get("/api/auth/me").status_code == 200

    deactivate(db, user_id)

    assert client.get("/api/auth/me").status_code == 401


def test_logout_ends_the_session(client: TestClient) -> None:
    register(client)

    response = client.post("/api/auth/logout")

    assert response.status_code == 204
    assert SESSION_COOKIE not in client.cookies
    assert client.get("/api/auth/me").status_code == 401


def test_logout_works_without_a_session(client: TestClient) -> None:
    assert client.post("/api/auth/logout").status_code == 204


def test_me_requires_a_session(client: TestClient) -> None:
    assert client.get("/api/auth/me").status_code == 401


def test_valid_tokens_are_accepted() -> None:
    assert read_session_token(create_session_token(42)) == 42
    assert read_session_token(forged_token()) == 1


@pytest.mark.parametrize(
    "token",
    [
        "garbage",
        forged_token(secret="another-secret-that-is-at-least-32-characters"),
        forged_token(exp=datetime.now(UTC) - timedelta(seconds=1)),
        jwt.encode({"sub": "1"}, settings.jwt_secret, algorithm=JWT_ALGORITHM),
        jwt.encode({"sub": "1", "exp": 9999999999}, None, algorithm="none"),
    ],
    ids=["garbage", "wrong-secret", "expired", "no-expiry", "alg-none"],
)
def test_bad_tokens_are_rejected(client: TestClient, token: str) -> None:
    assert read_session_token(token) is None

    client.cookies.set(SESSION_COOKIE, token)
    assert client.get("/api/auth/me").status_code == 401


def test_token_for_a_missing_user_is_rejected(client: TestClient) -> None:
    client.cookies.set(SESSION_COOKIE, create_session_token(2_000_000_000))

    assert client.get("/api/auth/me").status_code == 401
