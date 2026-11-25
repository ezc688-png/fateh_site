"""FastAPI entry point. Run with: uvicorn main:app --reload --port 8000."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from postlight.config import settings
from postlight.routers import (
    admin_panel,
    chat,
    comments,
    health,
    me,
    posts,
    project_images,
    projects,
)


app = FastAPI(title="Postlight API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.frontend_origin.split(",")],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(health.router)
app.include_router(posts.router)
app.include_router(chat.router)
app.include_router(projects.router)
app.include_router(comments.router)
app.include_router(project_images.router)
app.include_router(me.router)
app.include_router(admin_panel.router)
