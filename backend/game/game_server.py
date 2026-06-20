"""
Socket.IO Game Server — real-time room management + LangGraph integration.
Migrated from BUMENGweb-main web_server.py, engine.py, manager.py.
"""

import os
import json
import uuid
import asyncio
import traceback
from datetime import datetime
from typing import Dict, Any, Optional, Set, List

import socketio
from game.state import GameState
from game.graph import create_room_graph


# ========================================
#  Socket.IO Server Setup
# ========================================

sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins="*",
    ping_timeout=60,
    ping_interval=25,
)

# In-memory state
rooms: Dict[str, Dict[str, Any]] = {}
"""rooms[room_id] = {
    "id", "name", "mode", "scriptId", "editorJson",
    "owner": sid, "stage": str,
    "players": {sid: {playerId, nickname, characterId, ...}},
    "assignedRoles": {charId: sid},
    "graph": compiled LangGraph,
    "config": {"configurable": {"thread_id": str}},
    "state": dict (current GameState dict),
    "createdAt": str,
    "shareUrl": str,
}
"""

sid_to_room: Dict[str, str] = {}
"""Map sid → room_id for quick room lookup."""

_io_lock = asyncio.Lock()


def _build_initial_state(room: dict) -> dict:
    """Build initial GameState dictionary for a room."""
    return {
        "room_id": room["id"],
        "room_name": room.get("name", ""),
        "mode": room.get("mode", "sandbox"),
        "scriptId": room.get("scriptId", ""),
        "script_id": room.get("scriptId", ""),
        "owner_sid": room.get("owner", ""),
        "players": room.get("players", {}).copy(),
        "player_count": len(room.get("players", {})),
        "assigned_roles": room.get("assignedRoles", {}).copy(),
        "available_roles": [],
        "ready_players": set(room.get("readyPlayers", set())),
        "stage": "LOBBY",
        "current_round": 1,
        "total_rounds": room.get("totalRounds", 15),
        "suggestions": [],
        "role_prefs": {},
        "script_title": room.get("scriptTitle", ""),
        "world_setting": [],
        "characters_data": [],
        "locations_data": [],
        "items_data": [],
        "plot_graph": {"nodes": [], "edges": []},
        "mechanics_checks": [],
        "mechanics_votes": [],
        "character_attributes": {},
        "current_node": "",
        "node_history": [],
        "scene": "大厅",
        "scene_description": "",
        "scene_image": None,
        "inventory": [],
        "chat_history": [],
        "long_term_memory": {},
        "plot_inspection": {},
        "turn_number": 1,
        "turn_timeout_seconds": 120,
        "players_acted_this_turn": set(),
        "players_skipped_this_turn": set(),
        "turn_started_at": None,
        "dm_response": "",
        "dm_actions": [],
        "dm_options": [],
        "private_messages": {},
        "pending_check": None,
        "pending_vote": None,
        "dice_result": None,
        "vote_results": {},
        "ending_reached": False,
        "ending_data": None,
        "_end_node_reached": False,
        "end_checkpoints": [],
        "_need_dm_narration": False,
        "_route": "wait",
    }


async def _broadcast_room_state(room_id: str, extra: Optional[dict] = None):
    """Emit current room state to all players in a room."""
    room = rooms.get(room_id)
    if not room:
        return

    players_in_room = {
        sid: pdata for sid, pdata in room["players"].items()
    }

    # Build roles list
    roles = []
    for cid, sid in room.get("assignedRoles", {}).items():
        pdata = players_in_room.get(sid, {})
        roles.append({
            "characterId": cid,
            "playerId": pdata.get("playerId", ""),
            "nickname": pdata.get("nickname", ""),
        })

    state_data = {
        "roomId": room_id,
        "stage": room.get("stage", "LOBBY"),
        "mode": room.get("mode", "sandbox"),
        "players": [
            {
                "sid": s,
                "playerId": p.get("playerId", ""),
                "nickname": p.get("nickname", ""),
                "characterId": p.get("characterId", ""),
                "characterName": p.get("characterName", ""),
                "attributes": p.get("attributes", {}),
                "inventory": p.get("inventory", []),
                "isReady": p.get("isReady", False),
            }
            for s, p in players_in_room.items()
        ],
        "roles": roles,
        "scriptTitle": room.get("scriptTitle", ""),
        "ownerSid": room.get("owner", ""),
        "totalRounds": room.get("totalRounds", 15),
    }
    if extra:
        state_data.update(extra)

    await sio.emit("room_state", state_data, room=room_id)


async def _emit_stage_change(room_id: str, from_stage: str, to_stage: str):
    """Emit stage change event."""
    await sio.emit("stage_change", {
        "roomId": room_id,
        "fromStage": from_stage,
        "toStage": to_stage,
    }, room=room_id)


