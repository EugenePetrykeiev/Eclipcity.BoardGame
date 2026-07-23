import os
import unittest

from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError


os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://test:test@127.0.0.1:5432/eclipcity_test",
)
os.environ.setdefault("FRONTEND_BASE_URL", "http://127.0.0.1:8080")
os.environ.setdefault("SESSION_SECRET_KEY", "test-secret-key-with-at-least-32-characters")

from src.backend.database import get_db  # noqa: E402
from src.backend.main import app  # noqa: E402


class ReadySession:
    async def execute(self, _statement):
        return None


class UnavailableSession:
    async def execute(self, _statement):
        raise SQLAlchemyError("database unavailable")


async def ready_database():
    yield ReadySession()


async def unavailable_database():
    yield UnavailableSession()


class HealthEndpointTest(unittest.TestCase):
    def tearDown(self):
        app.dependency_overrides.clear()

    def test_health_is_a_database_independent_liveness_probe(self):
        with TestClient(app) as client:
            response = client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ok"})

    def test_ready_returns_success_when_database_responds(self):
        app.dependency_overrides[get_db] = ready_database

        with TestClient(app) as client:
            response = client.get("/ready")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "ready"})

    def test_ready_returns_service_unavailable_when_database_fails(self):
        app.dependency_overrides[get_db] = unavailable_database

        with TestClient(app) as client:
            response = client.get("/ready")

        self.assertEqual(response.status_code, 503)
        self.assertEqual(response.json(), {"detail": "Database is unavailable."})


if __name__ == "__main__":
    unittest.main()
