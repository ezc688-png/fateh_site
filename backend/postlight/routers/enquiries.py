"""Public "Request a viewing" form. Saves the lead and pings Discord."""
import re
import time
from collections import defaultdict, deque
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials
from psycopg.rows import dict_row
from pydantic import BaseModel, Field

from postlight.admin import BANNED_MESSAGE, bearer_scheme, member_info, optional_user
from postlight.database import connection
from postlight.services.discord import notify

router = APIRouter()

LIMIT = 5          # enquiries ...
WINDOW = 3600      # ... per hour per IP
_hits: dict[str, deque] = defaultdict(deque)
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class EnquiryBody(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    phone: str = Field(min_length=6, max_length=30)
    email: str = Field(default="", max_length=120)
    preferred_date: str = Field(default="", max_length=40)
    message: str = Field(default="", max_length=1000)
    website: str = Field(default="", max_length=200)  # hidden "honeypot" field: real people leave it empty


@router.post("/projects/{project_id}/enquiries", status_code=201)
def create_enquiry(
    project_id: UUID,
    body: EnquiryBody,
    request: Request,
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer_scheme)],
):
    if body.website:  # a bot filled the hidden field: pretend it worked
        return {"ok": True}

    ip = (request.headers.get("x-forwarded-for") or (request.client.host if request.client else "x")).split(",")[0].strip()
    now = time.time()
    hits = _hits[ip]
    while hits and now - hits[0] > WINDOW:
        hits.popleft()
    if len(hits) >= LIMIT:
        raise HTTPException(429, "Too many requests from this device. Please WhatsApp us instead.")

    user = optional_user(credentials)
    user_id = None
    if user:
        member = member_info(*user)
        if member["role"] == "banned":
            raise HTTPException(403, BANNED_MESSAGE)
        user_id = member["id"]

    name, phone = body.name.strip(), body.phone.strip()
    email, message = body.email.strip(), body.message.strip()
    date = body.preferred_date.strip()
    if not name or not re.fullmatch(r"[0-9+()\-\s]{6,30}", phone):
        raise HTTPException(422, "Please enter your name and a valid phone number")
    if email and not EMAIL_RE.match(email):
        raise HTTPException(422, "Please enter a valid email address or leave it empty")

    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select name from public.projects where id = %s", (project_id,))
        project = cur.fetchone()
        if project is None:
            raise HTTPException(404, "Project not found")
        cur.execute(
            "insert into public.enquiries (project_id, project_name, user_id, name, phone, email, preferred_date, message) "
            "values (%s, %s, %s, %s, %s, %s, %s, %s)",
            (project_id, project["name"], user_id, name, phone, email or None, date or None, message or None),
        )
    hits.append(now)

    notify(
        f"📩 Viewing request: {project['name']}",
        message or "(no message)",
        [
            ("Name", name),
            ("Phone", phone),
            ("Email", email or "-"),
            ("Preferred date", date or "-"),
        ],
        color=0x1DB954,
    )
    return {"ok": True}