async def _invoke_graph(room: dict, updates: dict) -> dict:
    """
    Invoke the LangGraph for a room with given state updates.
    Returns the new state dict after graph execution.
    
    IMPORTANT: We use a FRESH thread_id per invocation so that MemorySaver
    (required by the compiled graph) never loads stale checkpoint state.
    State persistence is managed externally via room["state"].
    """
    graph = room["graph"]

    # Apply updates to state
    current_state = room["state"].copy()
    current_state.update(updates)

    # Fresh thread_id each time → no stale checkpoint can override current_state
    config = {"configurable": {"thread_id": f"room_{room['id']}_{uuid.uuid4().hex[:8]}"}}

    print(f"[GameServer] _invoke_graph room={room['id']}: "
          f"_route={current_state.get('_route', '?')}, "
          f"current_round={current_state.get('current_round', '?')}, "
          f"chat_history_len={len(current_state.get('chat_history', []))}, "
          f"dm_response_len={len(current_state.get('dm_response', ''))}, "
          f"updates_keys={list(updates.keys()) if updates else 'none'}")

    try:
        result = await asyncio.wait_for(
            graph.ainvoke(current_state, config),
            timeout=240.0,  # must exceed AI client timeout (180s)
        )
        room["state"] = result
        print(f"[GameServer] Graph finished for room {room['id']}, "
              f"stage={result.get('stage', '?')}, "
              f"current_round={result.get('current_round', '?')}, "
              f"dm_response_len={len(result.get('dm_response', ''))}, "
              f"result_chat_history_len={len(result.get('chat_history', []))}")
        return result
    except asyncio.TimeoutError:
        print(f"[GameServer] Graph invocation timeout for room {room['id']}")
        room["state"] = current_state
        return current_state
    except Exception as e:
        print(f"[GameServer] Graph error for room {room['id']}: {e}")
        traceback.print_exc()
        room["state"] = current_state
        return current_state


# ========================================
#  Connection / Disconnection
# ========================================

@sio.event
async def connect(sid: str, environ: dict):
    print(f"[GameServer] Client connected: {sid}")


@sio.event
async def disconnect(sid: str):
    print(f"[GameServer] Client disconnected: {sid}")
    room_id = sid_to_room.get(sid)
    if room_id:
        room = rooms.get(room_id)
        if room and sid in room.get("players", {}):
            async with _io_lock:
                del room["players"][sid]
                # Clean up role assignment
                assigned = room.get("assignedRoles", {})
                for cid, psid in list(assigned.items()):
                    if psid == sid:
                        del assigned[cid]
            await _broadcast_room_state(room_id)
        await sio.leave_room(sid, room_id)
        del sid_to_room[sid]


# ========================================
#  Room Events
# ========================================

@sio.event
async def create_room(sid: str, data: dict):
    """Create a new game room."""
    mode = data.get("mode", "sandbox")
    room_id = data.get("roomId", "")
    script_id = data.get("scriptId", "")
    editor_json = data.get("editorJson")
    worldview = data.get("worldview", "")
    role_prefs = data.get("rolePrefs", "")
    total_rounds = data.get("totalRounds", 15)

    if not room_id:
        import random
        room_id = str(random.randint(100000, 999999))

    # Check unique
    async with _io_lock:
        while room_id in rooms:
            import random
            room_id = str(random.randint(100000, 999999))

        # Get script title if available
        script_title = "快速开局"
        if mode == "script":
            if editor_json:
                script_title = editor_json.get("title", "编辑器试玩")
            elif script_id:
                from services.file_store import load_plaza_index
                index = load_plaza_index()
                for s in index.get("scripts", []):
                    if s["id"] == script_id:
                        script_title = s.get("title", "未命名剧本")
                        break

        # Build room
        room = {
            "id": room_id,
            "name": script_title,
            "mode": mode,
            "scriptId": script_id,
            "scriptTitle": script_title,
            "editorJson": editor_json,
            "worldview": worldview,
            "rolePrefs": role_prefs,
            "totalRounds": total_rounds,
            "owner": sid,
            "stage": "LOBBY",
            "players": {},
            "assignedRoles": {},
            "readyPlayers": set(),
            "availableRoles": [],
            "createdAt": datetime.now().isoformat(),
            "shareUrl": f"/game/room/{room_id}",
        }

        # Create isolated LangGraph for this room
        room["graph"] = create_room_graph()
        room["config"] = {"configurable": {"thread_id": f"room_{room_id}"}}
        room["state"] = _build_initial_state(room)

        rooms[room_id] = room
        sid_to_room[sid] = room_id
        await sio.enter_room(sid, room_id)

    await sio.emit("room_created", {
        "roomId": room_id,
        "mode": mode,
        "scriptTitle": script_title,
        "shareUrl": room["shareUrl"],
    }, to=sid)

    print(f"[GameServer] Room {room_id} created by {sid}")


@sio.event
async def join_room(sid: str, data: dict):
    """Join an existing room."""
    room_id = data.get("roomId", "")
    nickname = data.get("nickname", "游客")
    player_id = data.get("playerId", f"player_{uuid.uuid4().hex[:8]}")
    is_guest = data.get("isGuest", True)

    room = rooms.get(room_id)
    if not room:
        await sio.emit("join_error", {"message": "房间不存在"}, to=sid)
        return

    if room["stage"] != "LOBBY":
        await sio.emit("join_error", {"message": "游戏已开始，无法加入"}, to=sid)
        return

    # Check nickname uniqueness
    for existing_sid, pdata in room["players"].items():
        if pdata.get("nickname") == nickname:
            await sio.emit("join_error", {"message": "该昵称已被使用"}, to=sid)
            return

    async with _io_lock:
        room["players"][sid] = {
            "playerId": player_id,
            "nickname": nickname,
            "isGuest": is_guest,
            "characterId": None,
            "characterName": None,
            "attributes": {},
            "inventory": [],
            "connectedAt": datetime.now().isoformat(),
        }
        sid_to_room[sid] = room_id
        await sio.enter_room(sid, room_id)
        room["state"]["players"] = room["players"].copy()
        room["state"]["player_count"] = len(room["players"])

    await sio.emit("room_joined", {
        "roomId": room_id,
        "playerId": player_id,
        "role": "player",
    }, to=sid)

    await _broadcast_room_state(room_id)
    print(f"[GameServer] {nickname} ({sid}) joined room {room_id}")


