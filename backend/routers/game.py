"""Game API routes — plaza browsing, room management, script publishing."""

import os
import json
import uuid
import asyncio
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends, UploadFile, File, Query, Request
from pydantic import BaseModel

from routers.auth import get_current_user
from models.game_schemas import (
    ScriptCard, ScriptListResponse,
    PublishScriptRequest, PublishScriptResponse,
    CreateRoomRequest, CreateRoomResponse,
    JoinRoomRequest, JoinRoomResponse,
    RoomStatusResponse,
    PlayableRole, SelectRoleRequest,
    CharacterSheetRequest, CharacterSheetResponse,
)
from services.file_store import (
    get_project, load_plaza_index, save_plaza_index,
    get_script_json, save_script_json,
)

router = APIRouter()

# --- In-memory room store (migrated from BUMENGweb-main web_server.py) ---
# In production, this would be Redis/DB-backed.
rooms: dict = {}
_rooms_lock = asyncio.Lock()

SCRIPTS_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "projects", "scripts")
os.makedirs(SCRIPTS_DIR, exist_ok=True)


# ========================================
#  Plaza / Scripts
# ========================================

@router.get("/game/scripts", response_model=ScriptListResponse)
async def list_scripts(
    page: int = Query(1, ge=1),
    pageSize: int = Query(20, ge=1, le=50),
    tag: Optional[str] = None,
    sort: str = "hot",
    keyword: Optional[str] = None,
    _username: str = Depends(get_current_user),
):
    """List published scripts on the plaza (paginated, filterable)."""
    index = load_plaza_index()
    scripts = index.get("scripts", [])

    # Filter by tag
    if tag:
        scripts = [s for s in scripts if tag in s.get("tags", [])]

    # Filter by keyword
    if keyword:
        kw = keyword.lower()
        scripts = [s for s in scripts if kw in s.get("title", "").lower()
                   or kw in s.get("author", "").lower()]

    # Sort
    if sort == "new":
        scripts.sort(key=lambda s: s.get("createTime", ""), reverse=True)
    elif sort == "rating":
        scripts.sort(key=lambda s: s.get("rating", 0), reverse=True)
    else:  # "hot" default
        scripts.sort(key=lambda s: s.get("playCount", 0), reverse=True)

    total = len(scripts)
    start = (page - 1) * pageSize
    end = start + pageSize
    page_items = scripts[start:end]

    return ScriptListResponse(
        total=total,
        list=[ScriptCard(**s) for s in page_items],
        hasMore=end < total,
    )


@router.get("/game/scripts/{script_id}/cover")
async def get_script_cover(
    script_id: str,
    _username: str = Depends(get_current_user),
):
    """Get the cover image for a script — auto-selects the first cached scene image."""
    data = get_script_json(script_id)
    if data is None:
        # Script JSON file not found on this server (may not have been deployed/transferred)
        print(f"⚠️ [Cover] 剧本 JSON 不存在: {script_id}，返回空封面")
        return {"success": True, "data": {"coverUrl": None}}

    title = data.get("title", "")

    # Get location nodes from the script
    locations_graph = data.get("locations", {})
    location_nodes = locations_graph.get("nodes", []) if isinstance(locations_graph, dict) else []

    from services.image_service import scene_cache_exists, get_cached_scene_base64

    # Try each location in order — return the first one with a cached scene image
    for node in location_nodes:
        if isinstance(node, dict):
            loc_data = node.get("data", {}) if isinstance(node.get("data"), dict) else {}
            location_name = node.get("label", "") or loc_data.get("name", "")
            if location_name and scene_cache_exists(location_name, title):
                b64 = get_cached_scene_base64(location_name, title)
                print(f"✅ [Cover] 命中封面: {script_id} -> {location_name}")
                return {"success": True, "data": {"coverUrl": b64}}

    print(f"📭 [Cover] 无缓存场景图: {script_id} (title={title}, locations={len(location_nodes)})")
    return {"success": True, "data": {"coverUrl": None}}


@router.get("/game/scripts/{script_id}/json")
async def download_script_json(
    script_id: str,
    _username: str = Depends(get_current_user),
):
    """Download the full script JSON."""
    data = get_script_json(script_id)
    if data is None:
        raise HTTPException(status_code=404, detail="剧本 JSON 不存在")
    return {"success": True, "data": data}


@router.get("/game/scripts/{script_id}")
async def get_script_detail(
    script_id: str,
    _username: str = Depends(get_current_user),
):
    """Get script detail by ID."""
    index = load_plaza_index()
    for s in index.get("scripts", []):
        if s["id"] == script_id:
            return {"success": True, "data": ScriptCard(**s).model_dump()}
    raise HTTPException(status_code=404, detail="剧本不存在")


