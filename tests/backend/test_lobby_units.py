import unittest

from pydantic import ValidationError

from src.backend.lobby_utils import (
    LOBBY_CODE_ALPHABET,
    create_lobby_code,
    lobby_path,
    normalize_lobby_code,
)
from src.backend.schemas import (
    DEFAULT_LOBBY_NAME,
    LobbyCreateRequest,
    LobbyPlayerUpdateRequest,
    normalize_lobby_name,
)


class LobbyNameSchemaTest(unittest.TestCase):
    def test_empty_lobby_name_uses_default(self):
        self.assertEqual(normalize_lobby_name(None), DEFAULT_LOBBY_NAME)
        self.assertEqual(normalize_lobby_name("   "), DEFAULT_LOBBY_NAME)
        self.assertEqual(
            LobbyCreateRequest(name="", max_players=5).name,
            DEFAULT_LOBBY_NAME,
        )

    def test_lobby_name_is_trimmed_and_validated(self):
        self.assertEqual(normalize_lobby_name("  Run#7  "), "Run#7")
        self.assertEqual(normalize_lobby_name("Київ!"), "Київ!")
        self.assertEqual(normalize_lobby_name("abcdefghijklmno"), "abcdefghijklmno")

    def test_lobby_name_rejects_bad_length_and_symbols(self):
        with self.assertRaises(ValueError):
            normalize_lobby_name("ab")

        with self.assertRaises(ValueError):
            normalize_lobby_name("abcdefghijklmnop")

        with self.assertRaises(ValueError):
            normalize_lobby_name("bad_name")

    def test_create_request_validates_player_count(self):
        with self.assertRaises(ValidationError):
            LobbyCreateRequest(name="Run#7", max_players=1)

        with self.assertRaises(ValidationError):
            LobbyCreateRequest(name="Run#7", max_players=6)


class LobbyTeamSchemaTest(unittest.TestCase):
    def test_team_color_accepts_known_values(self):
        payload = LobbyPlayerUpdateRequest(team_color="green")

        self.assertEqual(payload.team_color, "green")

    def test_team_color_rejects_unknown_values(self):
        with self.assertRaises(ValidationError):
            LobbyPlayerUpdateRequest(team_color="blue")


class LobbyCodeUtilsTest(unittest.TestCase):
    def test_lobby_code_normalization_and_path(self):
        self.assertEqual(normalize_lobby_code(" ab12c "), "AB12C")
        self.assertEqual(lobby_path(" ab12c "), "/lobby/AB12C")

    def test_created_lobby_code_shape(self):
        code = create_lobby_code()

        self.assertEqual(len(code), 5)
        self.assertTrue(all(character in LOBBY_CODE_ALPHABET for character in code))


if __name__ == "__main__":
    unittest.main()
