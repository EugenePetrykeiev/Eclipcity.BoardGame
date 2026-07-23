import asyncio
import json

from alembic.autogenerate import compare_metadata
from alembic.migration import MigrationContext
from sqlalchemy import inspect, text

from src.backend import models  # noqa: F401
from src.backend.database import Base, engine

EXPECTED_REVISION = "20260717_0001"


def inspect_schema(sync_connection):
    context = MigrationContext.configure(
        sync_connection,
        opts={"compare_type": True, "compare_server_default": False},
    )
    differences = compare_metadata(context, Base.metadata)
    inspector = inspect(sync_connection)
    expected_tables = sorted(Base.metadata.tables)
    actual_tables = sorted(inspector.get_table_names(schema="public"))
    quoted = sync_connection.dialect.identifier_preparer.quote

    row_counts = {
        table_name: sync_connection.exec_driver_sql(
            f"SELECT count(*) FROM {quoted(table_name)}"
        ).scalar_one()
        for table_name in expected_tables
        if table_name in actual_tables
    }

    version_table = sync_connection.execute(
        text("SELECT to_regclass('public.alembic_version')::text")
    ).scalar_one_or_none()
    versions = []
    if version_table is not None:
        versions = list(
            sync_connection.exec_driver_sql(
                "SELECT version_num FROM alembic_version ORDER BY version_num"
            ).scalars()
        )

    tls = sync_connection.execute(
        text(
            "SELECT ssl, version, cipher "
            "FROM pg_stat_ssl WHERE pid = pg_backend_pid()"
        )
    ).mappings().one()

    return {
        "actual_tables": actual_tables,
        "expected_tables": expected_tables,
        "alembic_versions": versions,
        "row_counts": row_counts,
        "tls": dict(tls),
        "schema_differences": [repr(difference) for difference in differences],
    }


async def main() -> None:
    async with engine.connect() as connection:
        await connection.execute(text("SET TRANSACTION READ ONLY"))
        report = await connection.run_sync(inspect_schema)

    await engine.dispose()
    print(json.dumps(report, indent=2, sort_keys=True, default=str))

    if report["schema_differences"]:
        raise SystemExit("Refusing baseline: database schema differs from application metadata.")
    if report["alembic_versions"] not in ([], [EXPECTED_REVISION]):
        raise SystemExit("Refusing baseline: Alembic contains an unexpected revision.")

    if report["alembic_versions"] == [EXPECTED_REVISION]:
        print("BASELINE_CURRENT: schema matches metadata and Alembic is at the expected revision.")
    else:
        print("BASELINE_SAFE: existing schema matches metadata and can be stamped.")


if __name__ == "__main__":
    asyncio.run(main())