@router.post("/game/scripts", response_model=PublishScriptResponse)
async def publish_script(
    body: PublishScriptRequest,
    username: str = Depends(get_current_user),
):
    """Publish a project to the plaza."""
    project = get_project(username, body.projectId)
    if project is None:
        raise HTTPException(status_code=404, detail="项目不存在")

    project_dict = project.model_dump()

    # Extract playable characters and compute player bounds
    characters = project_dict.get("characters", {}).get("nodes", [])
    playable_chars = [c for c in characters if c.get("data", {}).get("isPlayable")]
    min_players = sum(c.get("data", {}).get("minPlayers", 0) for c in playable_chars)
    max_players = sum(c.get("data", {}).get("maxPlayers", 1) for c in playable_chars) if playable_chars else 0

    if min_players > max_players:
        raise HTTPException(status_code=400, detail="最小玩家数不能大于最大玩家数")

    # Generate script ID
    script_id = f"script_{uuid.uuid4().hex[:8]}"

    # Extract tags from world setting or use defaults
    tags = []
    world_setting = project_dict.get("worldSetting", [])
    for block in world_setting:
        if isinstance(block, dict) and block.get("title") == "标签":
            content = block.get("content", "")
            tags = [t.strip() for t in content.split(",") if t.strip()]

    # Build plaza index entry
    entry = {
        "id": script_id,
        "title": project_dict.get("title", "未命名"),
        "author": username,
        "coverPath": None,
        "tags": tags or ["未分类"],
        "rating": 5.0,
        "playCount": 0,
        "duration": "2-3小时",
        "playerCount": f"{max_players}人" if max_players > 0 else "不限人数",
        "jsonPath": f"/scripts/{script_id}.json",
        "createTime": datetime.now().isoformat(),
        "isOfficial": False,
    }

    # Save script JSON to plaza
    save_script_json(script_id, project_dict)

    # Add to plaza index
    index = load_plaza_index()
    index["scripts"].append(entry)
    save_plaza_index(index)

    return PublishScriptResponse(
        success=True,
        data={"scriptId": script_id, "message": "剧本发布成功"},
    )


# ========================================
#  Room Management
# ========================================

def _generate_room_id() -> str:
    """Generate a 6-digit room code."""
    import random
    return str(random.randint(100000, 999999))


@router.post("/game/rooms", response_model=CreateRoomResponse)
async def create_room(
    body: CreateRoomRequest,
    username: str = Depends(get_current_user),
):
    """Create a new game room."""
    room_id = _generate_room_id()
    # Ensure uniqueness
    async with _rooms_lock:
        while room_id in rooms:
            room_id = _generate_room_id()

        script_title = ""
        script_id = None
        editor_json = None

        if body.mode == "script":
            if body.editorJson:
                editor_json = body.editorJson
                script_title = editor_json.get("title", "编辑器试玩")
            elif body.scriptId:
                script_id = body.scriptId
                # Look up title from plaza
                index = load_plaza_index()
                for s in index.get("scripts", []):
                    if s["id"] == body.scriptId:
                        script_title = s.get("title", "未命名剧本")
                        break
            else:
                raise HTTPException(status_code=400, detail="script 模式需要 scriptId 或 editorJson")

        room = {
            "roomId": room_id,
            "roomName": script_title or "快速开局",
            "mode": body.mode,
            "scriptId": script_id,
            "scriptTitle": script_title,
            "editorJson": editor_json,
            "worldview": body.worldview or "",
            "rolePrefs": body.rolePrefs or "",
            "totalRounds": body.totalRounds,
            "owner": username,
            "stage": "LOBBY",
            "players": {},
            "assignedRoles": {},
            "readyPlayers": set(),
            "createdAt": datetime.now().isoformat(),
        }
        rooms[room_id] = room

    share_url = f"/game/room/{room_id}"

    return CreateRoomResponse(
        success=True,
        data={
            "roomId": room_id,
            "mode": body.mode,
            "scriptId": script_id,
            "scriptTitle": script_title,
            "shareUrl": share_url,
        },
    )


@router.get("/game/rooms/{room_id}", response_model=RoomStatusResponse)
async def get_room_status(room_id: str):
    """Get room status (public, no auth required)."""
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在")

    return RoomStatusResponse(
        success=True,
        data={
            "roomId": room["roomId"],
            "roomName": room.get("roomName", ""),
            "mode": room["mode"],
            "stage": room["stage"],
            "playerCount": len(room["players"]),
            "assignedRoles": room.get("assignedRoles", {}),
            "createdAt": room.get("createdAt", ""),
        },
    )


