from collections.abc import Callable
from typing import NamedTuple

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.models import Role, User

ClientFactory = Callable[[], TestClient]

PASSWORD = "correct horse"


class Person(NamedTuple):
    client: TestClient
    id: int


def sign_up(client_factory: ClientFactory, email: str) -> Person:
    client = client_factory()
    response = client.post(
        "/api/auth/register", json={"email": email, "password": PASSWORD}
    )
    return Person(client, response.json()["id"])


def make_admin(db: Session, user_id: int) -> None:
    db.get(User, user_id).role = Role.ADMIN
    db.commit()


@pytest.fixture
def admin(client_factory: ClientFactory, db: Session) -> Person:
    person = sign_up(client_factory, "admin@example.com")
    make_admin(db, person.id)
    return person


@pytest.fixture
def user(client_factory: ClientFactory) -> Person:
    return sign_up(client_factory, "user@example.com")


def test_admin_can_list_users(admin: Person, user: Person) -> None:
    response = admin.client.get("/api/admin/users")

    assert response.status_code == 200
    users = response.json()
    assert [person["id"] for person in users] == [admin.id, user.id]
    assert [person["role"] for person in users] == ["admin", "user"]
    assert "password_hash" not in users[0]


def test_admin_can_deactivate_and_reactivate_a_user(
    admin: Person, user: Person
) -> None:
    response = admin.client.patch(
        f"/api/admin/users/{user.id}", json={"is_active": False}
    )

    assert response.status_code == 200
    assert response.json()["is_active"] is False
    assert user.client.get("/api/auth/me").status_code == 401

    response = admin.client.patch(
        f"/api/admin/users/{user.id}", json={"is_active": True}
    )

    assert response.json()["is_active"] is True
    assert user.client.get("/api/auth/me").status_code == 200


def test_user_deactivated_by_an_admin_cannot_log_in(
    admin: Person, user: Person, client_factory: ClientFactory
) -> None:
    admin.client.patch(f"/api/admin/users/{user.id}", json={"is_active": False})

    response = client_factory().post(
        "/api/auth/login", json={"email": "user@example.com", "password": PASSWORD}
    )

    assert response.status_code == 403


def test_admin_cannot_deactivate_themselves(admin: Person, db: Session) -> None:
    response = admin.client.patch(
        f"/api/admin/users/{admin.id}", json={"is_active": False}
    )

    assert response.status_code == 409
    assert db.get(User, admin.id).is_active


def test_admin_can_deactivate_another_admin(
    admin: Person, user: Person, db: Session
) -> None:
    make_admin(db, user.id)
    assert user.client.get("/api/admin/users").status_code == 200

    admin.client.patch(f"/api/admin/users/{user.id}", json={"is_active": False})

    assert user.client.get("/api/admin/users").status_code == 401


def test_demoted_admin_loses_access_immediately(admin: Person, db: Session) -> None:
    db.get(User, admin.id).role = Role.USER
    db.commit()

    assert admin.client.get("/api/admin/users").status_code == 403


def test_updating_a_missing_user_returns_404(admin: Person) -> None:
    response = admin.client.patch(
        "/api/admin/users/2147483647", json={"is_active": False}
    )

    assert response.status_code == 404


@pytest.mark.parametrize("user_id", [0, -1, 2**31, 10**30, "abc"])
def test_an_invalid_id_returns_422(admin: Person, user_id: int | str) -> None:
    response = admin.client.patch(
        f"/api/admin/users/{user_id}", json={"is_active": False}
    )

    assert response.status_code == 422


@pytest.mark.parametrize("body", [{}, {"is_active": "nope"}, {"is_active": None}])
def test_status_update_requires_a_boolean(
    admin: Person, user: Person, body: dict
) -> None:
    response = admin.client.patch(f"/api/admin/users/{user.id}", json=body)

    assert response.status_code == 422


def test_status_update_only_changes_the_status(
    admin: Person, user: Person, db: Session
) -> None:
    admin.client.patch(
        f"/api/admin/users/{user.id}",
        json={"is_active": True, "role": "admin", "email": "new@example.com"},
    )

    updated = db.get(User, user.id)
    assert updated.role is Role.USER
    assert updated.email == "user@example.com"


def test_regular_users_get_403_on_admin_endpoints(
    admin: Person, user: Person, db: Session
) -> None:
    assert user.client.get("/api/admin/users").status_code == 403

    response = user.client.patch(
        f"/api/admin/users/{admin.id}", json={"is_active": False}
    )

    assert response.status_code == 403
    assert db.get(User, admin.id).is_active


@pytest.mark.parametrize("user_id", [2147483647, 2**31])
def test_regular_users_cannot_probe_user_ids(user: Person, user_id: int) -> None:
    response = user.client.patch(
        f"/api/admin/users/{user_id}", json={"is_active": False}
    )

    assert response.status_code == 403


def test_anonymous_requests_get_401_on_admin_endpoints(client: TestClient) -> None:
    assert client.get("/api/admin/users").status_code == 401

    response = client.patch("/api/admin/users/1", json={"is_active": False})

    assert response.status_code == 401
