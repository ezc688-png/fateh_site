from fastapi import APIRouter, Depends

from postlight.admin import admin_emails, bearer_scheme
from postlight.clients import storage_client

router = APIRouter()


@router.get("/me")
def me(credentials=Depends(bearer_scheme)):
    """Tells the website whether the signed-in user is the site owner.
    It only decides which buttons to show; the real permission is still checked on every change."""
    if credentials is None:
        return {"is_admin": False}
    try:
        user = storage_client.auth.get_user(credentials.credentials).user
    except Exception:
        return {"is_admin": False}
    email = (user.email or "").lower() if user else ""
    return {"is_admin": email in admin_emails()}