@router.post("/game/rooms/import", response_model=CreateRoomResponse)
async def import_room(
    file: UploadFile = File(...),
):
    """Create a room by uploading a JSON file (guest-friendly)."""
    if not file.filename or not file.filename.endswith(".json"):
        raise HTTPException(status_code=400, detail="请上传 .json 文件")

    content = await file.read()
    if len(content) > 5 * 1024 * 1024:  # 5MB limit
        raise HTTPException(status_code=400, detail="文件大小不能超过 5MB")

    try:
        data = json.loads(content.decode("utf-8"))
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="JSON 解析失败")

    room_id = _generate_room_id()
    async with _rooms_lock:
        while room_id in rooms:
            room_id = _generate_room_id()

        room = {
            "roomId": room_id,
            "roomName": data.get("title", "导入剧本"),
            "mode": "import",
            "scriptId": None,
            "scriptTitle": data.get("title", ""),
            "editorJson": data,
            "worldview": "",
            "rolePrefs": "",
            "totalRounds": 15,
            "owner": None,  # No owner for imported rooms (guest-friendly)
            "stage": "LOBBY",
            "players": {},
            "assignedRoles": {},
            "readyPlayers": set(),
            "createdAt": datetime.now().isoformat(),
        }
        rooms[room_id] = room

    return CreateRoomResponse(
        success=True,
        data={
            "roomId": room_id,
            "mode": "import",
            "scriptTitle": data.get("title", "导入剧本"),
            "shareUrl": f"/game/room/{room_id}",
        },
    )


@router.post("/game/rooms/{room_id}/join", response_model=JoinRoomResponse)
async def join_room(
    room_id: str,
    body: JoinRoomRequest,
):
    """Join a room by link (guest-friendly, no auth required)."""
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在")

    if room["stage"] != "LOBBY":
        raise HTTPException(status_code=400, detail="游戏已开始，无法加入")

    # Check nickname uniqueness
    for pid, pdata in room["players"].items():
        if pdata.get("nickname") == body.nickname:
            raise HTTPException(status_code=400, detail="该昵称已被使用，请换一个")

    player_id = f"player_{uuid.uuid4().hex[:8]}"

    async with _rooms_lock:
        room["players"][player_id] = {
            "playerId": player_id,
            "nickname": body.nickname,
            "isGuest": True,
            "characterId": None,
            "characterName": None,
            "attributes": {},
            "connectedAt": datetime.now().isoformat(),
        }

    return JoinRoomResponse(
        success=True,
        data={
            "roomId": room_id,
            "playerId": player_id,
            "role": "player",
        },
    )


# ========================================
#  Role Selection & Character Sheet
# ========================================

@router.post("/game/rooms/{room_id}/roles")
async def select_role(
    room_id: str,
    body: SelectRoleRequest,
    request: Request,
):
    """Select/bind a playable character role."""
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在")

    # Get player from session (header or cookie — simplified: use playerId from header)
    player_id = request.headers.get("X-Player-Id")
    if not player_id or player_id not in room["players"]:
        raise HTTPException(status_code=400, detail="请先加入房间")

    # Check if role is already taken
    assigned = room.get("assignedRoles", {})
    for cid, pid in assigned.items():
        if cid == body.characterId and pid != player_id:
            raise HTTPException(status_code=400, detail="该角色已被其他玩家选择")

    async with _rooms_lock:
        room["assignedRoles"][body.characterId] = player_id
        room["players"][player_id]["characterId"] = body.characterId

    return {"success": True, "data": {"characterId": body.characterId}}


@router.post("/game/rooms/{room_id}/character-sheet", response_model=CharacterSheetResponse)
async def submit_character_sheet(
    room_id: str,
    body: CharacterSheetRequest,
    request: Request,
):
    """Submit custom attributes for a playable character."""
    room = rooms.get(room_id)
    if room is None:
        raise HTTPException(status_code=404, detail="房间不存在")

    player_id = request.headers.get("X-Player-Id")
    if not player_id or player_id not in room["players"]:
        raise HTTPException(status_code=400, detail="请先加入房间")

    # Validate character assignment
    if room["players"][player_id].get("characterId") != body.characterId:
        raise HTTPException(status_code=400, detail="你尚未选择该角色")

    # Validate attributes against constraints (simplified: just store)
    async with _rooms_lock:
        room["players"][player_id]["attributes"] = body.attributes

    return CharacterSheetResponse(
        success=True,
        data={"characterId": body.characterId, "attributes": body.attributes},
    )
