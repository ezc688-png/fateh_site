from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from postlight.clients import storage_client
from postlight.config import settings

bearer_scheme = HTTPBearer(auto_error=False)


def admin_emails() -> set[str]:
    return {email.strip().lower() for email in settings.admin_emails.split(",") if email.strip()}


def require_admin(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)] = None,
) -> UUID:
    if credentials is None:
        raise HTTPException(401, "Sign in to continue")
    try:
        user = storage_client.auth.get_user(credentials.credentials).user
        if user is None:
            raise ValueError("Missing user")
    except Exception as exc:
        raise HTTPException(401, "Session expired. Please sign in again") from exc
    if (user.email or "").lower() not in admin_emails():
        raise HTTPException(403, "Only the site owner can change projects")
    return UUID(str(user.id))