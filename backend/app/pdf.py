from io import BytesIO

from pypdf import PdfReader

MAX_PDF_BYTES = 10 * 1024 * 1024
# Stops a small file with a huge number of empty pages from tying up a worker.
MAX_PDF_PAGES = 500


class PdfError(ValueError):
    """A problem with an uploaded PDF, with a message that's safe to show the user."""


def extract_text(data: bytes, max_chars: int) -> str:
    """Return the text of a PDF, stopping as soon as it goes over max_chars."""
    # Readers accept stray bytes before the header, so this looks past them too.
    if b"%PDF-" not in data[:1024]:
        raise PdfError("This file isn't a PDF.")

    pages = []
    total = 0
    try:
        reader = PdfReader(BytesIO(data))
        # Many protected PDFs only restrict editing, so they open with an empty password.
        if reader.is_encrypted and not reader.decrypt(""):
            raise PdfError("This PDF is password-protected.")
        if len(reader.pages) > MAX_PDF_PAGES:
            raise PdfError(
                f"This PDF has more than {MAX_PDF_PAGES} pages. Try a shorter document."
            )
        for page in reader.pages:
            text = page.extract_text()
            pages.append(text)
            total += len(text)
            if total > max_chars:
                raise PdfError(
                    f"This PDF has more than {max_chars:,} characters of text. "
                    "Try a shorter document."
                )
    except PdfError:
        raise
    # A malformed file can make pypdf raise almost anything, not only its own errors.
    except Exception as error:
        raise PdfError("This PDF couldn't be read.") from error

    # Extracted text can hold NUL characters, which cards can't store, and unpaired
    # surrogates, which can't be sent as UTF-8.
    source = "\n\n".join(pages).replace("\x00", "")
    source = source.encode("utf-8", "ignore").decode("utf-8").strip()
    if not source:
        raise PdfError(
            "This PDF has no selectable text. Scanned documents aren't supported yet."
        )
    return source
