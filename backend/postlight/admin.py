"""Who is signed in, and what role they have.

Roles: administrator, user, banned.
- Anyone whose email is in ADMIN_EMAILS is ALWAYS an administrator (a safety net, so you can never lock yourself out).
- Everyone else gets the role saved in public.profiles (default "user").
"""
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from psycopg.rows import dict_row

from postlight.clients import storage_client
from postlight.config import settings
from postlight.database import connection

bearer_scheme = HTTPBearer(auto_error=False)

ROLES = ("administrator", "user", "banned")
BANNED_MESSAGE = "Your account has been restricted. Please contact us if you think this is a mistake."


def admin_emails() -> set[str]:
    return {email.strip().lower() for email in settings.admin_emails.split(",") if email.strip()}


def auth_user(credentials: HTTPAuthorizationCredentials | None) -> tuple[UUID, str]:
    """Checks the login token with Supabase. Returns (user id, email) or raises 401."""
    if credentials is None:
        raise HTTPException(401, "Sign in to continue")
    try:
        user = storage_client.auth.get_user(credentials.credentials).user
        if user is None:
            raise ValueError("Missing user")
        return UUID(str(user.id)), (user.email or "")
    except Exception as exc:
        raise HTTPException(401, "Session expired. Please sign in again") from exc


def optional_user(credentials: HTTPAuthorizationCredentials | None) -> tuple[UUID, str] | None:
    if credentials is None:
        return None
    try:
        return auth_user(credentials)
    except HTTPException:
        return None


def load_profile(user_id: UUID) -> dict | None:
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select display_name, avatar_path, role from public.profiles where user_id = %s",
            (user_id,),
        )
        return cur.fetchone()


def resolve_role(email: str, profile: dict | None) -> str:
    if email.lower() in admin_emails():
        return "administrator"
    stored = profile["role"] if profile else "user"
    return stored if stored in ROLES else "user"


def display_name_for(email: str, profile: dict | None) -> str:
    if profile and profile.get("display_name"):
        return profile["display_name"]
    return (email or "visitor").split("@")[0]


def member_info(user_id: UUID, email: str) -> dict:
    profile = load_profile(user_id)
    return {
        "id": user_id,
        "email": email,
        "name": display_name_for(email, profile),
        "role": resolve_role(email, profile),
        "avatar_path": profile["avatar_path"] if profile else None,
    }


def current_member(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> dict:
    """A signed-in user who is NOT banned. Use this for anything a visitor can create."""
    user_id, email = auth_user(credentials)
    member = member_info(user_id, email)
    if member["role"] == "banned":
        raise HTTPException(403, BANNED_MESSAGE)
    return member


def require_admin(credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme)) -> UUID:
    user_id, email = auth_user(credentials)
    if member_info(user_id, email)["role"] != "administrator":
        raise HTTPException(403, "You do not have admin access")
    return user_id
