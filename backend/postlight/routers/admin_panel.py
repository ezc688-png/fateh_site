"""Admin-only endpoints for the /admin page: dashboard numbers, all comments, all users.
Every route depends on require_admin, so a normal visitor gets 403 even if they call the URL directly.
Projects and gallery pictures are managed with the routes that already exist (projects.py, project_images.py)."""
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row

from postlight.admin import admin_emails, require_admin
from postlight.database import connection

router = APIRouter(prefix="/admin", tags=["admin"])


def iso(value):
    return value.isoformat() if value else None


# Dashboard tiles: a handful of count(*) queries in one round trip.
@router.get("/stats")
def stats(admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            """
            select
              (select count(*) from public.projects) as projects,
              (select count(*) from public.projects where status = 'new') as new_projects,
              (select count(*) from public.projects where status = 'completed') as completed_projects,
              (select count(*) from public.comments) as comments,
              (select count(*) from auth.users) as users
            """
        )
        return cur.fetchone()


# Every comment on the site, newest first, with the project it belongs to.
@router.get("/comments")
def all_comments(admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select c.*, p.name as project_name "
            "from public.comments c left join public.projects p on p.id = c.project_id "
            "order by c.created_at desc limit 300"
        )
        rows = cur.fetchall()

        # Look up the author's email so the admin can tell who wrote what.
        author_ids = list({row["author_id"] for row in rows if row.get("author_id")})
        emails = {}
        if author_ids:
            cur.execute("select id, email from auth.users where id = any(%s)", (author_ids,))
            emails = {row["id"]: row["email"] for row in cur.fetchall()}

    return [
        {
            "id": str(row["id"]),
            "project_id": str(row["project_id"]),
            "project_name": row.get("project_name") or "(deleted project)",
            "author": row.get("author_name") or emails.get(row.get("author_id")) or "Unknown",
            "author_email": emails.get(row.get("author_id")),
            "body": row["body"],
            "created_at": iso(row["created_at"]),
        }
        for row in rows
    ]


# The admin may remove any comment (normal users can only remove their own).
@router.delete("/comments/{comment_id}", status_code=204)
def delete_any_comment(comment_id: UUID, admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor() as cur:
        cur.execute("delete from public.comments where id = %s", (comment_id,))
        if cur.rowcount == 0:
            raise HTTPException(404, "Comment not found")


# Read-only list of registered users. A user is an admin if their email is in ADMIN_EMAILS.
@router.get("/users")
def all_users(admin_id: Annotated[UUID, Depends(require_admin)]):
    admins = {email.strip().lower() for email in admin_emails()}
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select id, email, created_at, last_sign_in_at from auth.users order by created_at desc"
        )
        rows = cur.fetchall()
    return [
        {
            "id": str(row["id"]),
            "email": row["email"],
            "role": "admin" if (row["email"] or "").lower() in admins else "visitor",
            "created_at": iso(row["created_at"]),
            "last_sign_in_at": iso(row["last_sign_in_at"]),
        }
        for row in rows
    ]
