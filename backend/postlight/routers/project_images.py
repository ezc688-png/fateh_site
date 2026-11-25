from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from psycopg.rows import dict_row

from postlight.admin import require_admin
from postlight.config import settings
from postlight.database import connection
from postlight.services.storage import remove_image_best_effort, store_image

router = APIRouter()

MAX_PER_UPLOAD = 10
MAX_PER_PROJECT = 20


def image_url(path: str) -> str:
    base = settings.supabase_url.rstrip("/")
    return f"{base}/storage/v1/object/public/{settings.supabase_storage_bucket}/{path}"


def serialize_image(row: dict) -> dict:
    return {
        "id": str(row["id"]),
        "project_id": str(row["project_id"]),
        "image_url": image_url(row["image_path"]),
        "position": row["position"],
    }


async def save_images(project_id: UUID, admin_id: UUID, files: list[UploadFile]) -> list[dict]:
    stored: list[str] = []
    try:
        # Validate and upload every file first (PNG, JPEG or WebP, up to 5 MB each).
        for file in files:
            path = await store_image(file, admin_id)
            if path:
                stored.append(path)
        if not stored:
            raise HTTPException(422, "No pictures were received")

        with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
            cur.execute("select 1 from public.projects where id = %s for update", (project_id,))
            if cur.fetchone() is None:
                raise HTTPException(404, "Project not found")
            cur.execute(
                "select count(*) as n, coalesce(max(position), -1) as last "
                "from public.project_images where project_id = %s",
                (project_id,),
            )
            info = cur.fetchone()
            if info["n"] + len(stored) > MAX_PER_PROJECT:
                raise HTTPException(422, f"A project can have at most {MAX_PER_PROJECT} gallery pictures")

            rows = []
            for offset, path in enumerate(stored, start=1):
                cur.execute(
                    "insert into public.project_images (project_id, image_path, position) "
                    "values (%s, %s, %s) returning *",
                    (project_id, path, info["last"] + offset),
                )
                rows.append(cur.fetchone())
            return [serialize_image(row) for row in rows]
    except Exception:
        # If anything fails, remove the files already uploaded so no orphans are left.
        for path in stored:
            remove_image_best_effort(path)
        raise


@router.get("/projects/{project_id}/images")
def list_images(project_id: UUID):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select 1 from public.projects where id = %s", (project_id,))
        if cur.fetchone() is None:
            raise HTTPException(404, "Project not found")
        cur.execute(
            "select * from public.project_images where project_id = %s order by position, created_at",
            (project_id,),
        )
        return [serialize_image(row) for row in cur.fetchall()]


# One picture at a time: Swagger (/docs) shows a "Choose File" button for this one.
@router.post("/projects/{project_id}/image", status_code=201)
async def add_image(
    project_id: UUID,
    admin_id: Annotated[UUID, Depends(require_admin)],
    image: UploadFile = File(...),
):
    return (await save_images(project_id, admin_id, [image]))[0]


# Many pictures at once: used by the website's multi-select button.
@router.post("/projects/{project_id}/images", status_code=201)
async def add_images(
    project_id: UUID,
    admin_id: Annotated[UUID, Depends(require_admin)],
    images: list[UploadFile] = File(...),
):
    if not 1 <= len(images) <= MAX_PER_UPLOAD:
        raise HTTPException(422, f"Upload between 1 and {MAX_PER_UPLOAD} pictures at a time")
    return await save_images(project_id, admin_id, images)


# Change a picture's place in the gallery. The first picture is the project's main photo.
@router.put("/project-images/{image_id}/move")
def move_image(
    image_id: UUID,
    admin_id: Annotated[UUID, Depends(require_admin)],
    direction: Annotated[Literal["first", "earlier", "later"], Form()],
):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select project_id from public.project_images where id = %s", (image_id,))
        found = cur.fetchone()
        if found is None:
            raise HTTPException(404, "Picture not found")
        project_id = found["project_id"]

        cur.execute("select 1 from public.projects where id = %s for update", (project_id,))
        cur.execute(
            "select id from public.project_images where project_id = %s order by position, created_at",
            (project_id,),
        )
        ids = [row["id"] for row in cur.fetchall()]
        if image_id not in ids:
            raise HTTPException(404, "Picture not found")

        index = ids.index(image_id)
        ids.pop(index)
        if direction == "first":
            target = 0
        elif direction == "earlier":
            target = max(index - 1, 0)
        else:
            target = min(index + 1, len(ids))
        ids.insert(target, image_id)

        for position, pid in enumerate(ids):
            cur.execute("update public.project_images set position = %s where id = %s", (position, pid))

        cur.execute(
            "select * from public.project_images where project_id = %s order by position, created_at",
            (project_id,),
        )
        return [serialize_image(row) for row in cur.fetchall()]


@router.delete("/project-images/{image_id}", status_code=204)
def delete_image(image_id: UUID, admin_id: Annotated[UUID, Depends(require_admin)]):
    with connection() as conn, conn.cursor(row_factory=dict_row) as cur:
        cur.execute("select image_path from public.project_images where id = %s for update", (image_id,))
        row = cur.fetchone()
        if row is None:
            raise HTTPException(404, "Picture not found")
        cur.execute("delete from public.project_images where id = %s", (image_id,))
    remove_image_best_effort(row["image_path"])
