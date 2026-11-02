import io
import sys
from collections.abc import Callable, Iterator
from contextlib import contextmanager

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app import cli
from app.models import Role, User
from app.security import verify_password

PASSWORD = "correct horse"


@pytest.fixture(autouse=True)
def cli_uses_the_test_session(
    get_test_db: Callable[[], Iterator[Session]], monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(cli, "SessionLocal", contextmanager(get_test_db))


def answer_prompts(monkeypatch: pytest.MonkeyPatch, *answers: str) -> None:
    replies = iter(answers)
    monkeypatch.setattr(cli.getpass, "getpass", lambda prompt: next(replies))


def type_into_stdin(monkeypatch: pytest.MonkeyPatch, text: str) -> None:
    monkeypatch.setattr(sys, "stdin", io.StringIO(text))


def failure_message(*args: str) -> str:
    with pytest.raises(SystemExit) as failure:
        cli.main(args)
    return failure.value.code


def find_user(db: Session, email: str) -> User | None:
    return db.scalar(select(User).where(User.email == email))


def register(client: TestClient, email: str = "ada@example.com") -> int:
    response = client.post(
        "/api/auth/register", json={"email": email, "password": PASSWORD}
    )
    return response.json()["id"]


def test_create_admin_makes_an_account_that_can_use_the_admin_api(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture
) -> None:
    answer_prompts(monkeypatch, PASSWORD, PASSWORD)

    cli.main(["create-admin", "--email", "Root@Example.com"])

    assert "Created admin root@example.com" in capsys.readouterr().out
    response = client.post(
        "/api/auth/login", json={"email": "root@example.com", "password": PASSWORD}
    )
    assert response.json()["role"] == "admin"
    assert client.get("/api/admin/users").status_code == 200


def test_create_admin_can_read_the_password_from_stdin(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture
) -> None:
    answer_prompts(monkeypatch)
    type_into_stdin(monkeypatch, f"{PASSWORD}\n")

    cli.main(["create-admin", "--email", "root@example.com", "--password-stdin"])

    assert "Created admin root@example.com" in capsys.readouterr().out
    response = client.post(
        "/api/auth/login", json={"email": "root@example.com", "password": PASSWORD}
    )
    assert response.json()["role"] == "admin"


def test_a_password_from_stdin_keeps_its_spaces_but_not_the_line_ending(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    type_into_stdin(monkeypatch, " correct horse \r\n")

    cli.main(["create-admin", "--email", "root@example.com", "--password-stdin"])

    def log_in(password: str) -> int:
        credentials = {"email": "root@example.com", "password": password}
        return client.post("/api/auth/login", json=credentials).status_code

    assert log_in(" correct horse ") == 200
    assert log_in("correct horse") == 401


def test_an_empty_stdin_is_rejected_as_a_password(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    type_into_stdin(monkeypatch, "")

    message = failure_message(
        "create-admin", "--email", "root@example.com", "--password-stdin"
    )

    assert message.startswith("Invalid password:")
    assert find_user(db, "root@example.com") is None


def test_create_admin_rejects_mismatched_passwords(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    answer_prompts(monkeypatch, "first password", "second password")

    message = failure_message("create-admin", "--email", "root@example.com")

    assert message == "Passwords don't match"
    assert find_user(db, "root@example.com") is None


def test_create_admin_rejects_a_short_password(
    db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    answer_prompts(monkeypatch, "short", "short")

    message = failure_message("create-admin", "--email", "root@example.com")

    assert message.startswith("Invalid password:")
    assert find_user(db, "root@example.com") is None


def test_create_admin_refuses_an_email_that_is_already_taken(
    client: TestClient, db: Session, monkeypatch: pytest.MonkeyPatch
) -> None:
    user_id = register(client)
    answer_prompts(monkeypatch)

    message = failure_message("create-admin", "--email", "ADA@example.com")

    assert "already has an account" in message
    assert "promote-admin" in message
    assert db.get(User, user_id).role is Role.USER


def test_promote_admin_makes_an_existing_user_an_active_admin(
    client: TestClient, db: Session, capsys: pytest.CaptureFixture
) -> None:
    user_id = register(client)
    db.get(User, user_id).is_active = False
    db.commit()

    cli.main(["promote-admin", "--email", "ADA@example.com"])

    user = db.get(User, user_id)
    assert user.role is Role.ADMIN
    assert user.is_active
    assert verify_password(PASSWORD, user.password_hash)
    assert "password wasn't changed" in capsys.readouterr().out


def test_promotion_applies_to_a_live_session(client: TestClient) -> None:
    register(client)
    assert client.get("/api/admin/users").status_code == 403

    cli.main(["promote-admin", "--email", "ada@example.com"])

    assert client.get("/api/admin/users").status_code == 200


def test_promote_admin_fails_for_an_unknown_email() -> None:
    message = failure_message("promote-admin", "--email", "nobody@example.com")

    assert message == "No account found for nobody@example.com"


@pytest.mark.parametrize("command", ["create-admin", "promote-admin"])
def test_commands_reject_an_invalid_email(command: str) -> None:
    message = failure_message(command, "--email", "not-an-email")

    assert message.startswith("Invalid email:")
