import pytest

from app.config import settings
from scripts import prepare_e2e_db


def test_refuses_to_recreate_any_other_database(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    # The server is unreachable, so if the guard were missing the drop would fail too.
    monkeypatch.setattr(
        settings, "database_url", "postgresql+psycopg://nobody@127.0.0.1:1/minervus"
    )

    assert prepare_e2e_db.main() == 1
    assert "must point at minervus_e2e" in capsys.readouterr().err
