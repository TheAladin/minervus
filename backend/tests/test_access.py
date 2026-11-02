import re

from fastapi.testclient import TestClient

from app.main import app

PUBLIC_ROUTES = {
    "/api/health",
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/logout",
}


def test_every_other_api_route_requires_a_session(client: TestClient) -> None:
    paths = app.openapi()["paths"]
    assert PUBLIC_ROUTES < set(paths)

    for path, operations in paths.items():
        if path in PUBLIC_ROUTES:
            continue
        url = re.sub(r"\{\w+\}", "1", path)
        for method in operations:
            response = client.request(method, url)
            assert response.status_code == 401, f"{method} {path} is public"
