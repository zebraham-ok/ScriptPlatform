"""Project CRUD API routes."""

from fastapi import APIRouter, HTTPException
from models.schemas import (
    ProjectData,
    ProjectSummary,
    CreateProjectRequest,
)
from services import file_store

router = APIRouter()


@router.get("/projects", response_model=list[ProjectSummary])
async def list_projects():
    """Get list of all projects."""
    return file_store.list_projects()


@router.post("/projects", response_model=ProjectData)
async def create_project(body: CreateProjectRequest):
    """Create a new project."""
    return file_store.create_project(body.title)


@router.get("/projects/{project_id}", response_model=ProjectData)
async def get_project(project_id: str):
    """Get a single project by ID."""
    project = file_store.get_project(project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/projects/{project_id}", response_model=ProjectData)
async def update_project(project_id: str, body: ProjectData):
    """Full update of a project."""
    existing = file_store.get_project(project_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Project not found")
    file_store.save_project(project_id, body)
    return body


@router.patch("/projects/{project_id}", response_model=ProjectData)
async def patch_project(project_id: str, body: dict):
    """Partial update of a project."""
    result = file_store.patch_project(project_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    success = file_store.delete_project(project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}
