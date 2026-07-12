import random


BOARD_COPIES_PER_ITEM = 5
DECK_COPIES_PER_ITEM = 12
GAME_ROUTE_TILE_COUNT = 45
GAME_ROUTE_SHAPE_COUNT = 10
STARTING_CARD_COUNT = 6
PRISONERS_PER_PLAYER = 7
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


def generate_route_item_order() -> list[str]:
    item_pool = [
        item_id
        for item_id in GAME_ITEM_IDS
        for _ in range(BOARD_COPIES_PER_ITEM)
    ]

    for _ in range(2000):
        candidate = item_pool[:]
        random.shuffle(candidate)
        if is_valid_route_item_order(candidate):
            return candidate

    raise RuntimeError("Unable to generate a valid 45-tile route.")


def generate_route_tiles(shape_id: int | None = None) -> list[dict]:
    route_shape_id = (
        random.randrange(GAME_ROUTE_SHAPE_COUNT)
        if shape_id is None
        else shape_id % GAME_ROUTE_SHAPE_COUNT
    )

    return [
        {"index": index + 1, "item_id": item_id, "shape_id": route_shape_id}
        for index, item_id in enumerate(generate_route_item_order())
    ]


def generate_player_hands(
    game_id: str,
    player_ids: list[str],
    card_count_by_player: dict[str, int],
) -> dict[str, list[str]]:
    deck = [
        item_id
        for item_id in GAME_ITEM_IDS
        for _ in range(DECK_COPIES_PER_ITEM)
    ]
    random.Random(game_id).shuffle(deck)

    hands: dict[str, list[str]] = {}
    cursor = 0
    for player_id in player_ids:
        card_count = card_count_by_player.get(player_id, STARTING_CARD_COUNT)
        hands[player_id] = deck[cursor:cursor + card_count]
        cursor += card_count

    return hands
