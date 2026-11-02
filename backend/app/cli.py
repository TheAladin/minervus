import argparse
import getpass
import sys
from collections.abc import Sequence

from pydantic import TypeAdapter, ValidationError
from sqlalchemy import select

from app.db import SessionLocal
from app.models import Role, User
from app.schemas import Email, NewPassword
from app.security import hash_password


def validated(schema: object, value: str, label: str) -> str:
    try:
        return TypeAdapter(schema).validate_python(value)
    except ValidationError as error:
        sys.exit(f"Invalid {label}: {error.errors()[0]['msg']}")


def read_password(from_stdin: bool) -> str:
    if from_stdin:
        # Only the line ending goes, because a password can start or end with spaces.
        return sys.stdin.readline().rstrip("\r\n")
    password = getpass.getpass("Password: ")
    if password != getpass.getpass("Confirm password: "):
        sys.exit("Passwords don't match")
    return password


def create_admin(email: str, password_stdin: bool) -> None:
    email = validated(Email, email, "email")
    with SessionLocal() as db:
        if db.scalar(select(User).where(User.email == email)) is not None:
            sys.exit(
                f"{email} already has an account. "
                "If it's yours, make it an admin with promote-admin."
            )
        password = validated(NewPassword, read_password(password_stdin), "password")
        db.add(
            User(email=email, password_hash=hash_password(password), role=Role.ADMIN)
        )
        db.commit()
    print(f"Created admin {email}")


def promote_admin(email: str) -> None:
    email = validated(Email, email, "email")
    with SessionLocal() as db:
        user = db.scalar(select(User).where(User.email == email))
        if user is None:
            sys.exit(f"No account found for {email}")
        user.role = Role.ADMIN
        user.is_active = True
        db.commit()
    print(f"{email} is now an active admin. Its password wasn't changed.")


def main(argv: Sequence[str] | None = None) -> None:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    commands = parser.add_subparsers(required=True)

    create = commands.add_parser("create-admin", help="create a new admin account")
    create.add_argument("--email", required=True)
    create.add_argument(
        "--password-stdin",
        action="store_true",
        help="read the password from the first line of stdin instead of prompting",
    )
    create.set_defaults(run=create_admin)

    promote = commands.add_parser(
        "promote-admin", help="make an existing user an active admin"
    )
    promote.add_argument("--email", required=True)
    promote.set_defaults(run=promote_admin)

    args = vars(parser.parse_args(argv))
    run = args.pop("run")
    run(**args)


if __name__ == "__main__":
    main()
