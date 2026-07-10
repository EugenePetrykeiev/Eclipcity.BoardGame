import random
import string


LOBBY_CODE_ALPHABET = string.ascii_uppercase + string.digits


def normalize_lobby_code(code: str) -> str:
    return code.strip().upper()


def lobby_path(code: str) -> str:
    return f"/lobby/{normalize_lobby_code(code)}"


def create_lobby_code() -> str:
    return "".join(random.choice(LOBBY_CODE_ALPHABET) for _ in range(5))
