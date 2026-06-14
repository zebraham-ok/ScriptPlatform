"""Project CRUD API routes."""

from fastapi import APIRouter, HTTPException, Depends
from models.schemas import (
    ProjectData,
    ProjectSummary,
    CreateProjectRequest,
    ImportProjectRequest,
)
from services import file_store
from routers.auth import get_current_user

router = APIRouter()


@router.get("/projects", response_model=list[ProjectSummary])
async def list_projects(username: str = Depends(get_current_user)):
    """Get list of all projects for the current user."""
    return file_store.list_projects(username)


@router.post("/projects", response_model=ProjectData)
async def create_project(body: CreateProjectRequest, username: str = Depends(get_current_user)):
    """Create a new project."""
    return file_store.create_project(username, body.title)


@router.post("/projects/import", response_model=ProjectData)
async def import_project(body: ImportProjectRequest, username: str = Depends(get_current_user)):
    """Import a project from external JSON data.
    
    Normalizes naming and saves under the logged-in user's directory.
    """
    try:
        return file_store.import_project(username, body.data)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败：{str(e)}")


@router.get("/projects/{project_id}", response_model=ProjectData)
async def get_project(project_id: str, username: str = Depends(get_current_user)):
    """Get a single project by ID."""
    project = file_store.get_project(username, project_id)
    if project is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return project


@router.put("/projects/{project_id}", response_model=ProjectData)
async def update_project(project_id: str, body: ProjectData, username: str = Depends(get_current_user)):
    """Full update of a project."""
    existing = file_store.get_project(username, project_id)
    if existing is None:
        raise HTTPException(status_code=404, detail="Project not found")
    file_store.save_project(username, project_id, body)
    return body


@router.patch("/projects/{project_id}", response_model=ProjectData)
async def patch_project(project_id: str, body: dict, username: str = Depends(get_current_user)):
    """Partial update of a project."""
    result = file_store.patch_project(username, project_id, body)
    if result is None:
        raise HTTPException(status_code=404, detail="Project not found")
    return result


@router.delete("/projects/{project_id}")
async def delete_project(project_id: str, username: str = Depends(get_current_user)):
    """Delete a project."""
    success = file_store.delete_project(username, project_id)
    if not success:
        raise HTTPException(status_code=404, detail="Project not found")
    return {"message": "Project deleted"}
