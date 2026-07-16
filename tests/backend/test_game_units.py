import uuid
import unittest
from datetime import timedelta

from src.backend.game_repository import (
    DISCONNECT_GRACE_SECONDS,
    GAME_CLOSE_DELAY_SECONDS,
    disconnect_deadline,
    game_path,
    score_eligible_players,
    update_game_completion,
    utc_now,
)
from src.backend.game_rules import (
    BOARD_COPIES_PER_ITEM,
    DECK_COPIES_PER_ITEM,
    GAME_ITEM_IDS,
    GAME_ROUTE_TILE_COUNT,
    GAME_ROUTE_SHAPE_COUNT,
    create_initial_prisoner_positions,
    deal_initial_cards,
    generate_player_hands,
    generate_shuffled_deck,
    normalize_draw_pile,
    nearest_forward_tile,
    nearest_occupied_backward_tile,
    generate_route_tiles,
    is_valid_route_item_order,
    repeated_pair_count,
)
from src.backend.models import GamePlayer, GameSession, User


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

    def test_generated_route_can_use_short_test_count(self):
        tiles = generate_route_tiles(shape_id=2, tile_count=5)
        item_ids = [tile["item_id"] for tile in tiles]

        self.assertEqual(len(tiles), 5)
        self.assertEqual([tile["index"] for tile in tiles], [1, 2, 3, 4, 5])
        self.assertTrue(is_valid_route_item_order(item_ids))

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

    def test_initial_deal_leaves_shared_draw_pile(self):
        player_ids = ["player-one", "player-two", "player-three"]
        hands, draw_pile = deal_initial_cards("game-id", player_ids)
        all_cards = [
            card_id
            for cards in hands.values()
            for card_id in cards
        ] + draw_pile

        self.assertEqual(len(draw_pile), 108 - (6 * len(player_ids)))
        self.assertEqual(len(all_cards), 108)
        for item_id in GAME_ITEM_IDS:
            self.assertEqual(all_cards.count(item_id), DECK_COPIES_PER_ITEM)

    def test_normalized_draw_pile_excludes_cards_already_in_hands(self):
        deck = generate_shuffled_deck("legacy-game")
        hands = {
            "player-one": deck[:6],
            "player-two": deck[6:12],
        }
        draw_pile = normalize_draw_pile("legacy-game", hands, [])
        all_cards = hands["player-one"] + hands["player-two"] + draw_pile

        self.assertEqual(len(all_cards), 108)
        for item_id in GAME_ITEM_IDS:
            self.assertEqual(all_cards.count(item_id), DECK_COPIES_PER_ITEM)


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

    def test_score_eligible_players_keeps_finishers_after_leave(self):
        finished = GamePlayer(
          game_id=uuid.UUID("123e4567-e89b-12d3-a456-426614174000"),
          user_id=uuid.UUID("223e4567-e89b-12d3-a456-426614174111"),
          nickname="winner",
          team_color="green",
          is_host=False,
          card_count=6,
          prisoners_total=7,
          escaped_prisoners=7,
          finish_order=1,
          turn_order=1,
          status="left",
          can_rejoin=False,
          last_seen_at=utc_now(),
        )
        early_leaver = GamePlayer(
          game_id=uuid.UUID("123e4567-e89b-12d3-a456-426614174000"),
          user_id=uuid.UUID("323e4567-e89b-12d3-a456-426614174222"),
          nickname="leaver",
          team_color="purple",
          is_host=False,
          card_count=6,
          prisoners_total=7,
          escaped_prisoners=0,
          turn_order=2,
          status="left",
          can_rejoin=False,
          last_seen_at=utc_now(),
        )
        active = GamePlayer(
          game_id=uuid.UUID("123e4567-e89b-12d3-a456-426614174000"),
          user_id=uuid.UUID("423e4567-e89b-12d3-a456-426614174333"),
          nickname="runner",
          team_color="orange",
          is_host=False,
          card_count=6,
          prisoners_total=7,
          escaped_prisoners=0,
          turn_order=3,
          status="connected",
          can_rejoin=True,
          last_seen_at=utc_now(),
        )
        game = GameSession(
            id=uuid.UUID("123e4567-e89b-12d3-a456-426614174000"),
            lobby_id=uuid.UUID("523e4567-e89b-12d3-a456-426614174444"),
            status="active",
            route_tiles=[],
            hands={},
            draw_pile=[],
            prisoner_positions={},
            current_turn_order=3,
            actions_taken=0,
            actions_per_turn=3,
        )
        game.players = [finished, early_leaver, active]

        self.assertEqual(
            [player.nickname for player in score_eligible_players(game)],
            ["winner", "runner"],
        )

    def test_completion_timer_closes_game_and_records_stats_once(self):
        now = utc_now()
        winner_user = User(
            id=uuid.UUID("223e4567-e89b-12d3-a456-426614174111"),
            username="winner",
            email="winner@example.com",
            email_verified=True,
            matches_played=0,
            wins=0,
        )
        runner_user = User(
            id=uuid.UUID("323e4567-e89b-12d3-a456-426614174222"),
            username="runner",
            email="runner@example.com",
            email_verified=True,
            matches_played=2,
            wins=0,
        )
        winner = GamePlayer(
          game_id=uuid.UUID("123e4567-e89b-12d3-a456-426614174000"),
          user_id=winner_user.id,
          nickname="winner",
          team_color="green",
          is_host=False,
          card_count=0,
          prisoners_total=7,
          escaped_prisoners=7,
          finish_order=1,
          turn_order=1,
          status="finished",
          can_rejoin=True,
          last_seen_at=now,
        )
        winner.user = winner_user
        runner = GamePlayer(
          game_id=uuid.UUID("123e4567-e89b-12d3-a456-426614174000"),
          user_id=runner_user.id,
          nickname="runner",
          team_color="purple",
          is_host=False,
          card_count=6,
          prisoners_total=7,
          escaped_prisoners=0,
          turn_order=2,
          status="connected",
          can_rejoin=True,
          last_seen_at=now,
        )
        runner.user = runner_user
        game = GameSession(
            id=uuid.UUID("123e4567-e89b-12d3-a456-426614174000"),
            lobby_id=uuid.UUID("523e4567-e89b-12d3-a456-426614174444"),
            status="active",
            route_tiles=[],
            hands={},
            draw_pile=[],
            prisoner_positions={},
            current_turn_order=2,
            actions_taken=0,
            actions_per_turn=3,
            close_scheduled_at=now - timedelta(seconds=GAME_CLOSE_DELAY_SECONDS + 1),
        )
        game.players = [winner, runner]

        update_game_completion(game)
        update_game_completion(game)

        self.assertEqual(game.status, "closed")
        self.assertEqual(winner_user.matches_played, 1)
        self.assertEqual(winner_user.wins, 1)
        self.assertEqual(runner_user.matches_played, 3)
        self.assertEqual(runner_user.wins, 0)


