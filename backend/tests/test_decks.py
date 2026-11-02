from collections.abc import Callable

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Card, Deck, User


def signed_in(client_factory: Callable[[], TestClient], email: str) -> TestClient:
    client = client_factory()
    response = client.post(
        "/api/auth/register", json={"email": email, "password": "correct horse"}
    )
    assert response.status_code == 201
    return client


@pytest.fixture
def ada(client_factory) -> TestClient:
    return signed_in(client_factory, "ada@example.com")


@pytest.fixture
def mallory(client_factory) -> TestClient:
    return signed_in(client_factory, "mallory@example.com")


@pytest.fixture
def deck(ada: TestClient) -> dict:
    return ada.post("/api/decks", json={"name": "Biology"}).json()


@pytest.fixture
def card(ada: TestClient, deck: dict) -> dict:
    return ada.post(
        f"/api/decks/{deck['id']}/cards", json={"front": "Q", "back": "A"}
    ).json()


def test_create_and_get_a_deck(ada: TestClient) -> None:
    created = ada.post("/api/decks", json={"name": "  Biology  "})

    assert created.status_code == 201
    assert created.json()["name"] == "Biology"
    assert created.json()["card_count"] == 0
    assert created.json()["due_count"] == 0
    assert ada.get(f"/api/decks/{created.json()['id']}").json() == created.json()


def test_list_decks_shows_newest_first_with_card_counts(ada: TestClient) -> None:
    first = ada.post("/api/decks", json={"name": "First"}).json()
    second = ada.post("/api/decks", json={"name": "Second"}).json()
    ada.post(f"/api/decks/{first['id']}/cards", json={"front": "Q", "back": "A"})
    ada.post(f"/api/decks/{first['id']}/cards", json={"front": "Q2", "back": "A2"})

    decks = ada.get("/api/decks").json()

    assert [deck["id"] for deck in decks] == [second["id"], first["id"]]
    assert [deck["card_count"] for deck in decks] == [0, 2]


def test_rename_a_deck(ada: TestClient, deck: dict, card: dict) -> None:
    response = ada.patch(f"/api/decks/{deck['id']}", json={"name": "Chemistry"})

    assert response.status_code == 200
    assert response.json()["name"] == "Chemistry"
    assert response.json()["card_count"] == 1
    assert ada.get(f"/api/decks/{deck['id']}").json() == response.json()


def test_deleting_a_deck_deletes_its_cards(
    ada: TestClient, deck: dict, card: dict, db: Session
) -> None:
    assert ada.delete(f"/api/decks/{deck['id']}").status_code == 204

    assert ada.get(f"/api/decks/{deck['id']}").status_code == 404
    assert db.get(Deck, deck["id"]) is None
    db.expire_all()
    assert db.get(Card, card["id"]) is None


def test_deleting_a_user_deletes_their_decks(
    ada: TestClient, deck: dict, db: Session
) -> None:
    user = db.scalar(select(User).where(User.email == "ada@example.com"))
    db.delete(user)
    db.commit()

    db.expire_all()
    assert db.get(Deck, deck["id"]) is None


@pytest.mark.parametrize("name", ["", "   ", "x" * 201, "bad\x00name", None, 7])
def test_invalid_deck_names_are_rejected(ada: TestClient, deck: dict, name) -> None:
    payload = {"name": name}

    assert ada.post("/api/decks", json=payload).status_code == 422
    assert ada.patch(f"/api/decks/{deck['id']}", json=payload).status_code == 422


def test_create_list_and_get_cards(ada: TestClient, deck: dict) -> None:
    url = f"/api/decks/{deck['id']}/cards"

    created = ada.post(url, json={"front": " What is DNA? ", "back": " A molecule "})

    assert created.status_code == 201
    assert created.json()["front"] == "What is DNA?"
    assert created.json()["back"] == "A molecule"
    assert created.json()["deck_id"] == deck["id"]
    assert ada.get(url).json() == [created.json()]
    assert ada.get(f"{url}/{created.json()['id']}").json() == created.json()


@pytest.mark.parametrize(
    "payload",
    [
        {"front": "", "back": "A"},
        {"front": "Q", "back": "   "},
        {"front": "Q"},
        {"front": "x" * 10_001, "back": "A"},
        {"front": "Q", "back": "nul\x00byte"},
    ],
)
def test_invalid_cards_are_rejected(ada: TestClient, deck: dict, payload: dict) -> None:
    response = ada.post(f"/api/decks/{deck['id']}/cards", json=payload)

    assert response.status_code == 422


def test_lone_surrogates_in_card_text_are_rejected(ada: TestClient, deck: dict) -> None:
    response = ada.post(
        f"/api/decks/{deck['id']}/cards",
        content=rb'{"front": "\ud800", "back": "A"}',
        headers={"content-type": "application/json"},
    )

    assert response.status_code == 422