@sio.event
async def leave_room(sid: str, data: dict):
    """Leave current room."""
    room_id = data.get("roomId", sid_to_room.get(sid, ""))
    room = rooms.get(room_id)
    if room and sid in room.get("players", {}):
        async with _io_lock:
            del room["players"][sid]
            # Clean role
            assigned = room.get("assignedRoles", {})
            for cid, psid in list(assigned.items()):
                if psid == sid:
                    del assigned[cid]
        if sid in sid_to_room:
            del sid_to_room[sid]
        await sio.leave_room(sid, room_id)
        await _broadcast_room_state(room_id)


# ========================================
#  Lobby Events
# ========================================

@sio.event
async def submit_preference(sid: str, data: dict):
    """Submit worldview / role preferences (sandbox mode lobby)."""
    room_id = sid_to_room.get(sid, data.get("roomId", ""))
    room = rooms.get(room_id)
    if not room:
        return

    suggestion = data.get("suggestion", "")
    role_pref = data.get("rolePref", "")

    state = room["state"]
    if suggestion:
        suggestions = list(state.get("suggestions", []))
        suggestions.append(suggestion)
        state["suggestions"] = suggestions

    if role_pref:
        prefs = dict(state.get("role_prefs", {}))
        player_name = room["players"].get(sid, {}).get("nickname", "玩家")
        prefs[player_name] = role_pref
        state["role_prefs"] = prefs

    await sio.emit("chat_message", {
        "role": "system",
        "content": f"收到偏好：{suggestion}" if suggestion else "偏好已记录",
        "timestamp": datetime.now().isoformat(),
    }, room=room_id)


@sio.event
async def select_role(sid: str, data: dict):
    """Player selects a playable character role."""
    room_id = sid_to_room.get(sid, data.get("roomId", ""))
    room = rooms.get(room_id)
    if not room:
        return

    character_id = data.get("characterId", "")
    if not character_id:
        return

    # Check if already assigned to another player
    assigned = room.get("assignedRoles", {})
    if character_id in assigned and assigned[character_id] != sid:
        await sio.emit("join_error", {"message": "该角色已被其他玩家选择"}, to=sid)
        return

    async with _io_lock:
        room["assignedRoles"][character_id] = sid
        if sid in room["players"]:
            room["players"][sid]["characterId"] = character_id
            # Resolve character name from role_details
            role_details = room["state"].get("_role_details", [])
            char_info = next((r for r in role_details if r.get("id") == character_id), None)
            if char_info:
                room["players"][sid]["characterName"] = char_info.get("name", character_id)
            # Ensure inventory is initialized
            if "inventory" not in room["players"][sid]:
                room["players"][sid]["inventory"] = []

    room["state"]["assigned_roles"] = room["assignedRoles"].copy()

    await sio.emit("role_update", {
        "characterId": character_id,
        "playerSid": sid,
        "nickname": room["players"].get(sid, {}).get("nickname", ""),
    }, room=room_id)

    await _broadcast_room_state(room_id)

    # If character has NO customizable fields → auto-ready
    if room.get("stage") == "ROLE_SELECT":
        role_details = room["state"].get("_role_details", [])
        selected_role = next((r for r in role_details if r.get("id") == character_id), None)
        has_custom_fields = bool(selected_role and selected_role.get("customizableAttributes"))
        print(f"[GameServer] select_role: role={character_id[:8]}..., "
              f"has_custom_fields={has_custom_fields}, "
              f"customizableFields={selected_role.get('customizableAttributes') if selected_role else 'N/A'}")
        if not has_custom_fields:
            # Auto-mark player as ready (no attribute form needed)
            await _auto_player_ready(sid, room, room_id)
        # Check readiness (does NOT auto-transition; player_ready handles that)
        await _check_role_select_complete(room_id)


async def _check_role_select_complete(room_id: str):
    """Check role selection progress and broadcast status.
    Actual transition to PLAYING is triggered by _check_all_ready()."""
    room = rooms.get(room_id)
    if not room or room.get("stage") != "ROLE_SELECT":
        return

    players = room.get("players", {})
    assigned = room.get("assignedRoles", {})
    assigned_players = set(assigned.values())
    unassigned = [sid for sid in players if sid not in assigned_players]

    # Broadcast role selection progress
    await sio.emit("role_update", {
        "phase": "progress",
        "assignedCount": len(assigned_players),
        "totalPlayers": len(players),
        "allAssigned": len(unassigned) == 0,
    }, room=room_id)


