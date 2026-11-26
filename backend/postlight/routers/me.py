from typing import Annotated

from fastapi import APIRouter, Depends
from fastapi.security import HTTPAuthorizationCredentials

from postlight.admin import bearer_scheme, member_info, optional_user
from postlight.routers.projects import image_url

router = APIRouter()


@router.get("/me")
def me(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]):
    """Tells the website who is signed in: role, display name and photo.
    It only decides which buttons to show; the real permission is still checked on every change."""
    user = optional_user(credentials)
    if user is None:
        return {"is_admin": False, "role": None, "display_name": None, "avatar_url": None}
    member = member_info(*user)
    return {
        "is_admin": member["role"] == "administrator",
        "role": member["role"],
        "display_name": member["name"],
        "avatar_url": image_url(member["avatar_path"]),
    }
