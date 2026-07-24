import random
from collections import Counter

from .level_generation import LEVEL_SHAPES, build_level_coordinates


BOARD_COPIES_PER_ITEM = 5
DECK_COPIES_PER_ITEM = 12
GAME_ROUTE_TILE_COUNT = 45
GAME_ROUTE_SHAPE_COUNT = len(LEVEL_SHAPES)
STARTING_CARD_COUNT = 6
PRISONERS_PER_PLAYER = 7
ACTIONS_PER_TURN = 3
TEAM_COLORS = ("green", "purple", "orange", "pink", "turquoise")
GAME_ITEM_IDS = (
    "neural-implant",
    "screen-terminal",
    "memory-drive",
    "power-battery",
    "whiskey-bottle",
    "crypto-card",
    "stun-pistol",
    "tunnel-map",
    "boost-shoes",
)


def repeated_pair_count(item_ids: list[str]) -> int:
    return sum(
        1
        for index in range(1, len(item_ids))
        if item_ids[index] == item_ids[index - 1]
    )


def has_three_in_a_row(item_ids: list[str]) -> bool:
    return any(
        item_ids[index] == item_ids[index - 1] == item_ids[index - 2]
        for index in range(2, len(item_ids))
    )


def is_valid_route_item_order(item_ids: list[str]) -> bool:
    return not has_three_in_a_row(item_ids) and repeated_pair_count(item_ids) <= 1


def generate_route_item_order(tile_count: int = GAME_ROUTE_TILE_COUNT) -> list[str]:
    if tile_count < 1 or tile_count > GAME_ROUTE_TILE_COUNT:
        raise ValueError("Route tile count must be between 1 and 45.")

    item_pool = [
        item_id
        for item_id in GAME_ITEM_IDS
        for _ in range(BOARD_COPIES_PER_ITEM)
    ]

    for _ in range(2000):
        candidate = item_pool[:]
        random.shuffle(candidate)
        candidate = candidate[:tile_count]
        if is_valid_route_item_order(candidate):
            return candidate

    raise RuntimeError(f"Unable to generate a valid {tile_count}-tile route.")


def generate_route_tiles(
    shape_id: int | None = None,
    tile_count: int = GAME_ROUTE_TILE_COUNT,
) -> list[dict]:
    route_shape_id = (
        random.randrange(GAME_ROUTE_SHAPE_COUNT)
        if shape_id is None
        else shape_id % GAME_ROUTE_SHAPE_COUNT
    )

    coordinates = build_level_coordinates(tile_count, route_shape_id)
    return [
        {
            "index": index + 1,
            "item_id": item_id,
            "shape_id": route_shape_id,
            "grid_x": coordinates[index][0],
            "grid_y": coordinates[index][1],
        }
        for index, item_id in enumerate(generate_route_item_order(tile_count))
    ]


def generate_player_hands(
    game_id: str,
    player_ids: list[str],
    card_count_by_player: dict[str, int],
) -> dict[str, list[str]]:
    deck = generate_shuffled_deck(game_id)

    hands: dict[str, list[str]] = {}
    cursor = 0
    for player_id in player_ids:
        card_count = card_count_by_player.get(player_id, STARTING_CARD_COUNT)
        hands[player_id] = deck[cursor:cursor + card_count]
        cursor += card_count

    return hands


def generate_shuffled_deck(game_id: str) -> list[str]:
    deck = [
        item_id
        for item_id in GAME_ITEM_IDS
        for _ in range(DECK_COPIES_PER_ITEM)
    ]
    random.Random(game_id).shuffle(deck)
    return deck


def deal_initial_cards(
    game_id: str,
    player_ids: list[str],
    card_count: int = STARTING_CARD_COUNT,
) -> tuple[dict[str, list[str]], list[str]]:
    deck = generate_shuffled_deck(game_id)
    hands: dict[str, list[str]] = {}
    cursor = 0

    for player_id in player_ids:
        hands[player_id] = deck[cursor:cursor + card_count]
        cursor += card_count

    return hands, deck[cursor:]


