"""
json_load_node — JSON_LOAD stage (script/import mode).
Loads script data from editor JSON or plaza script JSON.
Migrated from BUMENGweb-main game_flow.py start_festival_game().
"""

import json
import os
from typing import Dict, Any, Optional

from game.state import GameState
from game.utils.script_loader import load_script_data, extract_playable_roles


async def json_load_node(state: GameState) -> Dict[str, Any]:
    """
    Load a preset script JSON into the game state.
    Handles three sources:
    1. editorJson — from editor trial play (already a dict)
    2. scriptId — from plaza (load from file)
    3. import mode — editorJson from upload
    4. Pre-loaded state data — already populated by start_game()
    """
    mode = state.get("mode", "script")
    script_json: Optional[dict] = None

    # Source 1 & 3: editorJson
    editor_json = state.get("editorJson")
    if editor_json:
        script_json = editor_json

    # Source 2: scriptId from plaza
    if not script_json:
        script_id = state.get("scriptId") or state.get("script_id")
        if script_id:
            try:
                from services.file_store import get_script_json
                script_json = get_script_json(script_id)
            except Exception as e:
                print(f"[json_load_node] Failed to load script {script_id}: {e}")

    # Source 4: Data already loaded into state by start_game()
    if not script_json:
        # Check if characters/locations already exist in state
        chars = state.get("characters_data", [])
        locs = state.get("locations_data", [])
        if chars or locs:
            print(f"[json_load_node] Using pre-loaded state data "
                  f"({len(chars)} chars, {len(locs)} locations)")
            # Build opening scene from pre-loaded data (only if not already set)
            if not state.get("scene_description"):
                opening = ""
                inspection = state.get("plot_inspection", {})
                if isinstance(inspection, dict):
                    opening = inspection.get("initial_scene", "")
                if not opening:
                    world_setting = state.get("world_setting", [])
                    for block in world_setting:
                        if isinstance(block, dict) and block.get("content"):
                            opening = block["content"][:500]
                            break
                if not opening:
                    opening = state.get("opening_scene", "故事开始了...")
                if not opening or not opening.strip():
                    opening = "故事即将开始..."
            else:
                opening = state.get("scene_description", "")

            updates: Dict[str, Any] = {}
            current_stage = state.get("stage", "")
            # Only escalate stage if still in generation phase
            if current_stage in ("", "LOBBY", "GENERATE"):
                updates["stage"] = "OPENING"
            # Only set current_round on first run (when it's 0)
            if state.get("current_round", 0) == 0:
                updates["current_round"] = 1
                updates["turn_number"] = 1
            if opening and opening != state.get("scene_description", ""):
                updates["scene_description"] = opening
            if not state.get("available_roles"):
                updates["available_roles"] = [
                    c.get("id", "") for c in chars
                    if isinstance(c, dict) and c.get("is_playable", False)
                ]
                print(f"[json_load_node] Computed available_roles={updates['available_roles']}")
            # Propagate current_node from initial_checkpoint (loaded by game_server)
            if not state.get("current_node"):
                ic = state.get("initial_checkpoint", "")
                if ic:
                    updates["current_node"] = ic
            print(f"[json_load_node] Pre-loaded pass-through: "
                  f"current_round={state.get('current_round', 0)}, "
                  f"current_node={updates.get('current_node', state.get('current_node', ''))}, "
                  f"keeping runtime state")
            return updates

    if not script_json:
        # Fallback: minimal script
        print("[json_load_node] No script data found, using fallback")
        script_json = _get_fallback_script()

    # If game is already beyond the generation phase (stage is not LOBBY/GENERATE),
    # skip reloading to preserve runtime state like current_round and chat_history.
    stage = state.get("stage", "")
    if stage not in ("", "LOBBY", "GENERATE") and (
        state.get("characters_data") or state.get("locations_data")
    ):
        print(f"[json_load_node] Stage already beyond generate, "
              f"skipping reload (stage={stage}, current_round={state.get('current_round')})")
        return {}

    # Load structured data from JSON
    data = load_script_data(script_json)

    # Build state updates (stage will be set by opening_node)
    updates: Dict[str, Any] = {
        "stage": "OPENING",
        "script_title": data.get("script_title", "预设剧本"),
        "world_setting": data.get("world_setting", []),
        "dm_notes": data.get("dm_notes", ""),
        "characters_data": data.get("characters_data", []),
        "locations_data": data.get("locations_data", []),
        "items_data": data.get("items_data", []),
        "plot_graph": data.get("plot_graph", {"nodes": [], "edges": []}),
        "mechanics_checks": data.get("mechanics_checks", []),
        "mechanics_votes": data.get("mechanics_votes", []),
        "character_attributes": data.get("character_attributes", {}),
        "plot_inspection": data.get("plot_inspection", {}),
        "current_node": data.get("initial_checkpoint", ""),
        "node_history": [],
        "scene_description": data.get("opening_scene", "故事开始了..."),
        "current_round": 1,
        "turn_number": 1,
        "bgm": data.get("bgm", ""),
    }

    # Extract playable roles
    roles = extract_playable_roles(data.get("characters_data", []))
    updates["available_roles"] = roles

    return updates


def _get_fallback_script() -> dict:
    """Minimal fallback script."""
    return {
        "title": "预设剧本",
        "worldSetting": [],
        "characters": {
            "nodes": [
                {
                    "id": "c1", "data": {
                        "name": "主角", "description": "冒险者",
                        "isPlayable": True, "minPlayers": 1, "maxPlayers": 1,
                    }
                }
            ],
            "edges": [],
        },
        "locations": {"nodes": [], "edges": []},
        "items": {"nodes": [], "edges": []},
        "plot": {
            "initialCheckpoint": "",
            "endCheckpoints": [],
            "graph": {"nodes": [], "edges": []},
        },
        "mechanics": {"checks": [], "votes": []},
    }
