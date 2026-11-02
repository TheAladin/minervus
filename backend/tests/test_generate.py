import json
from collections.abc import Callable, Iterator

import anthropic
import httpx2
import pytest
from fastapi.testclient import TestClient
from pdf_helpers import make_blank_pdf, make_pdf
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app import ai
from app.ai import MAX_SOURCE_CHARS, get_anthropic_client
from app.config import settings
from app.main import app
from app.models import Card
from app.pdf import MAX_PDF_BYTES

Responder = Callable[[httpx2.Request], httpx2.Response]

CARDS = [
    {"front": "What do mitochondria make?", "back": "ATP"},
    {"front": "What do ribosomes make?", "back": "Proteins"},
]


def api_message(
    text: str | None = None, cards: list[dict] = CARDS, stop_reason: str = "end_turn"
) -> dict:
    """A Messages API response, starting with a thinking block as Haiku 5.5's can."""
    content = [{"type": "thinking", "thinking": "", "signature": "sig"}]
    if text is None:
        text = json.dumps({"cards": cards})
    if text:
        content.append({"type": "text", "text": text})
    return {
        "id": "msg_test",
        "type": "message",
        "role": "assistant",
        "model": "claude-haiku-5-5",
        "content": content,
        "stop_reason": stop_reason,
        "stop_details": None,
        "stop_sequence": None,
        "usage": {"input_tokens": 10, "output_tokens": 10},
    }


def reply(**message: object) -> Responder:
    return lambda _: httpx2.Response(200, json=api_message(**message))


def fail_with(error: type[httpx2.TransportError]) -> Responder:
    def respond(request: httpx2.Request) -> httpx2.Response:
        raise error("simulated failure", request=request)

    return respond


class FakeAnthropic:
    """Runs the real SDK against canned HTTP responses, so no network is involved."""

    def __init__(self) -> None:
        self.requests: list[dict] = []
        self.respond: Responder = reply()

    def _handle(self, request: httpx2.Request) -> httpx2.Response:
        self.requests.append(json.loads(request.content))
        return self.respond(request)

    def client(self) -> anthropic.Anthropic:
        return anthropic.Anthropic(
            api_key="test-key",
            max_retries=0,
            http_client=anthropic.DefaultHttpxClient(
                transport=httpx2.MockTransport(self._handle)
            ),
        )


@pytest.fixture
def fake_anthropic() -> Iterator[FakeAnthropic]:
    fake = FakeAnthropic()
    client = fake.client()
    app.dependency_overrides[get_anthropic_client] = lambda: client
    yield fake
    app.dependency_overrides.pop(get_anthropic_client, None)


def signed_in(client_factory: Callable[[], TestClient], email: str) -> TestClient:
    client = client_factory()
    client.post(
        "/api/auth/register", json={"email": email, "password": "correct horse"}
    )
    return client


@pytest.fixture
def ada(client_factory: Callable[[], TestClient]) -> TestClient:
    return signed_in(client_factory, "ada@example.com")


@pytest.fixture
def url(ada: TestClient) -> str:
    deck = ada.post("/api/decks", json={"name": "Biology"}).json()
    return f"/api/decks/{deck['id']}/generate"


def upload(data: bytes) -> dict:
    return {"file": ("notes.pdf", data, "application/pdf")}


def test_generates_drafts_from_text_without_saving_them(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic, db: Session
) -> None:
    response = ada.post(url, data={"text": "Cells have organelles."})

    assert response.status_code == 200
    assert response.json() == {"cards": CARDS}
    assert db.scalar(select(func.count()).select_from(Card)) == 0


def test_sends_the_expected_request_to_the_api(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic
) -> None:
    ada.post(url, data={"text": "  Cells have organelles.  ", "max_cards": "7"})

    request = fake_anthropic.requests[0]
    assert request["model"] == settings.anthropic_model
    assert request["max_tokens"] == 16_000
    assert request["output_config"]["effort"] == "medium"
    assert request["output_config"]["format"]["type"] == "json_schema"
    assert "cards" in request["output_config"]["format"]["schema"]["properties"]
    assert "not a set of instructions" in request["system"]
    prompt = request["messages"][0]["content"]
    assert "<source>\nCells have organelles.\n</source>" in prompt
    assert "at most 7 flashcards" in prompt
    # Haiku 5.5 rejects sampling parameters, so none of these may be sent.
    for rejected in ("temperature", "top_p", "top_k"):
        assert rejected not in request


