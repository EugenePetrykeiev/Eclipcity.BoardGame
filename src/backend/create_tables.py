import asyncio

from .database import create_tables


async def main() -> None:
    await create_tables()


if __name__ == "__main__":
    asyncio.run(main())