class GameTurnRulesTest(unittest.TestCase):
    def test_initial_prisoners_start_for_each_player(self):
        positions = create_initial_prisoner_positions(["p1", "p2"])

        self.assertEqual(len(positions["p1"]), 7)
        self.assertEqual(len(positions["p2"]), 7)
        self.assertTrue(
            all(prisoner["position"] == "start" for prisoner in positions["p1"])
        )

    def test_nearest_forward_tile_skips_occupied_matches(self):
        route_tiles = [
            {"index": 1, "item_id": "stun-pistol"},
            {"index": 2, "item_id": "memory-drive"},
            {"index": 3, "item_id": "stun-pistol"},
        ]
        positions = {
            "p1": [{"id": "p1:p1", "owner_user_id": "p1", "index": 1, "position": "start"}],
            "p2": [{"id": "p2:p1", "owner_user_id": "p2", "index": 1, "position": 1}],
        }

        self.assertEqual(
            nearest_forward_tile(route_tiles, positions, "start", "stun-pistol"),
            3,
        )

    def test_nearest_backward_tile_requires_one_or_two_occupants(self):
        positions = {
            "p1": [{"id": "p1:p1", "owner_user_id": "p1", "index": 1, "position": 8}],
            "p2": [
                {"id": "p2:p1", "owner_user_id": "p2", "index": 1, "position": 7},
                {"id": "p2:p2", "owner_user_id": "p2", "index": 2, "position": 7},
                {"id": "p2:p3", "owner_user_id": "p2", "index": 3, "position": 7},
                {"id": "p2:p4", "owner_user_id": "p2", "index": 4, "position": 5},
            ],
        }

        self.assertEqual(nearest_occupied_backward_tile(positions, 8), 5)


if __name__ == "__main__":
    unittest.main()