def test_generates_drafts_from_a_pdf(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic
) -> None:
    response = ada.post(url, files=upload(make_pdf("Mitochondria make ATP")))

    assert response.status_code == 200
    assert response.json() == {"cards": CARDS}
    prompt = fake_anthropic.requests[0]["messages"][0]["content"]
    assert "Mitochondria make ATP" in prompt


def test_saving_approved_drafts_makes_them_studyable(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic
) -> None:
    drafts = ada.post(url, data={"text": "Cells."}).json()
    deck_url = url.removesuffix("/generate")

    saved = ada.post(f"{deck_url}/cards/bulk", json=drafts)

    assert saved.status_code == 201
    assert len(ada.get(f"{deck_url}/due").json()) == 2


def test_returns_at_most_the_requested_number_of_cards(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic
) -> None:
    fake_anthropic.respond = reply(
        cards=[{"front": f"Q{i}", "back": f"A{i}"} for i in range(5)]
    )

    response = ada.post(url, data={"text": "Cells.", "max_cards": "2"})

    assert [card["front"] for card in response.json()["cards"]] == ["Q0", "Q1"]


def test_unusable_cards_are_skipped_and_the_rest_kept(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic
) -> None:
    fake_anthropic.respond = reply(
        cards=[
            {"front": "   ", "back": "A"},
            {"front": "Q", "back": "nul\x00byte"},
            {"front": "x" * 10_001, "back": "A"},
            {"front": " Good ", "back": " Card "},
        ]
    )

    response = ada.post(url, data={"text": "Cells.", "max_cards": "1"})

    assert response.json() == {"cards": [{"front": "Good", "back": "Card"}]}


@pytest.mark.parametrize(
    "cards", [[], [{"front": " ", "back": " "}]], ids=["none", "all-invalid"]
)
def test_no_usable_cards_returns_a_clear_error(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic, cards: list[dict]
) -> None:
    fake_anthropic.respond = reply(cards=cards)

    response = ada.post(url, data={"text": "Cells."})

    assert response.status_code == 422
    assert "couldn't find anything" in response.json()["detail"]


@pytest.mark.parametrize(
    ("respond", "status_code", "message"),
    [
        (lambda _: httpx2.Response(429, json={}), 503, "busy"),
        (lambda _: httpx2.Response(500, json={}), 503, "busy"),
        (lambda _: httpx2.Response(529, json={}), 503, "busy"),
        (lambda _: httpx2.Response(400, json={}), 502, "rejected"),
        (lambda _: httpx2.Response(401, json={}), 502, "rejected"),
        (fail_with(httpx2.ConnectError), 503, "couldn't be reached"),
        (fail_with(httpx2.ReadTimeout), 504, "took too long"),
    ],
    ids=["429", "500", "529", "400", "401", "connection", "timeout"],
)
def test_api_failures_become_clear_errors(
    ada: TestClient,
    url: str,
    fake_anthropic: FakeAnthropic,
    respond: Responder,
    status_code: int,
    message: str,
) -> None:
    fake_anthropic.respond = respond

    response = ada.post(url, data={"text": "Cells."})

    assert response.status_code == status_code
    assert message in response.json()["detail"]


@pytest.mark.parametrize(
    "text", ["", '{"cards": [{"front": "cut o', "I can't help with that."]
)
def test_a_refusal_returns_a_clear_error(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic, text: str
) -> None:
    fake_anthropic.respond = reply(text=text, stop_reason="refusal")

    response = ada.post(url, data={"text": "Cells."})

    assert response.status_code == 422
    assert "declined" in response.json()["detail"]


@pytest.mark.parametrize("text", ['{"cards": [{"front": "cut o', ""])
def test_output_cut_off_by_the_token_limit_returns_a_clear_error(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic, text: str
) -> None:
    fake_anthropic.respond = reply(text=text, stop_reason="max_tokens")

    response = ada.post(url, data={"text": "Cells."})

    assert response.status_code == 502
    assert "cut off" in response.json()["detail"]


