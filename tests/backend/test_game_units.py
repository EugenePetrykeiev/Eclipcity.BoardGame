import uuid
import unittest
from datetime import timedelta

from src.backend.game_repository import (
    DISCONNECT_GRACE_SECONDS,
    disconnect_deadline,
    game_path,
    utc_now,
)
from src.backend.game_rules import (
    BOARD_COPIES_PER_ITEM,
    DECK_COPIES_PER_ITEM,
    GAME_ITEM_IDS,
    GAME_ROUTE_TILE_COUNT,
    GAME_ROUTE_SHAPE_COUNT,
    generate_player_hands,
    generate_route_tiles,
    is_valid_route_item_order,
    repeated_pair_count,
)
from src.backend.models import GamePlayer


class GameRouteRulesTest(unittest.TestCase):
    def test_generated_route_matches_manifest_counts(self):
        tiles = generate_route_tiles()
        item_ids = [tile["item_id"] for tile in tiles]

        self.assertEqual(len(tiles), GAME_ROUTE_TILE_COUNT)
        self.assertEqual(len(set(item_ids)), len(GAME_ITEM_IDS))
        self.assertEqual(DECK_COPIES_PER_ITEM * len(GAME_ITEM_IDS), 108)

        for item_id in GAME_ITEM_IDS:
            self.assertEqual(item_ids.count(item_id), BOARD_COPIES_PER_ITEM)

    def test_generated_route_respects_repeat_rules(self):
        item_ids = [tile["item_id"] for tile in generate_route_tiles()]

        self.assertTrue(is_valid_route_item_order(item_ids))
        self.assertLessEqual(repeated_pair_count(item_ids), 1)

    def test_generated_route_carries_one_of_ten_shape_ids(self):
        tiles = generate_route_tiles(shape_id=9)
        shape_ids = {tile["shape_id"] for tile in tiles}

        self.assertEqual(shape_ids, {9})
        self.assertEqual(GAME_ROUTE_SHAPE_COUNT, 10)
        self.assertEqual(generate_route_tiles(shape_id=10)[0]["shape_id"], 0)

    def test_player_hands_are_dealt_from_one_shuffled_deck(self):
        player_ids = ["player-one", "player-two", "player-three"]
        hands = generate_player_hands(
            "game-id",
            player_ids,
            {player_id: 6 for player_id in player_ids},
        )

        self.assertEqual(set(hands.keys()), set(player_ids))
        self.assertTrue(all(len(hand) == 6 for hand in hands.values()))
        self.assertNotEqual(hands["player-one"], hands["player-two"])


class GameSessionUtilsTest(unittest.TestCase):
    def test_game_path_uses_uuid_endpoint(self):
        game_id = uuid.UUID("123e4567-e89b-12d3-a456-426614174000")

        self.assertEqual(game_path(game_id), "/game/123e4567-e89b-12d3-a456-426614174000")

    def test_disconnect_deadline_uses_two_minute_window(self):
        disconnected_at = utc_now()
        player = GamePlayer(
          game_id=uuid.UUID("123e4567-e89b-12d3-a456-426614174000"),
          user_id=uuid.UUID("223e4567-e89b-12d3-a456-426614174111"),
          nickname="runner",
          team_color="green",
          is_host=False,
          card_count=6,
          prisoners_total=7,
          escaped_prisoners=0,
          turn_order=1,
          status="disconnected",
          can_rejoin=True,
          disconnected_at=disconnected_at,
          last_seen_at=disconnected_at,
        )

        self.assertEqual(
            disconnect_deadline(player),
            disconnected_at + timedelta(seconds=DISCONNECT_GRACE_SECONDS),
        )


if __name__ == "__main__":
    unittest.main()