def create_initial_prisoner_positions(player_ids: list[str]) -> dict[str, list[dict]]:
    return {
        player_id: [
            {
                "id": f"{player_id}:p{index + 1}",
                "owner_user_id": player_id,
                "index": index + 1,
                "position": "start",
            }
            for index in range(PRISONERS_PER_PLAYER)
        ]
        for player_id in player_ids
    }


def normalize_game_hands(
    game_id: str,
    player_ids: list[str],
    hands: dict | None,
    card_count_by_player: dict[str, int],
) -> dict[str, list[str]]:
    if hands:
        return {str(player_id): list(cards) for player_id, cards in hands.items()}
    return generate_player_hands(game_id, player_ids, card_count_by_player)


def normalize_draw_pile(
    game_id: str,
    hands: dict[str, list[str]],
    draw_pile: list[str] | None,
) -> list[str]:
    if draw_pile:
        return list(draw_pile)

    remaining_cards = Counter(generate_shuffled_deck(game_id))
    for cards in hands.values():
        remaining_cards.subtract(cards)

    normalized: list[str] = []
    for item_id in generate_shuffled_deck(f"{game_id}:draw-pile"):
        if remaining_cards[item_id] > 0:
            normalized.append(item_id)
            remaining_cards[item_id] -= 1

    return normalized


def normalize_prisoner_positions(
    player_ids: list[str],
    prisoner_positions: dict | None,
) -> dict[str, list[dict]]:
    if prisoner_positions:
        return {
            str(player_id): [dict(prisoner) for prisoner in prisoners]
            for player_id, prisoners in prisoner_positions.items()
        }
    return create_initial_prisoner_positions(player_ids)


def flatten_prisoners(prisoner_positions: dict[str, list[dict]]) -> list[dict]:
    return [
        prisoner
        for prisoners in prisoner_positions.values()
        for prisoner in prisoners
    ]


def tile_occupants(prisoner_positions: dict[str, list[dict]], tile_index: int) -> list[dict]:
    return [
        prisoner
        for prisoner in flatten_prisoners(prisoner_positions)
        if prisoner.get("position") == tile_index
    ]


def find_prisoner(
    prisoner_positions: dict[str, list[dict]],
    owner_user_id: str,
    prisoner_id: str,
) -> dict | None:
    return next(
        (
            prisoner
            for prisoner in prisoner_positions.get(owner_user_id, [])
            if prisoner.get("id") == prisoner_id
        ),
        None,
    )


def first_start_prisoner(
    prisoner_positions: dict[str, list[dict]],
    owner_user_id: str,
) -> dict | None:
    return next(
        (
            prisoner
            for prisoner in prisoner_positions.get(owner_user_id, [])
            if prisoner.get("position") == "start"
        ),
        None,
    )


def count_escaped(prisoners: list[dict]) -> int:
    return sum(1 for prisoner in prisoners if prisoner.get("position") == "exit")


def nearest_forward_tile(
    route_tiles: list[dict],
    prisoner_positions: dict[str, list[dict]],
    from_position: str | int,
    item_id: str,
) -> int | str:
    current_index = 0 if from_position == "start" else int(from_position)
    for tile in route_tiles:
        tile_index = int(tile["index"])
        if tile_index <= current_index:
            continue
        if tile.get("item_id") != item_id:
            continue
        if not tile_occupants(prisoner_positions, tile_index):
            return tile_index
    return "exit"


def nearest_occupied_backward_tile(
    prisoner_positions: dict[str, list[dict]],
    from_position: int,
) -> int | None:
    occupied_indexes = sorted(
        {
            int(prisoner["position"])
            for prisoner in flatten_prisoners(prisoner_positions)
            if isinstance(prisoner.get("position"), int)
            and int(prisoner["position"]) < from_position
        },
        reverse=True,
    )
    for tile_index in occupied_indexes:
        occupants = tile_occupants(prisoner_positions, tile_index)
        if 1 <= len(occupants) <= 2:
            return tile_index
    return None