@pytest.mark.parametrize(
    "text", ['{"flashcards": []}', "not json at all", ""], ids=["shape", "json", "none"]
)
def test_output_that_does_not_match_the_schema_returns_a_clear_error(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic, text: str
) -> None:
    fake_anthropic.respond = reply(text=text)

    response = ada.post(url, data={"text": "Cells."})

    assert response.status_code == 502
    assert "couldn't be used" in response.json()["detail"]


def test_the_database_connection_is_released_before_calling_the_api(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic, db: Session
) -> None:
    in_transaction_during_call = []

    def respond(request: httpx2.Request) -> httpx2.Response:
        in_transaction_during_call.append(db.in_transaction())
        return reply()(request)

    fake_anthropic.respond = respond

    ada.post(url, data={"text": "Cells."})

    assert in_transaction_during_call == [False]


@pytest.mark.parametrize(
    "form",
    [
        {},
        {"data": {"text": "   "}},
        {"data": {"text": "both"}, "files": upload(make_pdf("both"))},
    ],
    ids=["neither", "blank", "both"],
)
def test_needs_exactly_one_source(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic, form: dict
) -> None:
    # Sends multipart even with no fields, as a browser's FormData does.
    form.setdefault("files", {"unused": ("", b"")})

    response = ada.post(url, **form)

    assert response.status_code == 422
    assert fake_anthropic.requests == []


@pytest.mark.parametrize("max_cards", ["0", "31", "many"])
def test_max_cards_is_validated(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic, max_cards: str
) -> None:
    response = ada.post(url, data={"text": "Cells.", "max_cards": max_cards})

    assert response.status_code == 422
    assert fake_anthropic.requests == []


def test_text_over_the_limit_is_rejected_before_calling_the_api(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic
) -> None:
    allowed = ada.post(url, data={"text": "x" * MAX_SOURCE_CHARS})
    rejected = ada.post(url, data={"text": "x" * (MAX_SOURCE_CHARS + 1)})

    assert allowed.status_code == 200
    assert rejected.status_code == 422
    assert "50,000" in rejected.json()["detail"]
    assert len(fake_anthropic.requests) == 1


def test_line_breaks_count_as_one_character_towards_the_limit(
    ada: TestClient, url: str, fake_anthropic: FakeAnthropic
) -> None:
    text = "x\r\n" * (MAX_SOURCE_CHARS // 2)

    response = ada.post(url, data={"text": text[:-2] + "x"})

    assert response.status_code == 200
    assert "\r" not in fake_anthropic.requests[0]["messages"][0]["content"]


@pytest.mark.parametrize(
    ("data", "status_code", "message"),
    [
        (b"not a pdf", 422, "isn't a PDF"),
        (make_blank_pdf(), 422, "no selectable text"),
        (make_pdf("x" * (MAX_SOURCE_CHARS + 1)), 422, "50,000"),
        (b"%PDF-" + b"x" * MAX_PDF_BYTES, 413, "10 MB"),
    ],
    ids=["not-a-pdf", "scanned", "too-much-text", "too-many-bytes"],
)
def test_bad_pdfs_are_rejected_before_calling_the_api(
    ada: TestClient,
    url: str,
    fake_anthropic: FakeAnthropic,
    data: bytes,
    status_code: int,
    message: str,
) -> None:
    response = ada.post(url, files=upload(data))

    assert response.status_code == status_code
    assert message in response.json()["detail"]
    assert fake_anthropic.requests == []


def test_another_users_deck_returns_404_without_calling_the_api(
    client_factory: Callable[[], TestClient],
    url: str,
    fake_anthropic: FakeAnthropic,
) -> None:
    mallory = signed_in(client_factory, "mallory@example.com")

    response = mallory.post(url, data={"text": "Cells."})

    assert response.status_code == 404
    assert fake_anthropic.requests == []


def test_returns_503_when_no_api_key_is_set(
    ada: TestClient, url: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", "")

    response = ada.post(url, data={"text": "Cells."})

    assert response.status_code == 503
    assert "isn't set up" in response.json()["detail"]


def test_the_client_is_built_from_settings_and_reused(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(settings, "anthropic_api_key", "configured-key")
    ai._create_client.cache_clear()

    client = get_anthropic_client()

    assert client.api_key == "configured-key"
    assert get_anthropic_client() is client
