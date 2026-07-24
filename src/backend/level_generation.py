import random


TILE_SIZE = 60
TILE_GAP = 20
GRID_STEP = TILE_SIZE + TILE_GAP
STANDARD_TILE_COUNT = 45

LEVEL_SHAPES = (
    ((0, 7), ((1, 0, 4), (0, -1, 3), (-1, 0, 4), (0, -1, 4), (1, 0, 3), (0, 1, 3), (1, 0, 3), (0, 1, 4), (1, 0, 4), (0, -1, 3), (-1, 0, 3), (0, -1, 3), (1, 0, 3))),
    ((0, 7), ((1, 0, 3), (0, -1, 3), (-1, 0, 3), (0, -1, 3), (1, 0, 4), (0, 1, 4), (1, 0, 3), (0, -1, 4), (1, 0, 4), (0, 1, 3), (-1, 0, 3), (0, 1, 3), (-1, 0, 4))),
    ((0, 7), ((1, 0, 3), (0, -1, 3), (-1, 0, 3), (0, -1, 4), (1, 0, 3), (0, 1, 3), (1, 0, 4), (0, -1, 3), (1, 0, 3), (0, 1, 4), (-1, 0, 4), (0, 1, 3), (1, 0, 4))),
    ((0, 7), ((1, 0, 3), (0, -1, 4), (-1, 0, 3), (0, -1, 3), (1, 0, 4), (0, 1, 4), (1, 0, 3), (0, -1, 3), (1, 0, 4), (0, 1, 3), (-1, 0, 3), (0, 1, 3), (-1, 0, 4))),
    ((0, 7), ((1, 0, 3), (0, -1, 3), (-1, 0, 3), (0, -1, 4), (1, 0, 4), (0, 1, 3), (1, 0, 4), (0, -1, 3), (1, 0, 3), (0, 1, 4), (-1, 0, 4), (0, 1, 3), (-1, 0, 3))),
    ((0, 7), ((1, 0, 4), (0, -1, 4), (-1, 0, 3), (0, -1, 3), (1, 0, 4), (0, 1, 4), (1, 0, 3), (0, 1, 3), (1, 0, 3), (0, -1, 4), (-1, 0, 3), (0, -1, 3), (1, 0, 3))),
    ((0, 7), ((1, 0, 3), (0, -1, 3), (-1, 0, 3), (0, -1, 3), (1, 0, 4), (0, 1, 3), (1, 0, 4), (0, 1, 3), (1, 0, 3), (0, -1, 4), (-1, 0, 4), (0, -1, 3), (1, 0, 4))),
)


def build_level_coordinates(tile_count: int, shape_id: int) -> list[tuple[int, int]]:
    if tile_count < 1 or tile_count > STANDARD_TILE_COUNT:
        raise ValueError("Route tile count must be between 1 and 45.")

    start, segments = LEVEL_SHAPES[shape_id % len(LEVEL_SHAPES)]
    coordinates = [start]
    for delta_x, delta_y, length in segments:
        for _ in range(length):
            if len(coordinates) >= tile_count:
                return coordinates
            x, y = coordinates[-1]
            coordinates.append((x + delta_x, y + delta_y))
    return coordinates


def _orthogonal_neighbors(point: tuple[int, int]) -> tuple[tuple[int, int], ...]:
    x, y = point
    return ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1))


def find_exit_coordinate(
    coordinates: list[tuple[int, int]],
) -> tuple[int, int] | None:
    if len(coordinates) < 2:
        return None

    previous_x, previous_y = coordinates[-2]
    last_x, last_y = coordinates[-1]
    direction = (last_x - previous_x, last_y - previous_y)
    perpendicular = (-direction[1], direction[0])
    used = set(coordinates)
    other_route_points = set(coordinates[:-1])
    candidates = (
        (last_x + direction[0], last_y + direction[1]),
        (last_x + perpendicular[0], last_y + perpendicular[1]),
        (last_x - perpendicular[0], last_y - perpendicular[1]),
    )

    for candidate in candidates:
        if candidate in used:
            continue
        if any(neighbor in other_route_points for neighbor in _orthogonal_neighbors(candidate)):
            continue
        return candidate
    return None


def _straight_segment_lengths(coordinates: list[tuple[int, int]]) -> list[int]:
    if len(coordinates) < 2:
        return []

    lengths: list[int] = []
    previous_direction = None
    current_length = 0
    for first, second in zip(coordinates, coordinates[1:]):
        direction = (second[0] - first[0], second[1] - first[1])
        if direction == previous_direction:
            current_length += 1
        else:
            if current_length:
                lengths.append(current_length)
            previous_direction = direction
            current_length = 1
    lengths.append(current_length)
    return lengths


