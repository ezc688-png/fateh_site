"""Saved projects. Each signed-in user has their own list."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials
from psycopg.rows import dict_row

from postlight.admin import auth_user, bearer_scheme, current_member
from postlight.database import connection
from postlight.routers.projects import COVER_SQL, serialize_project

router = APIRouter()


@router.get("/favorites")
def my_favorites(credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)]):
    user_id, _ = auth_user(credentials)
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            f"select p.*, {COVER_SQL} from public.favorites f "
            "join public.projects p on p.id = f.project_id "
            "where f.user_id = %s order by f.created_at desc",
            (user_id,),
        )
        return [serialize_project(row) for row in cur.fetchall()]


@router.put("/projects/{project_id}/favorite", status_code=204)
def add_favorite(project_id: UUID, member: Annotated[dict, Depends(current_member)]):
    with connection() as conn, conn.cursor() as cur:
        cur.execute("select 1 from public.projects where id = %s", (project_id,))
        if cur.fetchone() is None:
            raise HTTPException(404, "Project not found")
        cur.execute(
            "insert into public.favorites (user_id, project_id) values (%s, %s) on conflict do nothing",
            (member["id"], project_id),
        )


@router.delete("/projects/{project_id}/favorite", status_code=204)
def remove_favorite(
    project_id: UUID,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
):
    user_id, _ = auth_user(credentials)
    with connection() as conn, conn.cursor() as cur:
        cur.execute("delete from public.favorites where user_id = %s and project_id = %s", (user_id, project_id))