async def _transition_role_select_to_playing(room_id: str):
    """Transition from ROLE_SELECT to PLAYING — trigger scene image + announce start."""
    room = rooms.get(room_id)
    if not room:
        return

    state = room["state"]
    room["stage"] = "PLAYING"
    state["stage"] = "PLAYING"
    state["_needs_role_select"] = False  # Clear so later graph runs skip opening→END
    state["_role_details"] = []          # Free role details from state

    await _emit_stage_change(room_id, "ROLE_SELECT", "PLAYING")

    script_title = state.get("script_title", "未命名剧本")
    scene_desc = state.get("scene_description", "")
    display_scene_name = state.get("scene", "第一幕")

    # Send game-start announcement
    start_msg = {
        "role": "system",
        "sender": "系统",
        "content": f"🎬 游戏正式开始！{script_title}",
        "timestamp": datetime.now().isoformat(),
    }
    await sio.emit("chat_message", start_msg, room=room_id)
    chat = list(state.get("chat_history", []))
    chat.append(start_msg)
    state["chat_history"] = chat

    # Emit initial scene info (before async image generation)
    await sio.emit("scene_update", {
        "scene": display_scene_name,
        "description": scene_desc,
        "image": None,
    }, room=room_id)

    # Trigger scene image generation for the initial node
    current_node = state.get("current_node", "")
    initial_node_scene = ""
    plot_graph = state.get("plot_graph", {})
    for n in plot_graph.get("nodes", []):
        if isinstance(n, dict) and n.get("id") == current_node:
            nd = n.get("data", {}) if isinstance(n.get("data"), dict) else {}
            initial_node_scene = nd.get("sceneDescription", "")
            break
    if not initial_node_scene:
        initial_node_scene = scene_desc

    if display_scene_name and display_scene_name not in ("大厅", "Lobby", "等待大厅", "灵感征集大厅"):
        asyncio.create_task(_generate_scene_image_for_node(
            room_id, display_scene_name, initial_node_scene, script_title,
            characters_data=state.get("characters_data", [])
        ))

    await _broadcast_room_state(room_id)
    print(f"[GameServer] ⚔️  ROLE_SELECT → PLAYING transition complete: {room_id}")


@sio.event
async def submit_character_sheet(sid: str, data: dict):
    """Submit custom attributes for a character (player-defined stats)."""
    room_id = sid_to_room.get(sid, data.get("roomId", ""))
    room = rooms.get(room_id)
    if not room:
        return

    character_id = data.get("characterId", "")
    attributes = data.get("attributes", {})

    player_info = room["players"].get(sid, {})
    if sid in room["players"]:
        room["players"][sid]["attributes"] = attributes
        room["players"][sid]["characterId"] = character_id

    # Update state
    char_attrs = dict(room["state"].get("character_attributes", {}))
    char_attrs[character_id] = attributes
    room["state"]["character_attributes"] = char_attrs

    await sio.emit("character_update", {
        "playerId": player_info.get("playerId", sid),
        "characterId": character_id,
        "characterName": player_info.get("characterName", ""),
        "attributes": attributes,
        "inventory": player_info.get("inventory", []),
    }, room=room_id)

    # Auto-mark player as ready after submitting character sheet
    await _auto_player_ready(sid, room, room_id)
    await _check_role_select_complete(room_id)


@sio.event
async def player_ready(sid: str, data: dict):
    """Player marks themselves as ready."""
    room_id = sid_to_room.get(sid, data.get("roomId", ""))
    room = rooms.get(room_id)
    if not room or sid not in room.get("players", {}):
        return

    ready = set(room.get("readyPlayers", set()))
    ready.add(sid)
    room["readyPlayers"] = ready
    room["state"]["ready_players"] = ready

    # Check if all ready
    all_ready = len(ready) >= len(room["players"])
    if all_ready and len(room["players"]) > 0:
        await sio.emit("all_ready", {"message": "所有玩家已就绪！"}, room=room_id)
        # If in ROLE_SELECT and all have roles → transition to PLAYING
        if room.get("stage") == "ROLE_SELECT":
            assigned = room.get("assignedRoles", {})
            all_assigned = all(sid in set(assigned.values()) for sid in room["players"])
            if all_assigned:
                await _transition_role_select_to_playing(room_id)

    await _broadcast_room_state(room_id)


async def _auto_player_ready(sid: str, room: dict, room_id: str):
    """Mark a player as ready without requiring an explicit player_ready event."""
    ready = set(room.get("readyPlayers", set()))
    ready.add(sid)
    room["readyPlayers"] = ready
    room["state"]["ready_players"] = ready

    print(f"[GameServer] _auto_player_ready: sid={sid[:8]}..., "
          f"ready={len(ready)}/{len(room['players'])}, stage={room.get('stage')}")

    # Check if all ready after this auto-ready
    all_ready = len(ready) >= len(room["players"])
    if all_ready and len(room["players"]) > 0:
        await sio.emit("all_ready", {"message": "所有玩家已就绪！"}, room=room_id)
        # If in ROLE_SELECT and all have roles → transition to PLAYING
        if room.get("stage") == "ROLE_SELECT":
            assigned = room.get("assignedRoles", {})
            all_assigned = all(sid in set(assigned.values()) for sid in room["players"])
            print(f"[GameServer] _auto_player_ready: all_ready=True, "
                  f"assigned={assigned}, all_assigned={all_assigned}")
            if all_assigned:
                print(f"[GameServer] _auto_player_ready: TRANSITIONING to PLAYING")
                await _transition_role_select_to_playing(room_id)


# ========================================
#  Game Events
# ========================================