def test_update_a_card_partially(ada: TestClient, deck: dict, card: dict) -> None:
    url = f"/api/decks/{deck['id']}/cards/{card['id']}"

    response = ada.patch(url, json={"back": "Better answer"})

    assert response.status_code == 200
    assert response.json()["front"] == "Q"
    assert response.json()["back"] == "Better answer"
    assert ada.get(url).json() == response.json()


def test_null_in_a_card_update_means_no_change(
    ada: TestClient, deck: dict, card: dict
) -> None:
    url = f"/api/decks/{deck['id']}/cards/{card['id']}"

    response = ada.patch(url, json={"front": None})

    assert response.status_code == 200
    assert response.json()["front"] == "Q"


def test_update_rejects_blank_text(ada: TestClient, deck: dict, card: dict) -> None:
    url = f"/api/decks/{deck['id']}/cards/{card['id']}"

    assert ada.patch(url, json={"front": "  "}).status_code == 422
    assert ada.get(url).json()["front"] == "Q"


def test_delete_a_card(ada: TestClient, deck: dict, card: dict) -> None:
    url = f"/api/decks/{deck['id']}/cards/{card['id']}"

    assert ada.delete(url).status_code == 204
    assert ada.get(url).status_code == 404
    assert ada.get(f"/api/decks/{deck['id']}").json()["card_count"] == 0


def test_bulk_create_cards(ada: TestClient, deck: dict) -> None:
    url = f"/api/decks/{deck['id']}/cards"
    payload = {"cards": [{"front": f"Q{i}", "back": f"A{i}"} for i in range(3)]}

    response = ada.post(f"{url}/bulk", json=payload)

    assert response.status_code == 201
    assert [card["front"] for card in response.json()] == ["Q0", "Q1", "Q2"]
    assert all(card["id"] for card in response.json())
    assert len(ada.get(url).json()) == 3


def test_bulk_create_saves_nothing_if_any_card_is_invalid(
    ada: TestClient, deck: dict, db: Session
) -> None:
    payload = {"cards": [{"front": "Q", "back": "A"}, {"front": " ", "back": "A"}]}

    response = ada.post(f"/api/decks/{deck['id']}/cards/bulk", json=payload)

    assert response.status_code == 422
    assert db.scalar(select(func.count()).select_from(Card)) == 0


@pytest.mark.parametrize("count", [0, 101])
def test_bulk_create_enforces_size_limits(
    ada: TestClient, deck: dict, count: int
) -> None:
    payload = {"cards": [{"front": "Q", "back": "A"}] * count}

    response = ada.post(f"/api/decks/{deck['id']}/cards/bulk", json=payload)

    assert response.status_code == 422


def test_a_card_is_only_reachable_through_its_own_deck(
    ada: TestClient, card: dict
) -> None:
    other = ada.post("/api/decks", json={"name": "Other"}).json()

    response = ada.get(f"/api/decks/{other['id']}/cards/{card['id']}")

    assert response.status_code == 404


def test_other_users_decks_are_hidden(mallory: TestClient, deck: dict) -> None:
    assert mallory.get("/api/decks").json() == []


@pytest.mark.parametrize(
    ("method", "path", "body"),
    [
        ("GET", "/api/decks/{deck}", None),
        ("PATCH", "/api/decks/{deck}", {"name": "Stolen"}),
        ("DELETE", "/api/decks/{deck}", None),
        ("GET", "/api/decks/{deck}/cards", None),
        ("POST", "/api/decks/{deck}/cards", {"front": "Q", "back": "A"}),
        (
            "POST",
            "/api/decks/{deck}/cards/bulk",
            {"cards": [{"front": "Q", "back": "A"}]},
        ),
        ("GET", "/api/decks/{deck}/cards/{card}", None),
        ("PATCH", "/api/decks/{deck}/cards/{card}", {"front": "Stolen"}),
        ("DELETE", "/api/decks/{deck}/cards/{card}", None),
        ("GET", "/api/decks/{deck}/due", None),
        ("POST", "/api/decks/{deck}/cards/{card}/review", {"rating": "good"}),
    ],
)
def test_other_users_get_404_and_change_nothing(
    mallory: TestClient,
    ada: TestClient,
    deck: dict,
    card: dict,
    method: str,
    path: str,
    body: dict | None,
) -> None:
    url = path.format(deck=deck["id"], card=card["id"])

    assert mallory.request(method, url, json=body).status_code == 404

    assert ada.get(f"/api/decks/{deck['id']}").json() == deck | {
        "card_count": 1,
        "due_count": 1,
    }
    assert ada.get(f"/api/decks/{deck['id']}/cards").json() == [card]


@pytest.mark.parametrize(
    "path", ["/api/decks/2147483647", "/api/decks/2147483647/cards"]
)
def test_missing_deck_returns_404(ada: TestClient, path: str) -> None:
    assert ada.get(path).status_code == 404


@pytest.mark.parametrize("deck_id", [0, 2**31, 10**30, "abc"])
def test_invalid_deck_id_returns_422(ada: TestClient, deck_id: object) -> None:
    assert ada.get(f"/api/decks/{deck_id}").status_code == 422
