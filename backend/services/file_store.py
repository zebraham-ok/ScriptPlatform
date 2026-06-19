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


def import_project(user_id: str, data: dict) -> ProjectData:
    """Import a project from external JSON data.
    
    Normalizes the imported data:
    - Generates a new projectId (ignores whatever is in the file)
    - Normalizes title (uses "未命名项目" if missing)
    - Fills in any missing fields with defaults
    - Sets updatedAt to current time
    """
    now = datetime.now().isoformat()

    # Generate a brand new projectId to avoid collisions
    new_project_id = uuid.uuid4().hex[:12]

    # Build a clean project dict with sensible defaults for any missing fields
    normalized = {
        "projectId": new_project_id,
        "title": str(data.get("title", "")).strip() or "未命名项目",
        "worldSetting": data.get("worldSetting", []),
        "characterParams": data.get("characterParams", []),
        "characters": data.get("characters", {"nodes": [], "edges": []}),
        "locations": data.get("locations", {"nodes": [], "edges": []}),
        "items": data.get("items", {"nodes": [], "edges": []}),
        "plot": data.get("plot", {
            "initialCheckpoint": "",
            "endCheckpoints": [],
            "graph": {"nodes": [], "edges": []},
        }),
        "mechanics": data.get("mechanics", {"checks": [], "votes": []}),
        "aiConfig": data.get("aiConfig", None),
        "updatedAt": now,
    }

    # Ensure graph-like fields have at minimum {nodes, edges}
    for graph_key in ["characters", "locations", "items"]:
        if isinstance(normalized[graph_key], dict):
            normalized[graph_key].setdefault("nodes", [])
            normalized[graph_key].setdefault("edges", [])

    if isinstance(normalized["plot"], dict):
        normalized["plot"].setdefault("initialCheckpoint", "")
        normalized["plot"].setdefault("endCheckpoints", [])
        if "graph" not in normalized["plot"] or not isinstance(normalized["plot"]["graph"], dict):
            normalized["plot"]["graph"] = {"nodes": [], "edges": []}
        else:
            normalized["plot"]["graph"].setdefault("nodes", [])
            normalized["plot"]["graph"].setdefault("edges", [])

    # Validate through Pydantic model
    project = ProjectData(**normalized)

    # Save to user's directory
    save_project(user_id, new_project_id, project)
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


# --- Plaza Index ---

_PLAZA_INDEX_PATH = os.path.join(BASE_DIR, "plaza_index.json")
_SCRIPTS_DIR = os.path.join(BASE_DIR, "scripts")
_plaza_lock = None  # lazy init in get_plaza_lock


def _get_plaza_lock():
    global _plaza_lock
    if _plaza_lock is None:
        import asyncio
        _plaza_lock = asyncio.Lock()
    return _plaza_lock


def load_plaza_index() -> dict:
    """Load the plaza index file."""
    os.makedirs(BASE_DIR, exist_ok=True)
    if not os.path.exists(_PLAZA_INDEX_PATH):
        default = {"version": "1.0", "scripts": []}
        with open(_PLAZA_INDEX_PATH, "w", encoding="utf-8") as f:
            json.dump(default, f, ensure_ascii=False, indent=2)
        return default
    with open(_PLAZA_INDEX_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def save_plaza_index(index: dict):
    """Save the plaza index file."""
    os.makedirs(BASE_DIR, exist_ok=True)
    with open(_PLAZA_INDEX_PATH, "w", encoding="utf-8") as f:
        json.dump(index, f, ensure_ascii=False, indent=2)


def get_script_json(script_id: str) -> Optional[dict]:
    """Load a published script JSON by ID."""
    path = os.path.join(BASE_DIR, "scripts", f"{script_id}.json")
    if not os.path.exists(path):
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_script_json(script_id: str, data: dict):
    """Save a published script JSON."""
    os.makedirs(_SCRIPTS_DIR, exist_ok=True)
    path = os.path.join(_SCRIPTS_DIR, f"{script_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