@sio.event
async def start_game(sid: str, data: dict):
    """Start the game (owner only)."""
    room_id = sid_to_room.get(sid, data.get("roomId", ""))
    room = rooms.get(room_id)
    if not room:
        return

    if room.get("owner") != sid:
        await sio.emit("join_error", {"message": "只有房主可以开始游戏"}, to=sid)
        return

    if room["stage"] != "LOBBY":
        return

    # Emit stage change
    await _emit_stage_change(room_id, "LOBBY", "GENERATE")

    # Load script data for script/import modes
    if room["mode"] in ("script", "import"):
        editor_json = room.get("editorJson")
        if editor_json:
            from game.utils.script_loader import load_script_data
            script_data = load_script_data(editor_json)
            room["state"].update(script_data)
            room["state"]["script_title"] = editor_json.get("title", "")
            room["state"]["mode"] = room["mode"]
        elif room.get("scriptId"):
            # Load from plaza script file
            script_id = room["scriptId"]
            try:
                from services.file_store import get_script_json
                script_json = get_script_json(script_id)
                if script_json is None:
                    print(f"[GameServer] Script {script_id} not found in file store")
                else:
                    from game.utils.script_loader import load_script_data
                    script_data = load_script_data(script_json)
                    room["state"].update(script_data)
                    room["state"]["script_title"] = script_json.get("title", "")
                    room["state"]["scriptId"] = script_id
                    room["state"]["script_id"] = script_id
                    print(f"[GameServer] Loaded plaza script {script_id} into state, "
                          f"chars={len(script_data.get('characters_data', []))}")
            except Exception as e:
                print(f"[GameServer] Failed to load plaza script {script_id}: {e}")

    # Set worldview/role prefs from room data
    if room["state"].get("suggestions"):
        pass  # already set via submit_preference
    if room.get("worldview"):
        room["state"]["suggestions"] = [room["worldview"]]

    room["state"]["stage"] = "LOBBY"
    room["state"]["owner_sid"] = room.get("owner", "")
    room["state"]["total_rounds"] = room.get("totalRounds", 15)

    # Log initial node for script modes
    if room["mode"] in ("script", "import"):
        current_node = room["state"].get("current_node", "")
        plot_inspection = room["state"].get("plot_inspection", {})
        node_names = plot_inspection.get("node_names", {}) if isinstance(plot_inspection, dict) else {}
        total_nodes = plot_inspection.get("total_nodes", 0) if isinstance(plot_inspection, dict) else 0
        end_checkpoints = room["state"].get("end_checkpoints", [])
        if current_node:
            node_name = node_names.get(current_node, current_node)
            print(f"\n[GameServer] 🎬 剧本模式启动 - 初始节点: [{current_node}] {node_name}")
            print(f"[GameServer]    总节点数: {total_nodes}, 结局节点数: {len(end_checkpoints)}")
            # List all nodes for reference
            if node_names:
                all_nodes = [f"[{nid}]{name}" for nid, name in node_names.items()]
                print(f"[GameServer]    全部节点: {', '.join(all_nodes)}")

    # Invoke LangGraph: lobby → generate/json_load → opening → playing
    room["stage"] = "GENERATE"
    await sio.emit("dm_status", {"status": "主持人正在生成剧本..."}, room=room_id)

    new_state = await _invoke_graph(room, {"_route": "start"})
    room["state"] = new_state

    stage = new_state.get("stage", "")
    if stage not in ("PLAYING", "ROLE_SELECT"):
        # Graph didn't reach a valid stage
        print(f"[GameServer] start_game: unexpected stage={stage}, resetting")
        room["stage"] = "LOBBY"
        await sio.emit("dm_status", {"status": "剧本初始化失败，请重新开始游戏"}, room=room_id)
        await _emit_stage_change(room_id, "GENERATE", "LOBBY")
        await _broadcast_room_state(room_id)
        return

    # ========================================
    #  Read opening_node outputs from state
    # ========================================
    display_scene_name = new_state.get("scene", "第一幕")
    role_details = new_state.get("_role_details", [])
    available_roles = new_state.get("available_roles", [])
    scene_image_prompt = new_state.get("_scene_image_prompt", "")
    opening_pending = new_state.get("_opening_pending", False)
    opening_prompt_data = new_state.get("_opening_prompt_data")
    opening_is_ai = new_state.get("_opening_is_ai", False)
    opening_narration = new_state.get("opening_narration", "")

    # ========================================
    #  Route by stage (authoritative, not hidden flag)
    # ========================================
    if stage == "ROLE_SELECT":
        room["stage"] = "ROLE_SELECT"
        await _emit_stage_change(room_id, "GENERATE", "ROLE_SELECT")

        # Send AI opening narration if available (skip fallback template)
        if opening_is_ai and opening_narration:
            dm_opening_msg = {
                "role": "dm",
                "sender": "DM",
                "content": opening_narration,
                "timestamp": datetime.now().isoformat(),
            }
            await sio.emit("chat_message", dm_opening_msg, room=room_id)
            chat = list(new_state.get("chat_history", []))
            chat.append(dm_opening_msg)
            new_state["chat_history"] = chat

        # Send available roles to all players (immediately, before AI opening)
        print(f"[GameServer] Emitting role_update: availableRoles={available_roles}, "
              f"roleDetails count={len(role_details)}")
        await sio.emit("role_update", {
            "availableRoles": available_roles,
            "roleDetails": role_details,
            "phase": "selecting",
        }, room=room_id)

        # If AI opening was pending (timed out), generate it in background
        # and emit as an updated chat message
        if opening_pending and opening_prompt_data:
            asyncio.create_task(
                _retry_ai_opening_background(
                    room_id, room, new_state, opening_prompt_data
                )
            )

        print(f"[GameServer] ROLE_SELECT phase: {len(available_roles)} roles available, "
              f"{len(room['players'])} players")
    else:
        room["stage"] = "PLAYING"
        await _emit_stage_change(room_id, "GENERATE", "PLAYING")

        # Send AI opening narration if available (skip fallback template)
        if opening_is_ai and opening_narration:
            dm_opening_msg = {
                "role": "dm",
                "sender": "DM",
                "content": opening_narration,
                "timestamp": datetime.now().isoformat(),
            }
            await sio.emit("chat_message", dm_opening_msg, room=room_id)
            chat = list(new_state.get("chat_history", []))
            chat.append(dm_opening_msg)
            new_state["chat_history"] = chat

        # Emit initial scene info immediately (before image is ready)
        scene_desc = new_state.get("scene_description", "")
        await sio.emit("scene_update", {
            "scene": display_scene_name,
            "description": scene_desc,
            "image": None,
        }, room=room_id)

        # Trigger scene image generation
        if display_scene_name and display_scene_name not in ("大厅", "Lobby", "等待大厅", "灵感征集大厅"):
            script_title = new_state.get("script_title", "")
            asyncio.create_task(_generate_scene_image_for_node(
                room_id, display_scene_name, scene_image_prompt, script_title,
                characters_data=new_state.get("characters_data", [])
            ))

    room["state"] = new_state
    await _broadcast_room_state(room_id)

    print(f"[GameServer] Game started in room {room_id}, stage={room['stage']}, "
          f"roles={len(available_roles)}, scene={display_scene_name}")


