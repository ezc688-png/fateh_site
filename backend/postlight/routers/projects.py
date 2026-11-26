import re
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from psycopg.rows import dict_row

from postlight.admin import require_admin
from postlight.config import settings
from postlight.database import connection
from postlight.services.audit import log_activity
from postlight.services.storage import remove_image_best_effort, store_image

router = APIRouter()

# The main photo is the project's own picture if it has one, otherwise the first gallery picture.
COVER_SQL = (
    "coalesce(p.image_path, (select i.image_path from public.project_images i "
    "where i.project_id = p.id order by i.position, i.created_at limit 1)) as cover_path"
)


# Accepts the usual YouTube link shapes and captures the 11-character video id.
YOUTUBE_RE = re.compile(
    r"^(?:https?://)?(?:www\.|m\.)?"
    r"(?:youtube\.com/(?:watch\?(?:[^#]*&)?v=|embed/|shorts/|live/)|youtu\.be/|youtube-nocookie\.com/embed/)"
    r"([A-Za-z0-9_-]{11})(?:[?&#/].*)?$"
)


def youtube_id(url: str | None) -> str | None:
    if not url:
        return None
    match = YOUTUBE_RE.match(url.strip())
    return match.group(1) if match else None


# Empty means "no video". Anything else must be a real YouTube link; we store a tidy canonical one.
def clean_video(value: str | None) -> str | None:
    value = (value or "").strip()
    if not value:
        return None
    video_id = youtube_id(value)
    if video_id is None:
        raise HTTPException(422, "Paste a YouTube link, for example https://www.youtube.com/watch?v=...")
    return f"https://www.youtube.com/watch?v={video_id}"


def image_url(path: str | None) -> str | None:
    if not path:
        return None
    base = settings.supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/public/{settings.supabase_storage_bucket}/{path}"


def serialize_project(row: dict) -> dict:
    cover = row["cover_path"] if "cover_path" in row else row["image_path"]
    return {
        "id": str(row["id"]),
        "name": row["name"],
        "description": row["description"],
        "category": row["category"],
        "status": row["status"],
        "area": row["area"],
        "bedrooms": row["bedrooms"],
        "sqft": row["sqft"],
        "is_penthouse": row["is_penthouse"],
        "price_min": row["price_min"],
        "price_max": row["price_max"],
        "image_url": image_url(cover),
        "video_url": row.get("video_url"),
        "video_id": youtube_id(row.get("video_url")),
        "created_at": row["created_at"].isoformat(),
    }


def clean_fields(name: str, description: str, area: str, price_min: int | None, price_max: int | None):
    name = name.strip()
    area = area.strip()
    description = description.strip()
    if not 1 <= len(name) <= 160:
        raise HTTPException(422, "Name must be between 1 and 160 characters")
    if not 1 <= len(area) <= 100:
        raise HTTPException(422, "Area is required (up to 100 characters)")
    if len(description) > 5000:
        raise HTTPException(422, "Description must be 5000 characters or fewer")
    if price_min is not None and price_max is not None and price_min > price_max:
        raise HTTPException(422, "Minimum price cannot be higher than maximum price")
    return name, description, area


@router.get("/projects")
def list_projects(
    category: Literal["condominium", "landed"] | None = None,
    status: Literal["new", "completed"] | None = None,
):
    clauses = []
    params = []
    if category:
        clauses.append("p.category = %s")
        params.append(category)
    if status:
        clauses.append("p.status = %s")
        params.append(status)
    where = "where " + " and ".join(clauses) if clauses else ""

    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(f"select p.*, {COVER_SQL} from public.projects p {where} order by p.name", params)
        return [serialize_project(row) for row in cur.fetchall()]


@router.get("/projects/{project_id}")
def get_project(project_id: UUID):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute(f"select p.*, {COVER_SQL} from public.projects p where p.id = %s", (project_id,))
        row = cur.fetchone()
    if row is None:
        raise HTTPException(404, "Project not found")
    return serialize_project(row)


