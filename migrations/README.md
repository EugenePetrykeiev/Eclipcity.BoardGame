# Database migrations

Run all pending migrations with:

```bash
alembic upgrade head
```

Create a migration after changing SQLAlchemy models with:

```bash
alembic revision --autogenerate -m "describe the schema change"
```

Never run `stamp` against an existing database until its schema has been backed
up and verified to match the stamped revision.
