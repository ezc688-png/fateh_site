"""Admin-only endpoints for the /admin page: dashboard numbers, comments, users and roles, enquiries,
favourites, reviews and the activity log.
Every route depends on require_admin, so a normal visitor gets 403 even if they call the URL directly.
Projects and gallery pictures are managed with the routes that already exist (projects.py, project_images.py)."""
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row
from pydantic import BaseModel

from postlight.admin import admin_emails, require_admin
from postlight.database import connection
from postlight.services.audit import log_activity

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
              (select count(*) from auth.users) as users,
              (select count(*) from public.enquiries where status = 'new') as new_enquiries,
              (select count(*) from public.testimonials where not approved) as pending_reviews
            """
        )
        return cur.fetchone()


# ---------------------------------------------------------------- comments
@router.get("/comments")
def all_comments(admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select c.*, p.name as project_name "
            "from public.comments c left join public.projects p on p.id = c.project_id "
            "order by c.created_at desc limit 300"
        )
        rows = cur.fetchall()
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


@router.delete("/comments/{comment_id}", status_code=204)
def delete_any_comment(comment_id: UUID, admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select body from public.comments where id = %s", (comment_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Comment not found")
        cur.execute("delete from public.comments where id = %s", (comment_id,))
    log_activity(admin_id, "Deleted a comment", detail=row["body"][:120])


# ---------------------------------------------------------------- users and roles
@router.get("/users")
def all_users(admin_id: Annotated[UUID, Depends(require_admin)]):
    locked = admin_emails()
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select u.id, u.email, u.created_at, u.last_sign_in_at, p.role, p.display_name "
            "from auth.users u left join public.profiles p on p.user_id = u.id "
            "order by u.created_at desc"
        )
        rows = cur.fetchall()
    result = []
    for row in rows:
        email = (row["email"] or "").lower()
        is_locked = email in locked
        result.append(
            {
                "id": str(row["id"]),
                "email": row["email"],
                "display_name": row["display_name"],
                "role": "administrator" if is_locked else (row["role"] or "user"),
                # locked = listed in ADMIN_EMAILS on the server, so it cannot be changed from the website
                "locked": is_locked,
                "created_at": iso(row["created_at"]),
                "last_sign_in_at": iso(row["last_sign_in_at"]),
            }
        )
    return result


class RoleBody(BaseModel):
    role: Literal["administrator", "user", "banned"]


@router.put("/users/{user_id}/role")
def set_role(user_id: UUID, body: RoleBody, admin_id: Annotated[UUID, Depends(require_admin)]):
    if user_id == admin_id:
        raise HTTPException(422, "You cannot change your own role")
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select email from auth.users where id = %s", (user_id,))
        found = cur.fetchone()
        if found is None:
            raise HTTPException(404, "User not found")
        if (found["email"] or "").lower() in admin_emails():
            raise HTTPException(422, "This account is protected in the server settings and cannot be changed here")
        cur.execute(
            "insert into public.profiles (user_id, role) values (%s, %s) "
            "on conflict (user_id) do update set role = excluded.role, updated_at = now()",
            (user_id, body.role),
        )
    log_activity(admin_id, "Changed role", found["email"] or str(user_id), f"set to {body.role}")
    return {"id": str(user_id), "role": body.role}


# ---------------------------------------------------------------- enquiries
@router.get("/enquiries")
def all_enquiries(admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select * from public.enquiries order by created_at desc limit 300")
        rows = cur.fetchall()
    return [
        {
            "id": str(row["id"]),
            "project_id": str(row["project_id"]) if row["project_id"] else None,
            "project_name": row["project_name"],
            "name": row["name"],
            "phone": row["phone"],
            "email": row["email"],
            "preferred_date": row["preferred_date"],
            "message": row["message"],
            "status": row["status"],
            "signed_in": row["user_id"] is not None,
            "created_at": iso(row["created_at"]),
        }
        for row in rows
    ]


class EnquiryStatus(BaseModel):
    status: Literal["new", "contacted", "closed"]


@router.put("/enquiries/{enquiry_id}")
def set_enquiry_status(enquiry_id: UUID, body: EnquiryStatus, admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "update public.enquiries set status = %s where id = %s returning name, project_name",
            (body.status, enquiry_id),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Enquiry not found")
    log_activity(admin_id, "Updated enquiry", f"{row['name']} - {row['project_name']}", f"status: {body.status}")
    return {"id": str(enquiry_id), "status": body.status}


@router.delete("/enquiries/{enquiry_id}", status_code=204)
def delete_enquiry(enquiry_id: UUID, admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("delete from public.enquiries where id = %s returning name, project_name", (enquiry_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Enquiry not found")
    log_activity(admin_id, "Deleted enquiry", f"{row['name']} - {row['project_name']}")


# ---------------------------------------------------------------- favourites
@router.get("/favorites")
def favorites_overview(admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select p.id, p.name, count(f.user_id) as saves "
            "from public.projects p join public.favorites f on f.project_id = p.id "
            "group by p.id, p.name order by saves desc, p.name"
        )
        by_project = [{"project_id": str(r["id"]), "name": r["name"], "saves": r["saves"]} for r in cur.fetchall()]
        cur.execute(
            "select f.created_at, p.name as project_name, u.email, pr.display_name "
            "from public.favorites f join public.projects p on p.id = f.project_id "
            "join auth.users u on u.id = f.user_id left join public.profiles pr on pr.user_id = f.user_id "
            "order by f.created_at desc limit 300"
        )
        recent = [
            {
                "project_name": r["project_name"],
                "email": r["email"],
                "display_name": r["display_name"],
                "created_at": iso(r["created_at"]),
            }
            for r in cur.fetchall()
        ]
    return {"by_project": by_project, "recent": recent}


# ---------------------------------------------------------------- reviews
@router.get("/testimonials")
def all_testimonials(admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select t.*, u.email from public.testimonials t left join auth.users u on u.id = t.author_id "
            "order by t.approved, t.created_at desc limit 300"
        )
        rows = cur.fetchall()
    return [
        {
            "id": str(r["id"]),
            "author_name": r["author_name"],
            "author_email": r["email"],
            "body": r["body"],
            "rating": r["rating"],
            "approved": r["approved"],
            "created_at": iso(r["created_at"]),
        }
        for r in rows
    ]


class Approval(BaseModel):
    approved: bool


@router.put("/testimonials/{testimonial_id}")
def set_testimonial_approval(testimonial_id: UUID, body: Approval, admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "update public.testimonials set approved = %s where id = %s returning author_name",
            (body.approved, testimonial_id),
        )
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Review not found")
    log_activity(admin_id, "Approved review" if body.approved else "Hid review", row["author_name"])
    return {"id": str(testimonial_id), "approved": body.approved}


@router.delete("/testimonials/{testimonial_id}", status_code=204)
def delete_testimonial(testimonial_id: UUID, admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("delete from public.testimonials where id = %s returning author_name", (testimonial_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Review not found")
    log_activity(admin_id, "Deleted review", row["author_name"])


# ---------------------------------------------------------------- activity log
@router.get("/activity")
def activity(admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select * from public.activity_log order by created_at desc, id desc limit 300")
        rows = cur.fetchall()
    return [
        {
            "id": r["id"],
            "actor": r["actor_name"],
            "action": r["action"],
            "target": r["target"],
            "detail": r["detail"],
            "created_at": iso(r["created_at"]),
        }
        for r in rows
    ]