@router.post("/projects", status_code=201)
async def create_project(
    name: Annotated[str, Form()],
    category: Annotated[Literal["condominium", "landed"], Form()],
    area: Annotated[str, Form()],
    admin_id: Annotated[UUID, Depends(require_admin)],
    description: Annotated[str, Form()] = "",
    status: Annotated[Literal["new", "completed"], Form()] = "new",
    bedrooms: Annotated[int | None, Form()] = None,
    sqft: Annotated[int | None, Form()] = None,
    is_penthouse: Annotated[bool, Form()] = False,
    price_min: Annotated[int | None, Form()] = None,
    price_max: Annotated[int | None, Form()] = None,
    video_url: Annotated[str | None, Form()] = None,
    image: UploadFile | None = File(default=None),
):
    name, description, area = clean_fields(name, description, area, price_min, price_max)
    video_url = clean_video(video_url)
    new_path = await store_image(image, admin_id)
    try:
        with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute(
                "insert into public.projects "
                "(name, description, category, status, area, bedrooms, sqft, is_penthouse, "
                "price_min, price_max, image_path, video_url) "
                "values (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s) returning *",
                (name, description, category, status, area, bedrooms, sqft,
                 is_penthouse, price_min, price_max, new_path, video_url),
            )
            created = serialize_project(cur.fetchone())
        log_activity(admin_id, "Created project", name)
        return created
    except Exception:
        remove_image_best_effort(new_path)
        raise


@router.put("/projects/{project_id}")
async def update_project(
    project_id: UUID,
    name: Annotated[str, Form()],
    category: Annotated[Literal["condominium", "landed"], Form()],
    area: Annotated[str, Form()],
    admin_id: Annotated[UUID, Depends(require_admin)],
    description: Annotated[str, Form()] = "",
    status: Annotated[Literal["new", "completed"], Form()] = "new",
    bedrooms: Annotated[int | None, Form()] = None,
    sqft: Annotated[int | None, Form()] = None,
    is_penthouse: Annotated[bool, Form()] = False,
    price_min: Annotated[int | None, Form()] = None,
    price_max: Annotated[int | None, Form()] = None,
    video_url: Annotated[str | None, Form()] = None,
    remove_existing_image: Annotated[bool, Form()] = False,
    image: UploadFile | None = File(default=None),
):
    name, description, area = clean_fields(name, description, area, price_min, price_max)
    video_url = clean_video(video_url)
    if image and remove_existing_image:
        raise HTTPException(422, "Choose a replacement image or remove the current image")
    new_path = await store_image(image, admin_id)
    old_path = None
    path = None
    try:
        with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("select * from public.projects where id = %s for update", (project_id,))
            old = cur.fetchone()
            if old is None:
                raise HTTPException(404, "Project not found")
            old_path = old["image_path"]
            path = new_path if new_path else (None if remove_existing_image else old_path)
            cur.execute(
                "update public.projects set name = %s, description = %s, category = %s, "
                "status = %s, area = %s, bedrooms = %s, sqft = %s, is_penthouse = %s, "
                "price_min = %s, price_max = %s, image_path = %s, video_url = %s "
                "where id = %s returning *",
                (name, description, category, status, area, bedrooms, sqft,
                 is_penthouse, price_min, price_max, path, video_url, project_id),
            )
            row = cur.fetchone()
    except Exception:
        remove_image_best_effort(new_path)
        raise
    if old_path and old_path != path:
        remove_image_best_effort(old_path)
    log_activity(admin_id, "Edited project", name)
    return serialize_project(row)


@router.delete("/projects/{project_id}", status_code=204)
def delete_project(project_id: UUID, admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select image_path, name from public.projects where id = %s for update", (project_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Project not found")
        cur.execute("delete from public.projects where id = %s", (project_id,))
    remove_image_best_effort(row["image_path"])
    log_activity(admin_id, "Deleted project", row["name"])
