import os
import unittest

from fastapi.testclient import TestClient


os.environ.setdefault(
    "DATABASE_URL",
    "postgresql+asyncpg://test:test@127.0.0.1:5432/eclipcity_test",
)
os.environ.setdefault("FRONTEND_BASE_URL", "http://127.0.0.1:8080")
os.environ.setdefault("SESSION_SECRET_KEY", "test-secret-key-with-at-least-32-characters")

from src.backend.level_generation import (  # noqa: E402
    LEVEL_SHAPES,
    generate_level_preview,
)
from src.backend.main import app  # noqa: E402


class LevelGenerationTest(unittest.TestCase):
    def test_every_standard_shape_satisfies_the_level_manifest(self):
        for shape_id in range(len(LEVEL_SHAPES)):
            with self.subTest(shape_id=shape_id):
                level = generate_level_preview(shape_id=shape_id)

                self.assertEqual(level["tile_count"], 45)
                self.assertTrue(level["validation"]["valid"])
                self.assertTrue(all(level["validation"]["checks"].values()))

    def test_level_is_centered_from_its_actual_bounds(self):
        level = generate_level_preview(
            shape_id=3,
            board_width=2048,
            board_height=900,
        )

        self.assertEqual(level["layout"]["center_error"], {"x": 0.0, "y": 0.0})
        self.assertTrue(level["validation"]["checks"]["centered"])
        self.assertTrue(level["validation"]["checks"]["fits_board"])

    def test_test_endpoint_exposes_geometry_and_validation(self):
        with TestClient(app) as client:
            response = client.get(
                "/test/level-generation",
                params={
                    "shape_id": 4,
                    "tile_count": 45,
                    "board_width": 1920,
                    "board_height": 900,
                },
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["shape_id"], 4)
        self.assertEqual(len(payload["coordinates"]), 45)
        self.assertTrue(payload["validation"]["valid"])
        self.assertEqual(payload["layout"]["center_error"], {"x": 0.0, "y": 0.0})

    def test_test_endpoint_rejects_an_invalid_board(self):
        with TestClient(app) as client:
            response = client.get(
                "/test/level-generation",
                params={"board_width": 59},
            )

        self.assertEqual(response.status_code, 422)
        self.assertEqual(
            response.json(),
            {"detail": "Board must be at least 60 by 60 pixels."},
        )


if __name__ == "__main__":
    unittest.main()
