"""A signed-in user's own profile: display name and profile photo."""
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from fastapi.security import HTTPAuthorizationCredentials
from psycopg.rows import dict_row

from postlight.admin import auth_user, bearer_scheme, member_info
from postlight.database import connection
from postlight.routers.projects import image_url
from postlight.services.storage import remove_image_best_effort, store_image

router = APIRouter()


def serialize_profile(member: dict) -> dict:
    return {
        "email": member["email"],
        "display_name": member["name"],
        "avatar_url": image_url(member["avatar_path"]),
        "role": member["role"],
    }


@router.get("/profile")
def get_profile(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]):
    user_id, email = auth_user(credentials)
    return serialize_profile(member_info(user_id, email))


@router.put("/profile")
async def update_profile(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
    display_name: Annotated[str, Form()],
    remove_avatar: Annotated[bool, Form()] = False,
    avatar: UploadFile | None = File(default=None),
):
    user_id, email = auth_user(credentials)
    display_name = display_name.strip()
    if not 2 <= len(display_name) <= 40:
        raise HTTPException(422, "Display name must be between 2 and 40 characters")

    new_path = await store_image(avatar, user_id)  # checks type and size; None when no file was sent
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select avatar_path from public.profiles where user_id = %s for update", (user_id,))
        old = cur.fetchone()
        old_path = old["avatar_path"] if old else None
        path = new_path if new_path else (None if remove_avatar else old_path)
        cur.execute(
            "insert into public.profiles (user_id, display_name, avatar_path) values (%s, %s, %s) "
            "on conflict (user_id) do update set display_name = excluded.display_name, "
            "avatar_path = excluded.avatar_path, updated_at = now()",
            (user_id, display_name, path),
        )
    if old_path and old_path != path:
        remove_image_best_effort(old_path)
    return serialize_profile(member_info(user_id, email))
