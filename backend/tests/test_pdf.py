import pytest
from pdf_helpers import encrypt_pdf, make_blank_pdf, make_pdf
from pypdf import PageObject

from app.pdf import MAX_PDF_PAGES, PdfError, extract_text

LIMIT = 50_000


def test_extracts_text_from_every_page() -> None:
    text = extract_text(make_pdf("Mitochondria", "Ribosomes (small)"), LIMIT)

    assert "Mitochondria" in text
    assert "Ribosomes (small)" in text


@pytest.mark.parametrize(
    ("data", "message"),
    [
        (b"", "isn't a PDF"),
        (b"plain text pretending", "isn't a PDF"),
        (b"%PDF-1.4\nthis is not really a pdf", "couldn't be read"),
        (make_pdf("Truncated")[:60], "couldn't be read"),
        (make_blank_pdf(), "no selectable text"),
        (encrypt_pdf(make_pdf("Secret"), "password"), "password-protected"),
        (encrypt_pdf(make_pdf("Secret"), "password", "RC4-128"), "password-protected"),
    ],
    ids=["empty", "not-pdf", "corrupt", "truncated", "blank", "aes", "rc4"],
)
def test_unusable_pdfs_get_a_clear_error(data: bytes, message: str) -> None:
    with pytest.raises(PdfError, match=message):
        extract_text(data, LIMIT)


def test_reads_a_protected_pdf_that_has_no_open_password() -> None:
    data = encrypt_pdf(make_pdf("Readable anyway"), "")

    assert "Readable anyway" in extract_text(data, LIMIT)


def test_reads_a_pdf_with_stray_bytes_before_the_header() -> None:
    assert "Readable anyway" in extract_text(
        b"\n\n" + make_pdf("Readable anyway"), LIMIT
    )


def test_rejects_too_many_pages_before_reading_them(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pages_read = []
    monkeypatch.setattr(
        PageObject, "extract_text", lambda page: pages_read.append(page)
    )

    with pytest.raises(PdfError, match=f"more than {MAX_PDF_PAGES} pages"):
        extract_text(make_pdf(*["x"] * (MAX_PDF_PAGES + 1)), LIMIT)

    assert pages_read == []


def test_rejects_text_over_the_limit_and_says_so() -> None:
    with pytest.raises(PdfError, match="more than 10 characters"):
        extract_text(make_pdf("x" * 11), 10)


def test_stops_reading_as_soon_as_the_limit_is_passed(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    pages_read = []
    original = PageObject.extract_text

    def counting(self, *args, **kwargs):
        pages_read.append(self)
        return original(self, *args, **kwargs)

    monkeypatch.setattr(PageObject, "extract_text", counting)

    with pytest.raises(PdfError):
        extract_text(make_pdf("x" * 20, "y", "z"), 10)

    assert len(pages_read) == 1


def test_removes_characters_that_cannot_be_stored_or_encoded(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(PageObject, "extract_text", lambda self: "a\x00b\ud800c")

    assert extract_text(make_pdf("ignored"), LIMIT) == "abc"
