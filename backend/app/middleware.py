from fastapi import HTTPException, status
from starlette.types import ASGIApp, Message, Receive, Scope, Send

UPLOAD_PATH_SUFFIX = "/generate"


class BodySizeLimitMiddleware:
    """Rejects oversized requests, which would otherwise be buffered or spooled to disk.

    FastAPI reads the body before it runs dependencies, so a limit inside a route
    would apply too late and wouldn't protect against anonymous requests.
    """

    def __init__(self, app: ASGIApp, max_bytes: int, max_upload_bytes: int) -> None:
        self.app = app
        self.max_bytes = max_bytes
        self.max_upload_bytes = max_upload_bytes

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        is_upload = scope["path"].endswith(UPLOAD_PATH_SUFFIX)
        limit = self.max_upload_bytes if is_upload else self.max_bytes
        received = 0

        async def limited_receive() -> Message:
            # Counting covers chunked requests, which have no Content-Length to check.
            nonlocal received
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > limit:
                    raise HTTPException(
                        status.HTTP_413_CONTENT_TOO_LARGE, "The request is too large"
                    )
            return message

        await self.app(scope, limited_receive, send)