@sio.event
async def send_message(sid: str, data: dict):
    """Send a player message/action."""
    room_id = sid_to_room.get(sid, data.get("roomId", ""))
    room = rooms.get(room_id)
    if not room:
        return

    if room["stage"] not in ("PLAYING",):
        return

    content = data.get("content", "")
    if not content.strip():
        return

    player = room["players"].get(sid, {})
    nickname = player.get("nickname", "玩家")
    character_id = player.get("characterId", "")
    character_name = nickname

    # Get character name
    for c in room["state"].get("characters_data", []):
        if isinstance(c, dict) and c.get("id") == character_id:
            character_name = c.get("name", nickname)
            break

    # Build message
    msg = {
        "role": "player",
        "sender": character_name,
        "senderSid": sid,
        "characterId": character_id,
        "content": content,
        "timestamp": datetime.now().isoformat(),
    }

    # Append to chat history in state
    chat = list(room["state"].get("chat_history", []))
    chat.append(msg)
    room["state"]["chat_history"] = chat

    print(f"[GameServer] send_message: sid={sid}, sender={character_name}, "
          f"content={content[:80]}, chat_history_len={len(chat)}")

    # Dump full chat history for debugging
    print(f"[GameServer] --- CHAT HISTORY ({len(chat)} msgs) ---")
    for i, m in enumerate(chat):
        if isinstance(m, dict):
            print(f"  [{i}] {m.get('role','?')}/{m.get('sender','?')}: {m.get('content','')[:100]}")
    print(f"[GameServer] --- END CHAT HISTORY ---")

    # Mark player as acted
    acted = set(room["state"].get("players_acted_this_turn", set()))
    acted.add(sid)
    room["state"]["players_acted_this_turn"] = acted

    # Broadcast to all players
    await sio.emit("chat_message", msg, room=room_id)

    # Use DM route
    room["state"]["_route"] = "dm_turn"

    # Invoke graph — tell frontend DM is thinking
    await sio.emit("dm_status", {"thinking": True, "status": "主持人正在翻剧本..."}, room=room_id)

    new_state = await _invoke_graph(room, {})

    # Dump result chat_history for verification
    result_chat = new_state.get("chat_history", [])
    print(f"[GameServer] send_message: graph returned, chat_history now {len(result_chat)} msgs, "
          f"dm_response_len={len(new_state.get('dm_response', ''))}, "
          f"dm_options={new_state.get('dm_options', [])}")
    for i, m in enumerate(result_chat):
        if isinstance(m, dict):
            print(f"  [{i}] {m.get('role','?')}/{m.get('sender','?')}: {m.get('content','')[:100]}")

    # Emit results based on state changes
    await _process_graph_results(room_id, room, new_state)

    # Clear thinking flag after all results are emitted
    await sio.emit("dm_status", {"thinking": False}, room=room_id)


