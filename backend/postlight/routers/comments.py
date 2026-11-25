from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Form, Header, HTTPException
from psycopg.rows import dict_row

from postlight.clients import storage_client
from postlight.database import connection
from postlight.dependencies import current_user

router = APIRouter()


def current_author(
    authorization: Annotated[str | None, Header()] = None,
) -> tuple[UUID, str]:
    """Like current_user, but also returns a display name (the part of the email before @)."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, "Sign in to continue")
    try:
        user = storage_client.auth.get_user(authorization[7:]).user
        if user is None:
            raise ValueError("Missing user")
        name = (user.email or "visitor").split("@")[0]
        return UUID(str(user.id)), name
    except Exception as exc:
        raise HTTPException(401, "Session expired. Please sign in again") from exc


def clean_body(body: str) -> str:
    body = body.strip()
    if not 1 <= len(body) <= 1000:
        raise HTTPException(422, "Comment must be between 1 and 1000 characters")
    return body


def serialize_comment(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "author_id": str(row["author_id"]),
        "author_name": row["author_name"],
        "body": row["body"],
        "created_at": row["created_at"].isoformat(),
        "updated_at": row["updated_at"].isoformat(),
    }


@router.get("/projects/{project_id}/comments")
def list_comments(project_id: UUID):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select 1 from public.projects where id = %s", (project_id,))
        if cur.fetchone() is None:
            raise HTTPException(404, "Project not found")
        cur.execute(
            "select * from public.comments where project_id = %s order by created_at desc",
            (project_id,),
        )
        return [serialize_comment(row) for row in cur.fetchall()]


@router.post("/projects/{project_id}/comments", status_code=201)
def create_comment(
    project_id: UUID,
    body: Annotated[str, Form()],
    author: Annotated[tuple[UUID, str], Depends(current_author)],
):
    user_id, author_name = author
    body = clean_body(body)
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select 1 from public.projects where id = %s", (project_id,))
        if cur.fetchone() is None:
            raise HTTPException(404, "Project not found")
        cur.execute(
            "insert into public.comments (project_id, author_id, author_name, body) "
            "values (%s, %s, %s, %s) returning *",
            (project_id, user_id, author_name, body),
        )
        return serialize_comment(cur.fetchone())


@router.put("/comments/{comment_id}")
def update_comment(
    comment_id: UUID,
    body: Annotated[str, Form()],
    user_id: Annotated[UUID, Depends(current_user)],
):
    body = clean_body(body)
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select * from public.comments where id = %s for update", (comment_id,))
        old = cur.fetchone()
        if old is None:
            raise HTTPException(404, "Comment not found")
        if old["author_id"] != user_id:
            raise HTTPException(403, "You can only edit your own comments")
        cur.execute(
            "update public.comments set body = %s, updated_at = now() where id = %s returning *",
            (body, comment_id),
        )
        return serialize_comment(cur.fetchone())


@router.delete("/comments/{comment_id}", status_code=204)
def delete_comment(
    comment_id: UUID,
    user_id: Annotated[UUID, Depends(current_user)],
):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select author_id from public.comments where id = %s for update", (comment_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Comment not found")
        if row["author_id"] != user_id:
            raise HTTPException(403, "You can only delete your own comments")
        cur.execute("delete from public.comments where id = %s", (comment_id,))