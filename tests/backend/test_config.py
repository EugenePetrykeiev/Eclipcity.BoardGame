import unittest

from pydantic import ValidationError

from src.backend.config import Settings


class DatabaseConfigurationTest(unittest.TestCase):
    def make_settings(self, **overrides):
        values = {
            "database_url": None,
            "postgres_host": "postgres.internal.test",
            "postgres_port": 5432,
            "postgres_db": "eclipcity",
            "postgres_user": "eclipcity",
            "postgres_password": "password with spaces",
            "frontend_base_url": "http://127.0.0.1:8080",
            "session_secret_key": "test-secret-key-with-at-least-32-characters",
        }
        values.update(overrides)
        return Settings(_env_file=None, **values)

    def test_builds_asyncpg_url_with_required_tls(self):
        settings = self.make_settings(postgres_ssl_mode="require")

        self.assertEqual(
            settings.database_url,
            "postgresql+asyncpg://eclipcity:password+with+spaces"
            "@postgres.internal.test:5432/eclipcity?ssl=require",
        )

    def test_local_database_defaults_to_disabled_tls(self):
        settings = self.make_settings()

        self.assertTrue(str(settings.database_url).endswith("?ssl=disable"))

    def test_rejects_unknown_ssl_mode(self):
        with self.assertRaises(ValidationError):
            self.make_settings(postgres_ssl_mode="trust-everything")


if __name__ == "__main__":
    unittest.main()
