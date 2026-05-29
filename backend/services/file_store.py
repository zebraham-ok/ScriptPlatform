"""File-based storage service for projects."""

import os
import json
import uuid
from datetime import datetime
from typing import List, Optional
from models.schemas import ProjectData, ProjectSummary, GraphData, PlotData


USER_ID = "user1"
BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "projects")


def _ensure_user_dir() -> str:
    user_dir = os.path.join(BASE_DIR, USER_ID)
    os.makedirs(user_dir, exist_ok=True)
    return user_dir


def _project_path(project_id: str) -> str:
    return os.path.join(_ensure_user_dir(), f"{project_id}.json")


def _init_empty_project(title: str, project_id: str) -> ProjectData:
    """Create a new empty project."""
    now = datetime.now().isoformat()
    return ProjectData(
        projectId=project_id,
        title=title,
        worldSetting=[],
        characters=GraphData(nodes=[], edges=[]),
        locations=GraphData(nodes=[], edges=[]),
        plot=PlotData(initialCheckpoint="", graph=GraphData(nodes=[], edges=[])),
        updatedAt=now,
    )


def list_projects() -> List[ProjectSummary]:
    """List all projects for the user."""
    user_dir = _ensure_user_dir()
    projects = []
    for filename in os.listdir(user_dir):
        if filename.endswith(".json"):
            try:
                with open(os.path.join(user_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                projects.append(ProjectSummary(
                    id=data.get("projectId", filename.replace(".json", "")),
                    title=data.get("title", "未命名"),
                    updatedAt=data.get("updatedAt", ""),
                ))
            except Exception:
                continue
    projects.sort(key=lambda p: p.updatedAt, reverse=True)
    return projects


def get_project(project_id: str) -> Optional[ProjectData]:
    """Get a single project by ID."""
    path = _project_path(project_id)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return ProjectData(**raw)


def create_project(title: str) -> ProjectData:
    """Create a new project."""
    project_id = uuid.uuid4().hex[:12]
    project = _init_empty_project(title, project_id)
    save_project(project_id, project)
    return project


def save_project(project_id: str, project: ProjectData):
    """Full save of a project."""
    project.updatedAt = datetime.now().isoformat()
    path = _project_path(project_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(project.model_dump(), f, ensure_ascii=False, indent=2)


def delete_project(project_id: str) -> bool:
    """Delete a project."""
    path = _project_path(project_id)
    if not os.path.exists(path):
        return False
    os.remove(path)
    return True


def patch_project(project_id: str, updates: dict) -> Optional[ProjectData]:
    """Partial update of a project."""
    project = get_project(project_id)
    if project is None:
        return None

    project_dict = project.model_dump()

    def _deep_update(target: dict, source: dict):
        for key, value in source.items():
            if isinstance(value, dict) and isinstance(target.get(key), dict):
                _deep_update(target[key], value)
            else:
                target[key] = value

    _deep_update(project_dict, updates)
    project_dict["updatedAt"] = datetime.now().isoformat()

    path = _project_path(project_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(project_dict, f, ensure_ascii=False, indent=2)

    return ProjectData(**project_dict)