async def _process_graph_results(room_id: str, room: dict, new_state: dict):
    """Process LangGraph output and emit appropriate events."""
    stage = new_state.get("stage", room["stage"])
    if stage != room["stage"]:
        await _emit_stage_change(room_id, room["stage"], stage)
        room["stage"] = stage

    # Node change detection
    prev_node = room["state"].get("current_node", "")
    new_node = new_state.get("current_node", "")
    node_changed = False
    new_node_name = ""
    new_node_scene_desc = ""
    if new_node and new_node != prev_node:
        node_changed = True
        plot_inspection = new_state.get("plot_inspection", {})
        node_names = plot_inspection.get("node_names", {}) if isinstance(plot_inspection, dict) else {}
        old_name = node_names.get(prev_node, prev_node) if prev_node else "起始"
        new_node_name = node_names.get(new_node, new_node)
        node_history = new_state.get("node_history", [])
        nh_names = [node_names.get(n, n) for n in node_history]
        print(f"[GameServer] 🌿 节点变更已确认: {old_name} → {new_node_name}  "
              f"(路径: {' → '.join(nh_names)})")

        # Extract scene description from the new node's data for image generation
        plot_graph = new_state.get("plot_graph", {})
        for n in plot_graph.get("nodes", []):
            if isinstance(n, dict) and n.get("id") == new_node:
                nd = n.get("data", {}) if isinstance(n.get("data"), dict) else {}
                new_node_scene_desc = nd.get("sceneDescription", "")
                break

        await sio.emit("node_changed", {
            "previousNodeId": prev_node,
            "previousNodeName": old_name,
            "currentNodeId": new_node,
            "currentNodeName": new_node_name,
            "nodeHistory": node_history,
            "timestamp": datetime.now().isoformat(),
        }, room=room_id)

        # Spawn async scene image generation for the new node
        if new_node_scene_desc:
            script_title = room.get("scriptTitle", "")
            room_state = room.get("state", {})
            asyncio.create_task(_generate_scene_image_for_node(
                room_id, new_node_name, new_node_scene_desc, script_title,
                characters_data=room_state.get("characters_data", [])
            ))

    # Dice result — emit BEFORE DM response so frontend enters "processing check" state first
    dice_result = new_state.get("dice_result")
    if dice_result:
        await sio.emit("dice_roll", {
            "result": dice_result,
            "timestamp": datetime.now().isoformat(),
        }, room=room_id)
        room["state"]["dice_result"] = None  # consumed

    # DM response + options (options hidden by frontend until dmThinking clears)
    dm_resp = new_state.get("dm_response", "")
    dm_options = new_state.get("dm_options", [])
    if dm_resp:
        print(f"[GameServer] _process_graph_results: emitting dm_response "
              f"({len(dm_resp)} chars, options={len(dm_options)}): {dm_resp[:120]}...")
        await sio.emit("chat_message", {
            "role": "dm",
            "sender": "DM",
            "content": dm_resp,
            "options": dm_options if dm_options else None,
            "timestamp": datetime.now().isoformat(),
        }, room=room_id)

    # Private messages
    private_msgs = new_state.get("private_messages", {})
    for target_sid, pmsg in private_msgs.items():
        await sio.emit("private_message", {
            "content": pmsg,
            "timestamp": datetime.now().isoformat(),
        }, to=target_sid)

    # Scene update
    scene_desc = new_state.get("scene_description", "")
    scene_image = new_state.get("scene_image")
    if scene_desc or scene_image:
        await sio.emit("scene_update", {
            "scene": new_state.get("scene", ""),
            "description": scene_desc,
            "image": scene_image,
        }, room=room_id)

    # Character state updates
    char_attrs = new_state.get("character_attributes", {})
    if char_attrs:
        # Resolve characterId→player_sid mapping from assignedRoles
        assigned_roles = room.get("assignedRoles", {})
        char_to_player = {cid: psid for cid, psid in assigned_roles.items()}
        for cid, attrs in char_attrs.items():
            player_sid = char_to_player.get(cid, "")
            player_info = room["players"].get(player_sid, {}) if player_sid else {}
            await sio.emit("character_update", {
                "playerId": player_info.get("playerId", player_sid),
                "characterId": cid,
                "characterName": player_info.get("characterName", ""),
                "attributes": attrs,
                "inventory": player_info.get("inventory", []),
            }, room=room_id)

    # Ending
    ending_data = new_state.get("ending_data")
    if ending_data or new_state.get("ending_reached"):
        await sio.emit("ending_card", {
            "data": ending_data or {"narration": "故事结束了..."},
            "timestamp": datetime.now().isoformat(),
        }, room=room_id)
        room["stage"] = "ENDING"

    # New round started
    turn_number = new_state.get("turn_number", 1)
    turn_timeout = new_state.get("turn_timeout_seconds", 120)
    await sio.emit("turn_start", {
        "turnNumber": turn_number,
        "timeoutSeconds": turn_timeout,
        "timestamp": datetime.now().isoformat(),
    }, room=room_id)

    # Reset turn tracking
    room["state"]["players_acted_this_turn"] = set()
    room["state"]["players_skipped_this_turn"] = set()
    room["state"]["turn_started_at"] = datetime.now().timestamp()


@sio.event
async def dm_option_select(sid: str, data: dict):
    """Player selects a DM-provided option."""
    option = data.get("option", "")
    if option:
        # Treat as regular message
        await send_message(sid, {
            "roomId": data.get("roomId", ""),
            "content": f"[选择] {option}",
        })


@sio.event
async def turn_skip(sid: str, data: dict):
    """Player skips this turn."""
    room_id = sid_to_room.get(sid, data.get("roomId", ""))
    room = rooms.get(room_id)
    if not room:
        return

    skipped = set(room["state"].get("players_skipped_this_turn", set()))
    skipped.add(sid)
    room["state"]["players_skipped_this_turn"] = skipped

    await sio.emit("turn_skip", {
        "sid": sid,
        "nickname": room["players"].get(sid, {}).get("nickname", "玩家"),
    }, room=room_id)


@sio.event
async def extend_turn(sid: str, data: dict):
    """Owner extends the current turn time."""
    room_id = sid_to_room.get(sid, data.get("roomId", ""))
    room = rooms.get(room_id)
    if not room or room.get("owner") != sid:
        return

    current_timeout = room["state"].get("turn_timeout_seconds", 120)
    new_timeout = current_timeout + 30
    room["state"]["turn_timeout_seconds"] = new_timeout

    await sio.emit("turn_start", {
        "extended": True,
        "timeoutSeconds": new_timeout,
    }, room=room_id)


# ========================================
#  AI Opening Narration — Background Retry
# ========================================
async def _retry_ai_opening_background(
    room_id: str,
    room: dict,
    new_state: dict,
    prompt_data: dict,
):
    """Generate AI opening narration in background and emit as updated chat."""
    try:
        from game.nodes.opening_node import _generate_ai_opening
        ai_text = await _generate_ai_opening(**prompt_data)

        if ai_text and ai_text != new_state.get("opening_narration", ""):
            # Update state with better AI opening
            new_state["opening_narration"] = ai_text
            new_state["_opening_is_ai"] = True
            room["state"] = new_state

            # Send as DM narration to all players
            await sio.emit("chat_message", {
                "role": "dm",
                "sender": "DM",
                "content": ai_text,
                "timestamp": datetime.now().isoformat(),
            }, room=room_id)
            print(f"[GameServer] Background AI opening generated: {len(ai_text)} chars")
    except Exception as e:
        print(f"[GameServer] Background AI opening failed: {e}")


