"""Admin CLI to manage SOPRA PM login accounts.

Accounts are admin-seeded: there is no self-service signup page. Every login
is just a dbo.TeamMembers row that has an Email and a PasswordHash set. Use
this script to list team members and turn one into a login account.

Usage:
    python manage_users.py list
    python manage_users.py set-password <team_member_id_or_email> <email> <password>
    python manage_users.py disable <team_member_id_or_email>

Examples:
    python manage_users.py list
    python manage_users.py set-password 1 nathan@sopra.com "Str0ng!Pass"
    python manage_users.py set-password nathan@sopra.com nathan@sopra.com "NewPass123!"
    python manage_users.py disable 1
"""
from __future__ import annotations

import getpass
import os
import sys
from pathlib import Path

import bcrypt
import pymssql
from dotenv import load_dotenv

load_dotenv(Path(__file__).parent / ".env")


def conn():
    return pymssql.connect(
        server=os.environ["MSSQL_HOST"],
        port=int(os.environ["MSSQL_PORT"]),
        user=os.environ["MSSQL_USER"],
        password=os.environ["MSSQL_PASSWORD"],
        database=os.environ["MSSQL_DB"],
        as_dict=True,
        autocommit=True,
        charset="UTF-8",
        login_timeout=15,
    )


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def find_member(cur, identifier: str):
    if identifier.isdigit():
        cur.execute("SELECT * FROM dbo.TeamMembers WHERE Id=%s", (int(identifier),))
    else:
        cur.execute("SELECT * FROM dbo.TeamMembers WHERE LOWER(Email)=LOWER(%s)", (identifier,))
    return cur.fetchone()


def cmd_list(cur):
    cur.execute("SELECT Id, Name, Role, Email, PasswordHash FROM dbo.TeamMembers ORDER BY Id")
    rows = cur.fetchall()
    print(f"{'ID':<4} {'NAME':<16} {'ROLE':<16} {'EMAIL':<28} LOGIN ENABLED")
    for r in rows:
        enabled = "yes" if r.get("PasswordHash") else "no"
        print(f"{r['Id']:<4} {r['Name']:<16} {r['Role']:<16} {(r.get('Email') or '—'):<28} {enabled}")


def cmd_set_password(cur, identifier: str, email: str, password: str | None):
    member = find_member(cur, identifier)
    if not member:
        print(f"No team member matching '{identifier}'", file=sys.stderr)
        sys.exit(1)
    if not password:
        password = getpass.getpass("New password: ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Passwords do not match", file=sys.stderr)
            sys.exit(1)
    if len(password) < 8:
        print("Password must be at least 8 characters", file=sys.stderr)
        sys.exit(1)
    pwd_hash = hash_password(password)
    cur.execute(
        "UPDATE dbo.TeamMembers SET Email=%s, PasswordHash=%s WHERE Id=%s",
        (email, pwd_hash, member["Id"]),
    )
    print(f"Login enabled for {member['Name']} ({email}).")


def cmd_disable(cur, identifier: str):
    member = find_member(cur, identifier)
    if not member:
        print(f"No team member matching '{identifier}'", file=sys.stderr)
        sys.exit(1)
    cur.execute("UPDATE dbo.TeamMembers SET PasswordHash=NULL WHERE Id=%s", (member["Id"],))
    print(f"Login disabled for {member['Name']}.")


def main():
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)

    action = sys.argv[1]
    c = conn()
    cur = c.cursor()

    if action == "list":
        cmd_list(cur)
    elif action == "set-password":
        if len(sys.argv) < 4:
            print("Usage: python manage_users.py set-password <id_or_email> <email> [password]")
            sys.exit(1)
        identifier, email = sys.argv[2], sys.argv[3]
        password = sys.argv[4] if len(sys.argv) > 4 else None
        cmd_set_password(cur, identifier, email, password)
    elif action == "disable":
        if len(sys.argv) < 3:
            print("Usage: python manage_users.py disable <id_or_email>")
            sys.exit(1)
        cmd_disable(cur, sys.argv[2])
    else:
        print(__doc__)
        sys.exit(1)

    cur.close()
    c.close()


if __name__ == "__main__":
    main()
