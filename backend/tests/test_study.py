from datetime import datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models import Card


@pytest.fixture
def ada(client: TestClient) -> TestClient:
    client.post(
        "/api/auth/register",
        json={"email": "ada@example.com", "password": "correct horse"},
    )
    return client


@pytest.fixture
def deck_id(ada: TestClient) -> int:
    return ada.post("/api/decks", json={"name": "Biology"}).json()["id"]


def add_card(client: TestClient, deck_id: int, front: str = "Q") -> dict:
    return client.post(
        f"/api/decks/{deck_id}/cards", json={"front": front, "back": "A"}
    ).json()


def review(client: TestClient, deck_id: int, card_id: int, rating: str):
    return client.post(
        f"/api/decks/{deck_id}/cards/{card_id}/review", json={"rating": rating}
    )


def make_due(db: Session, card_id: int, days_ago: int = 0) -> None:
    """Move a card's due date, standing in for the passing of time."""
    now = db.scalar(select(func.now()))
    db.get(Card, card_id).due_at = now - timedelta(days=days_ago)
    db.commit()


def due_ids(client: TestClient, deck_id: int) -> list[int]:
    return [card["id"] for card in client.get(f"/api/decks/{deck_id}/due").json()]


def test_new_cards_start_due_with_the_initial_schedule(
    ada: TestClient, deck_id: int
) -> None:
    card = add_card(ada, deck_id)

    assert card["interval_days"] == 0
    assert card["ease"] == 2.5
    assert card["repetitions"] == 0
    assert due_ids(ada, deck_id) == [card["id"]]
    assert ada.get(f"/api/decks/{deck_id}").json()["due_count"] == 1


def test_good_review_moves_the_due_date_forward_by_the_interval(
    ada: TestClient, deck_id: int
) -> None:
    card = add_card(ada, deck_id)

    response = review(ada, deck_id, card["id"], "good")

    assert response.status_code == 200
    body = response.json()
    assert body["interval_days"] == 1
    assert body["repetitions"] == 1
    due = datetime.fromisoformat(body["due_at"])
    assert due - datetime.fromisoformat(card["due_at"]) == timedelta(days=1)
    assert body["due_at"].endswith("Z")
    assert due_ids(ada, deck_id) == []
    assert ada.get(f"/api/decks/{deck_id}").json()["due_count"] == 0


def test_again_keeps_the_card_due_and_can_be_repeated(
    ada: TestClient, deck_id: int
) -> None:
    card = add_card(ada, deck_id)

    first = review(ada, deck_id, card["id"], "again")
    second = review(ada, deck_id, card["id"], "again")

    assert first.status_code == 200
    assert first.json()["interval_days"] == 0
    assert second.status_code == 200
    assert second.json()["ease"] == pytest.approx(2.1)
    assert due_ids(ada, deck_id) == [card["id"]]


def test_reviewing_a_card_that_is_not_due_returns_409_and_changes_nothing(
    ada: TestClient, deck_id: int
) -> None:
    card = add_card(ada, deck_id)
    reviewed = review(ada, deck_id, card["id"], "good").json()

    response = review(ada, deck_id, card["id"], "good")

    assert response.status_code == 409
    current = ada.get(f"/api/decks/{deck_id}/cards/{card['id']}").json()
    assert current == reviewed


def test_card_comes_due_again_and_the_schedule_continues(
    ada: TestClient, deck_id: int, db: Session
) -> None:
    card = add_card(ada, deck_id)
    review(ada, deck_id, card["id"], "good")

    make_due(db, card["id"])

    assert due_ids(ada, deck_id) == [card["id"]]
    assert review(ada, deck_id, card["id"], "good").json()["interval_days"] == 6


def test_due_cards_come_back_oldest_first(
    ada: TestClient, deck_id: int, db: Session
) -> None:
    newer = add_card(ada, deck_id, "newer")
    older = add_card(ada, deck_id, "older")
    make_due(db, older["id"], days_ago=3)
    make_due(db, newer["id"], days_ago=1)

    assert due_ids(ada, deck_id) == [older["id"], newer["id"]]


def test_due_list_only_includes_this_deck(ada: TestClient, deck_id: int) -> None:
    other_deck = ada.post("/api/decks", json={"name": "Other"}).json()["id"]
    add_card(ada, other_deck)

    assert due_ids(ada, deck_id) == []


def test_editing_a_card_keeps_its_schedule(ada: TestClient, deck_id: int) -> None:
    card = add_card(ada, deck_id)
    reviewed = review(ada, deck_id, card["id"], "easy").json()

    updated = ada.patch(
        f"/api/decks/{deck_id}/cards/{card['id']}", json={"front": "New"}
    ).json()

    assert updated == reviewed | {"front": "New"}


def test_deck_list_reports_due_counts(
    ada: TestClient, deck_id: int, db: Session
) -> None:
    first = add_card(ada, deck_id)
    add_card(ada, deck_id)
    review(ada, deck_id, first["id"], "good")

    deck = ada.get("/api/decks").json()[0]

    assert deck["card_count"] == 2
    assert deck["due_count"] == 1


@pytest.mark.parametrize("payload", [{"rating": "perfect"}, {"rating": None}, {}])
def test_invalid_ratings_are_rejected(
    ada: TestClient, deck_id: int, payload: dict
) -> None:
    card = add_card(ada, deck_id)

    response = ada.post(f"/api/decks/{deck_id}/cards/{card['id']}/review", json=payload)

    assert response.status_code == 422


def test_schedule_fields_cannot_be_set_directly(ada: TestClient, deck_id: int) -> None:
    created = ada.post(
        f"/api/decks/{deck_id}/cards",
        json={"front": "Q", "back": "A", "interval_days": 999, "ease": 9},
    ).json()

    updated = ada.patch(
        f"/api/decks/{deck_id}/cards/{created['id']}", json={"repetitions": 99}
    ).json()

    assert created["interval_days"] == 0
    assert created["ease"] == 2.5
    assert updated["repetitions"] == 0