# ========================================
#  Scene Image Generation (from BUMENGweb-main)
# ========================================

async def _generate_scene_image_for_node(
    room_id: str,
    scene_name: str,
    scene_description: str,
    script_title: str = "",
    characters_data: Optional[List[dict]] = None,
):
    """
    Async background task: generate a scene image via Qwen,
    cache it, and emit to frontend via image_message event.
    """
    if not scene_name or not scene_description:
        return

    # Skip lobby-like scenes
    if scene_name in ("灵感征集大厅", "大厅", "Lobby", "等待大厅"):
        print(f"🎨 [Scene] 跳过非游戏场景的图片生成: {scene_name}")
        return

    # Wait 2s so players read the text first (from BUMENGweb-main behavior)
    await asyncio.sleep(2)

    try:
        from services.image_service import (
            generate_image_url_async,
            get_cached_scene_base64, scene_cache_exists,
            download_and_cache, scene_cache_path,
            cached_file_base64, get_character_visual,
            build_character_visual_desc,
            url_to_base64, _url_to_base64_sync,
        )

        # 1. Try cache first
        if scene_cache_exists(scene_name):
            result_b64 = get_cached_scene_base64(scene_name)
            if result_b64:
                print(f"📦 [Scene] 使用缓存的场景图: {scene_name}")
                await sio.emit("image_message", {
                    "url": result_b64,
                    "label": f"场景图: {scene_name}",
                }, room=room_id)
                return

        # 2. Build prompt
        desc_text = scene_description[:300]
        prompt = (
            f"请严格按照以下描述生成场景画面，必须与描述内容完全一致："
            f"地点「{scene_name}」。画面内容：{desc_text}。"
        )

        # Try to include character visuals for all available characters
        scenario = script_title[:50] if script_title else "default"
        char_visuals = []
        if characters_data:
            for c in characters_data[:4]:  # max 4 characters
                if isinstance(c, dict):
                    cname = c.get("name", "")
                    if not cname:
                        continue
                    # Try cached visual first, then build from character data
                    cached = get_character_visual(cname, scenario) or get_character_visual(cname, "default")
                    if cached:
                        char_visuals.append(f"{cname}：{cached}")
                    else:
                        appearance = c.get("appearance", "")
                        identity = c.get("identity", "")
                        desc = c.get("description", "")
                        if appearance:
                            visual = f"{cname}（外貌：{appearance[:120]}）"
                            char_visuals.append(visual)
                        elif identity or desc:
                            visual = build_character_visual_desc(cname, identity or "", desc or "")
                            char_visuals.append(visual)
        else:
            # Fallback: try all cached character visuals
            for try_name in ("林墨", "白旭尧", "陈秋萍"):
                cached = get_character_visual(try_name, scenario) or get_character_visual(try_name, "default")
                if cached:
                    char_visuals.append(f"{try_name}：{cached}")
                    break  # one is enough for fallback

        if char_visuals:
            prompt += f" 场景中出现角色：" + "；".join(char_visuals[:3]) + "。"

        prompt += " 风格为角色扮演游戏，写实风格，电影感，细节丰富，4K画质。"

        print(f"🎨 [Scene] 开始生成场景图片: scene={scene_name}, desc={desc_text[:80]}...")

        # 3. Generate image URL via Qwen
        image_url = await generate_image_url_async(prompt)

        if not image_url:
            print(f"⚠️ [Scene] 场景图片生成返回空URL: {scene_name}")
            return

        print(f"✅ [Scene] 场景图片URL生成成功: {image_url[:100]}...")

        # 4. Download → base64 → cache
        cache_path = scene_cache_path(scene_name)
        if download_and_cache(image_url, cache_path):
            result_b64 = cached_file_base64(cache_path)
            if result_b64:
                await sio.emit("image_message", {
                    "url": result_b64,
                    "label": f"场景图: {scene_name}",
                }, room=room_id)
                print(f"📤 [Scene] 场景图片已发送: {scene_name}")
                return

        # 5. Fallback: direct base64 conversion
        result_b64 = await url_to_base64(image_url)
        if not result_b64:
            result_b64 = await asyncio.to_thread(_url_to_base64_sync, image_url)

        if result_b64:
            # Save to cache manually
            try:
                import base64 as _b64
                image_data = _b64.b64decode(result_b64.split(",", 1)[-1])
                with open(cache_path, "wb") as f:
                    f.write(image_data)
            except Exception:
                pass

            await sio.emit("image_message", {
                "url": result_b64,
                "label": f"场景图: {scene_name}",
            }, room=room_id)
            print(f"📤 [Scene] 场景图片已发送(备用路径): {scene_name}")
        else:
            print(f"⚠️ [Scene] base64 转换失败，跳过场景图: {scene_name}")

    except Exception as e:
        print(f"❌ [Scene] 场景图片生成异常: {e}")
        import traceback
        traceback.print_exc()


# ========================================
#  ASGI App Factory
# ========================================

def create_socketio_app():
    """Create the Socket.IO ASGI app for FastAPI mounting."""
    return socketio.ASGIApp(sio, socketio_path="/socket.io")