def center_level(
    coordinates: list[tuple[int, int]],
    exit_coordinate: tuple[int, int],
    board_width: int,
    board_height: int,
) -> dict:
    all_coordinates = [*coordinates, exit_coordinate]
    min_column = min(point[0] for point in all_coordinates)
    max_column = max(point[0] for point in all_coordinates)
    min_row = min(point[1] for point in all_coordinates)
    max_row = max(point[1] for point in all_coordinates)
    route_width = (max_column - min_column) * GRID_STEP
    route_height = (max_row - min_row) * GRID_STEP
    offset_x = (board_width - route_width) / 2 - min_column * GRID_STEP
    offset_y = (board_height - route_height) / 2 - min_row * GRID_STEP

    def to_pixel(point: tuple[int, int]) -> dict[str, float]:
        return {
            "x": round(offset_x + point[0] * GRID_STEP, 2),
            "y": round(offset_y + point[1] * GRID_STEP, 2),
        }

    pixels = [to_pixel(point) for point in coordinates]
    exit_pixel = to_pixel(exit_coordinate)
    rendered = [*pixels, exit_pixel]
    rendered_center_x = (min(point["x"] for point in rendered) + max(point["x"] for point in rendered)) / 2
    rendered_center_y = (min(point["y"] for point in rendered) + max(point["y"] for point in rendered)) / 2

    return {
        "offset": {"x": round(offset_x, 2), "y": round(offset_y, 2)},
        "tiles": pixels,
        "exit": exit_pixel,
        "bounds": {
            "left": min(point["x"] for point in rendered) - TILE_SIZE / 2,
            "right": max(point["x"] for point in rendered) + TILE_SIZE / 2,
            "top": min(point["y"] for point in rendered) - TILE_SIZE / 2,
            "bottom": max(point["y"] for point in rendered) + TILE_SIZE / 2,
        },
        "center_error": {
            "x": round(rendered_center_x - board_width / 2, 2),
            "y": round(rendered_center_y - board_height / 2, 2),
        },
    }


def validate_level(
    coordinates: list[tuple[int, int]],
    exit_coordinate: tuple[int, int] | None,
    centered: dict | None = None,
) -> dict:
    unique_tiles = len(set(coordinates)) == len(coordinates)
    orthogonal_path = all(
        abs(first[0] - second[0]) + abs(first[1] - second[1]) == 1
        for first, second in zip(coordinates, coordinates[1:])
    )
    route_edges = {
        frozenset((first, second))
        for first, second in zip(coordinates, coordinates[1:])
    }
    no_duplicate_edges = len(route_edges) == max(0, len(coordinates) - 1)
    exit_is_safe = (
        exit_coordinate is not None
        and exit_coordinate not in set(coordinates)
        and abs(exit_coordinate[0] - coordinates[-1][0])
        + abs(exit_coordinate[1] - coordinates[-1][1])
        == 1
        and not any(
            neighbor in set(coordinates[:-1])
            for neighbor in _orthogonal_neighbors(exit_coordinate)
        )
    )
    segment_lengths = _straight_segment_lengths(coordinates)
    segment_lengths_valid = all(3 <= length <= 4 for length in segment_lengths)
    centered_correctly = centered is None or (
        abs(centered["center_error"]["x"]) <= 0.01
        and abs(centered["center_error"]["y"]) <= 0.01
    )
    fits_board = centered is None or (
        centered["bounds"]["left"] >= 0
        and centered["bounds"]["right"] <= centered["board"]["width"]
        and centered["bounds"]["top"] >= 0
        and centered["bounds"]["bottom"] <= centered["board"]["height"]
    )
    checks = {
        "tile_count": len(coordinates) <= STANDARD_TILE_COUNT,
        "unique_tiles": unique_tiles,
        "orthogonal_path": orthogonal_path,
        "no_crossings_or_duplicate_edges": unique_tiles and no_duplicate_edges,
        "segment_lengths_3_to_4": segment_lengths_valid,
        "safe_exit": exit_is_safe,
        "centered": centered_correctly,
        "fits_board": fits_board,
    }
    return {
        "valid": all(checks.values()),
        "checks": checks,
        "segment_lengths": segment_lengths,
    }


def generate_level_preview(
    shape_id: int | None = None,
    tile_count: int = STANDARD_TILE_COUNT,
    board_width: int = 1920,
    board_height: int = 900,
) -> dict:
    if board_width < TILE_SIZE or board_height < TILE_SIZE:
        raise ValueError("Board must be at least 60 by 60 pixels.")
    selected_shape_id = (
        random.randrange(len(LEVEL_SHAPES))
        if shape_id is None
        else shape_id % len(LEVEL_SHAPES)
    )
    coordinates = build_level_coordinates(tile_count, selected_shape_id)
    exit_coordinate = find_exit_coordinate(coordinates)
    if exit_coordinate is None:
        raise ValueError("The selected route prefix has no safe exit position.")
    centered = center_level(
        coordinates,
        exit_coordinate,
        board_width,
        board_height,
    )
    centered["board"] = {"width": board_width, "height": board_height}
    validation = validate_level(coordinates, exit_coordinate, centered)

    return {
        "shape_id": selected_shape_id,
        "tile_count": len(coordinates),
        "tile_size": TILE_SIZE,
        "tile_gap": TILE_GAP,
        "grid_step": GRID_STEP,
        "coordinates": [
            {"index": index + 1, "column": point[0], "row": point[1]}
            for index, point in enumerate(coordinates)
        ],
        "exit": {"column": exit_coordinate[0], "row": exit_coordinate[1]},
        "layout": centered,
        "validation": validation,
    }
