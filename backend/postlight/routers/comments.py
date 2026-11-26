from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Form, HTTPException
from psycopg.rows import dict_row

from postlight.admin import current_member
from postlight.database import connection
from postlight.dependencies import current_user
from postlight.routers.projects import image_url
from postlight.services.discord import notify

router = APIRouter()

# One query used everywhere: the comment plus the author's CURRENT display name and photo.
COMMENT_SQL = (
    "select c.*, coalesce(pr.display_name, c.author_name) as shown_name, pr.avatar_path "
    "from public.comments c left join public.profiles pr on pr.user_id = c.author_id "
)


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
        "author_name": row["shown_name"],
        "author_avatar": image_url(row.get("avatar_path")),
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
        cur.execute(COMMENT_SQL + "where c.project_id = %s order by c.created_at desc", (project_id,))
        return [serialize_comment(row) for row in cur.fetchall()]


@router.post("/projects/{project_id}/comments", status_code=201)
def create_comment(
    project_id: UUID,
    body: Annotated[str, Form()],
    member: Annotated[dict, Depends(current_member)],  # signed in AND not banned
):
    body = clean_body(body)
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select name from public.projects where id = %s", (project_id,))
        project = cur.fetchone()
        if project is None:
            raise HTTPException(404, "Project not found")
        cur.execute(
            "insert into public.comments (project_id, author_id, author_name, body) "
            "values (%s, %s, %s, %s) returning id",
            (project_id, member["id"], member["name"], body),
        )
        new_id = cur.fetchone()["id"]
        cur.execute(COMMENT_SQL + "where c.id = %s", (new_id,))
        row = cur.fetchone()

    # Discord: title says where, the text is exactly what they typed. Runs in the background.
    notify(
        f"💬 New comment on {project['name']}",
        body,
        [("From", f"{member['name']} ({member['email']})")],
        color=0x2B7FFF,
    )
    return serialize_comment(row)


@router.put("/comments/{comment_id}")
def update_comment(
    comment_id: UUID,
    body: Annotated[str, Form()],
    member: Annotated[dict, Depends(current_member)],
):
    body = clean_body(body)
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select * from public.comments where id = %s for update", (comment_id,))
        old = cur.fetchone()
        if old is None:
            raise HTTPException(404, "Comment not found")
        if old["author_id"] != member["id"]:
            raise HTTPException(403, "You can only edit your own comments")
        cur.execute(
            "update public.comments set body = %s, updated_at = now() where id = %s",
            (body, comment_id),
        )
        cur.execute(COMMENT_SQL + "where c.id = %s", (comment_id,))
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
