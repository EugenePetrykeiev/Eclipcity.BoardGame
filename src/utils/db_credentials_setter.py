
import getpass
import json
import re

dbname = input("Database name, example appdb: ").strip()
username = input("Database username, example appuser: ").strip()
password = getpass.getpass("Database password: ")

name_pattern = r"^[A-Za-z0-9_]+$"

if not re.match(name_pattern, dbname):
    raise SystemExit("Database name must contain only letters, numbers, and underscores.")

if not re.match(name_pattern, username):
    raise SystemExit("Database username must contain only letters, numbers, and underscores.")

if not password:
    raise SystemExit("Password cannot be empty.")

with open("db-secret.json", "w") as f:
    json.dump(
        {
            "dbname": dbname,
            "username": username,
            "password": password,
        },
        f,
    )