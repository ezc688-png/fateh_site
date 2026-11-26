"""Reviews. Anyone can read approved ones; signed-in users can submit; the admin approves."""
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from postlight.admin import current_member
from postlight.database import connection
from postlight.routers.projects import image_url
from postlight.services.discord import notify

router = APIRouter()

MAX_WAITING_PER_USER = 2


class TestimonialBody(BaseModel):
    body: str = Field(min_length=10, max_length=600)
    rating: int = Field(ge=1, le=5)


def serialize_testimonial(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "author_name": row["shown_name"],
        "author_avatar": image_url(row.get("avatar_path")),
        "body": row["body"],
        "rating": row["rating"],
        "approved": row["approved"],
        "created_at": row["created_at"].isoformat(),
    }


SELECT = (
    "select t.*, coalesce(pr.display_name, t.author_name) as shown_name, pr.avatar_path "
    "from public.testimonials t left join public.profiles pr on pr.user_id = t.author_id "
)


@router.get("/testimonials")
def approved_testimonials():
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(SELECT + "where t.approved order by t.created_at desc limit 30")
        return [serialize_testimonial(row) for row in cur.fetchall()]


@router.post("/testimonials", status_code=201)
def submit_testimonial(body: TestimonialBody, member: Annotated[dict, Depends(current_member)]):
    text = body.body.strip()
    if len(text) < 10:
        raise HTTPException(422, "Please write at least 10 characters")
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(
            "select count(*) as n from public.testimonials where author_id = %s and not approved",
            (member["id"],),
        )
        if cur.fetchone()["n"] >= MAX_WAITING_PER_USER:
            raise HTTPException(429, "You already have reviews waiting for approval. Please wait for them to be reviewed.")
        cur.execute(
            "insert into public.testimonials (author_id, author_name, body, rating) values (%s, %s, %s, %s)",
            (member["id"], member["name"], text, body.rating),
        )
    notify(
        f"⭐ New review waiting for approval ({body.rating}/5)",
        text,
        [("From", f"{member['name']} ({member['email']})")],
        color=0xF5A623,
    )
    return {"ok": True}
