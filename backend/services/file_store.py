"""File-based storage service for projects. Each user has their own directory."""

import os
import json
import uuid
from datetime import datetime
from typing import List, Optional
from models.schemas import ProjectData, ProjectSummary, GraphData, PlotData, MechanicsData, AIChatRecord, AIHistoryData


BASE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "projects")


def _ensure_user_dir(user_id: str) -> str:
    user_dir = os.path.join(BASE_DIR, user_id)
    os.makedirs(user_dir, exist_ok=True)
    return user_dir


def _project_path(user_id: str, project_id: str) -> str:
    return os.path.join(_ensure_user_dir(user_id), f"{project_id}.json")


def _history_path(user_id: str, project_id: str) -> str:
    return os.path.join(_ensure_user_dir(user_id), f"{project_id}_history.json")


def _init_empty_project(title: str, project_id: str) -> ProjectData:
    """Create a new empty project."""
    now = datetime.now().isoformat()
    return ProjectData(
        projectId=project_id,
        title=title,
        worldSetting=[],
        characters=GraphData(nodes=[], edges=[]),
        locations=GraphData(nodes=[], edges=[]),
        items=GraphData(nodes=[], edges=[]),
        plot=PlotData(initialCheckpoint="", endCheckpoints=[], graph=GraphData(nodes=[], edges=[])),
        mechanics=MechanicsData(checks=[], votes=[]),
        updatedAt=now,
    )


def list_projects(user_id: str) -> List[ProjectSummary]:
    """List all projects for the user."""
    user_dir = _ensure_user_dir(user_id)
    projects = []
    for filename in os.listdir(user_dir):
        if filename.endswith(".json") and "backup" not in filename and not filename.endswith("_history.json"):
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


def get_project(user_id: str, project_id: str) -> Optional[ProjectData]:
    """Get a single project by ID."""
    path = _project_path(user_id, project_id)
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        raw = json.load(f)
    return ProjectData(**raw)


def create_project(user_id: str, title: str) -> ProjectData:
    """Create a new project."""
    project_id = uuid.uuid4().hex[:12]
    project = _init_empty_project(title, project_id)
    save_project(user_id, project_id, project)
    return project


def save_project(user_id: str, project_id: str, project: ProjectData):
    """Full save of a project."""
    project.updatedAt = datetime.now().isoformat()
    path = _project_path(user_id, project_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(project.model_dump(), f, ensure_ascii=False, indent=2)


def delete_project(user_id: str, project_id: str) -> bool:
    """Delete a project."""
    path = _project_path(user_id, project_id)
    if not os.path.exists(path):
        return False
    os.remove(path)
    return True


def patch_project(user_id: str, project_id: str, updates: dict) -> Optional[ProjectData]:
    """Partial update of a project. Validates BEFORE writing to disk to prevent data corruption."""
    project = get_project(user_id, project_id)
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

    # Validate BEFORE writing to disk — prevents corrupting the file
    validated = ProjectData(**project_dict)

    path = _project_path(user_id, project_id)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(validated.model_dump(), f, ensure_ascii=False, indent=2)

    return validated


# --- AI Chat History ---

def load_ai_history(user_id: str, project_id: str) -> AIHistoryData:
    """Load AI chat history for a project."""
    path = _history_path(user_id, project_id)
    if not os.path.exists(path):
        return AIHistoryData(records=[])
    with open(path, "r", encoding="utf-8") as f:
        data = json.load(f)
    records = [AIChatRecord(**r) for r in data.get("records", [])]
    return AIHistoryData(records=records)


def save_ai_record(user_id: str, project_id: str, record: AIChatRecord):
    """Append a new AI chat record to history. Uses file-level append to avoid loading the entire history."""
    path = _history_path(user_id, project_id)
    record_json = json.dumps(record.model_dump(), ensure_ascii=False, indent=2)
    # Indent each line of the record to match the array nesting
    indented_record = "\n    ".join(record_json.split("\n"))

    if not os.path.exists(path):
        # Create new history file
        content = '{\n  "records": [\n    ' + indented_record + '\n  ]\n}'
        with open(path, "w", encoding="utf-8") as f:
            f.write(content)
        return

    # Read existing file and insert new record before closing bracket
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()

    # Find the last ']' that closes the records array
    # Strategy: find the last occurrence of '\n  ]' (end of records array with proper indent)
    close_marker = "\n  ]"
    last_close = content.rfind(close_marker)
    if last_close == -1:
        # Fallback: load full file and rewrite (only if file structure is unexpected)
        history = load_ai_history(user_id, project_id)
        history.records.append(record)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(history.model_dump(), f, ensure_ascii=False, indent=2)
        return

    # Insert new record: content before close_marker + ",\n    " + indented_record + close_marker + rest
    new_content = content[:last_close] + ",\n    " + indented_record + content[last_close:]
    with open(path, "w", encoding="utf-8") as f:
        f.write(new_content)


def delete_ai_history(user_id: str, project_id: str) -> bool:
    """Delete all AI chat history for a project."""
    path = _history_path(user_id, project_id)
    if not os.path.exists(path):
        return False
    os.remove(path)
    return True


# --- Project Backup (for AI modify undo) ---

def _backup_path(user_id: str, project_id: str) -> str:
    return os.path.join(_ensure_user_dir(user_id), f"{project_id}_backup.json")


def backup_project(user_id: str, project_id: str) -> bool:
    """Create a backup of the current project JSON before AI modification."""
    src = _project_path(user_id, project_id)
    if not os.path.exists(src):
        return False
    import shutil
    shutil.copy2(src, _backup_path(user_id, project_id))
    return True


def has_backup(user_id: str, project_id: str) -> bool:
    """Check if a backup exists for this project."""
    return os.path.exists(_backup_path(user_id, project_id))


def restore_backup(user_id: str, project_id: str) -> Optional[ProjectData]:
    """Restore project from backup. Returns the restored project data or None."""
    backup = _backup_path(user_id, project_id)
    if not os.path.exists(backup):
        return None
    import shutil
    shutil.copy2(backup, _project_path(user_id, project_id))
    os.remove(backup)
    return get_project(user_id, project_id)
