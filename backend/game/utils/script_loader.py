"""
Script loader — parses editor/plaza JSON into structured game data.
Migrated from BUMENGweb-main game_flow.py start_festival_game() and
the export.ts mapping table.
"""

from typing import Dict, Any, List, Optional

# Placeholder values that indicate the user hasn't set a real name yet
_NAME_PLACEHOLDERS = {"新物品", "新地点", "新位置", "未命名地点", "未命名"}


def _resolve_name(data: dict, node: dict) -> str:
    """Resolve the real entity name, treating placeholder data.name as empty."""
    data_name = data.get("name", "")
    label = node.get("label", "")
    if data_name.strip() and data_name not in _NAME_PLACEHOLDERS:
        return data_name
    if label.strip() and label not in _NAME_PLACEHOLDERS:
        return label
    return data_name or label


def load_script_data(script_json: dict) -> dict:
    """
    Parse a ScriptPlatform project/editor JSON into structured game state data.
    Handles both editor format (ProjectData) and plaza format.
    """
    result = {
        "script_title": "",
        "world_setting": [],
        "dm_notes": "",
        "characters_data": [],
        "locations_data": [],
        "items_data": [],
        "plot_graph": {"nodes": [], "edges": []},
        "mechanics_checks": [],
        "mechanics_votes": [],
        "character_attributes": {},
        "plot_inspection": {},
        "initial_checkpoint": "",
        "end_checkpoints": [],
        "opening_scene": "",
    }

    # Title
    result["script_title"] = script_json.get("title", "") or script_json.get("projectId", "")

    # World setting
    world = script_json.get("worldSetting", [])
    if isinstance(world, list):
        result["world_setting"] = world
        # Extract opening scene from first world block
        for block in world:
            if isinstance(block, dict):
                content = block.get("content", "")
                if content:
                    # Use first meaningful block as opening scene description
                    result["opening_scene"] = content[:500]
                    break

    # DM Notes — editor module "主持人笔记" (between worldSetting and characters)
    dm_notes = script_json.get("dmNotes", "")
    result["dm_notes"] = dm_notes

    # BGM — background music filename
    bgm = script_json.get("bgm", "")
    result["bgm"] = bgm
    # print(f"[ScriptLoader] BGM loaded: '{bgm}' (empty={not bgm})")
    if dm_notes:
        result["dm_notes"] = dm_notes

    # Characters
    characters_graph = script_json.get("characters", {})
    if isinstance(characters_graph, dict):
        nodes = characters_graph.get("nodes", [])
        result["characters_data"] = [_parse_character_node(n) for n in nodes]
        edges = characters_graph.get("edges", [])
        result["_character_edges"] = edges

    # Initialize character attributes
    char_params = script_json.get("characterParams", [])
    for char in result["characters_data"]:
        char_id = char.get("id", "")
        attrs = {}
        for param in char_params:
            if isinstance(param, dict):
                pname = param.get("name", "").strip()
                ptype = param.get("paramType", "number")
                if ptype == "number":
                    min_v = param.get("minValue", 0)
                    max_v = param.get("maxValue", 10)
                    # Default to midpoint rounded up
                    attrs[pname] = int((min_v + max_v) / 2 + 0.5)
                elif ptype == "category":
                    cats = param.get("categories", [])
                    attrs[pname] = cats[0] if cats else ""
        # ⚠️ Also merge each character's own attributes (from worldParams parsed
        #    by _parse_character_node). worldParams are per-character manual
        #    settings and should OVERRIDE the generic midpoint defaults.
        for k, v in char.get("attributes", {}).items():
            attrs[k.strip()] = v
        result["character_attributes"][char_id] = attrs

    # Locations
    loc_graph = script_json.get("locations", {})
    if isinstance(loc_graph, dict):
        nodes = loc_graph.get("nodes", [])
        result["locations_data"] = [_parse_location_node(n) for n in nodes]

    # Items
    items_graph = script_json.get("items", {})
    if isinstance(items_graph, dict):
        nodes = items_graph.get("nodes", [])
        result["items_data"] = [_parse_item_node(n) for n in nodes]

    # Plot graph
    plot = script_json.get("plot", {})
    if isinstance(plot, dict):
        result["plot_graph"] = plot.get("graph", {"nodes": [], "edges": []})
        result["initial_checkpoint"] = plot.get("initialCheckpoint", "")
        result["end_checkpoints"] = plot.get("endCheckpoints", [])

        # Build plot inspection from plot data
        result["plot_inspection"] = _build_plot_inspection(plot)

    # Mechanics
    mechanics = script_json.get("mechanics", {})
    if isinstance(mechanics, dict):
        result["mechanics_checks"] = mechanics.get("checks", [])
        result["mechanics_votes"] = mechanics.get("votes", [])

    return result


def _parse_character_node(node: dict) -> dict:
    """Parse a character node from editor format."""
    data = node.get("data", {})
    char = {
        "id": node.get("id", ""),
        "label": node.get("label", data.get("name", "")),
        "name": data.get("name", node.get("label", "")),
        "description": data.get("description", ""),
        "appearance": data.get("appearance", ""),
        "identity": data.get("identity", ""),
        "personality": data.get("personality", ""),
        "motivation": data.get("motivation", ""),
        "is_playable": data.get("isPlayable", False),  # default False: only explicitly marked characters are playable
        "min_players": data.get("minPlayers", 0),
        "max_players": data.get("maxPlayers", 1),
        "customizable_attributes": data.get("customizableFields", []),
        "attribute_constraints": data.get("numericAttributeCap"),
        "attributes": {},
    }
    # World params as attributes
    world_params = data.get("worldParams", {})
    if isinstance(world_params, dict):
        for k, v in world_params.items():
            char["attributes"][k] = v
    return char


def _parse_location_node(node: dict) -> dict:
    """Parse a location node from editor format."""
    data = node.get("data", {})
    return {
        "id": node.get("id", ""),
        "label": node.get("label", ""),
        "name": _resolve_name(data, node),
        "description": data.get("description", ""),
        "atmosphere": data.get("atmosphere", ""),
        "terrain": data.get("terrain", ""),
        "locationType": data.get("locationType", ""),
        "sceneDescription": data.get("sceneDescription", ""),
    }


def _parse_item_node(node: dict) -> dict:
    """Parse an item node from editor format."""
    data = node.get("data", {})
    return {
        "id": node.get("id", ""),
        "label": node.get("label", ""),
        "name": _resolve_name(data, node),
        "description": data.get("description", ""),
        "type": data.get("type", ""),
        "effects": data.get("effects", ""),
        "function": data.get("function", ""),
        "appearance": data.get("appearance", ""),
        "acquisitionMethod": data.get("acquisitionMethod", ""),
        "conditions": data.get("conditions", []),
        "properties": data.get("properties", {}),
        "unique": data.get("unique", False),
        "initialLocation": data.get("initialLocation", ""),
    }


def _build_plot_inspection(plot: dict) -> dict:
    """Build DM plot inspection notes from the plot data."""
    graph = plot.get("graph", {})
    nodes = graph.get("nodes", []) if isinstance(graph, dict) else []
    edges = graph.get("edges", []) if isinstance(graph, dict) else []

    # Count nodes
    total_nodes = len(nodes)
    initial = plot.get("initialCheckpoint", "")
    endings = plot.get("endCheckpoints", [])

    # Build node paths
    node_names = {}
    node_labels = {}  # id → label (display name)
    for n in nodes:
        if isinstance(n, dict):
            nid = n.get("id", "")
            label = n.get("label", "") or n.get("data", {}).get("title", "")
            node_names[nid] = label or nid
            node_labels[nid] = label or nid

    # label → id reverse lookup (for DM-friendly label-based navigation)
    label_to_id = {}
    for nid, label in node_labels.items():
        if label:
            label_to_id[label] = nid

    # Build edge connections with labels (source → [{target, label/trigger}])
    connections = {}
    for e in edges:
        if isinstance(e, dict):
            src = e.get("source", "")
            tgt = e.get("target", "")
            label = e.get("label", "") or e.get("data", {}).get("trigger", "")
            if src not in connections:
                connections[src] = []
            connections[src].append({"target": tgt, "label": label})

    inspection = {
        "total_nodes": total_nodes,
        "initial_checkpoint": initial,
        "end_checkpoints": endings,
        "node_names": node_names,
        "node_labels": node_labels,
        "label_to_id": label_to_id,
        "connections": connections,
        "dm_notes": f"共{total_nodes}个剧情节点，起始于'{node_names.get(initial, initial)}'，"
                    f"{len(endings)}个结局。根据玩家行动在节点间推进。",
    }

    return inspection


def get_node_advancement_info(current_node: str, plot_graph: dict,
                               plot_inspection: dict) -> dict:
    """
    Build structured info about the current node and available next nodes.
    Returns a dict with:
      - current_node_id, current_node_name
      - current_node_data: the current node's full data dict
      - next_nodes: [{id, name, trigger_label, potential_actions, scene_desc, trigger_conditions}]
      - is_ending: bool
    """
    node_names = plot_inspection.get("node_names", {})
    connections = plot_inspection.get("connections", {})
    end_checkpoints = plot_inspection.get("end_checkpoints", [])
    label_to_id = plot_inspection.get("label_to_id", {})

    # ── 防御性解析：current_node 可能是 label 或含 ｜ 的名称 ──
    resolved_cn = current_node
    if current_node and current_node not in node_names and current_node not in connections:
        # 尝试 ｜ 切割
        if '｜' in current_node:
            prefix = current_node.split('｜')[0].strip()
            resolved_cn = label_to_id.get(prefix, resolved_cn)
        # 纯 label 解析
        resolved_cn = label_to_id.get(current_node, resolved_cn)

    current_name = node_names.get(resolved_cn, current_node or "(未命名)")
    is_ending = resolved_cn in end_checkpoints if resolved_cn else False

    # Build node data lookup from plot_graph nodes
    nodes_data = {}
    for n in plot_graph.get("nodes", []):
        if isinstance(n, dict):
            nid = n.get("id", "")
            nodes_data[nid] = n.get("data", {}) if isinstance(n.get("data"), dict) else {}

    # Collect valid next nodes with rich info from target node data
    next_nodes = []
    raw_nexts = connections.get(resolved_cn, [])
    for item in raw_nexts:
        tgt = item.get("target", "") if isinstance(item, dict) else item
        edge_label = item.get("label", "") if isinstance(item, dict) else ""
        tgt_data = nodes_data.get(tgt, {})
        next_nodes.append({
            "id": tgt,
            "name": node_names.get(tgt, tgt),
            "trigger_label": edge_label,
            "potential_actions": tgt_data.get("potentialActions", {}),
            "trigger_conditions": tgt_data.get("triggerConditions", []),
            "scene_desc": tgt_data.get("sceneDescription", "")[:120],
            "dm_note": tgt_data.get("description", "")[:200],
        })

    return {
        "current_node_id": resolved_cn or current_node,
        "current_node_name": current_name,
        "current_node_data": nodes_data.get(resolved_cn, {}),
        "next_nodes": next_nodes,
        "is_ending": is_ending,
    }


def validate_node_transition(current_node: str, target_node: str,
                              plot_graph: dict, plot_inspection: dict) -> bool:
    """
    Check whether target_node is a valid next node from current_node.
    Accepts both UUID and label; labels are resolved to UUID internally.
    Returns True if:
      - current_node is empty (first transition, target can be anything)
      - target_node is in the connections list from current_node
      - target_node exists as a node in the graph AND current_node has no outgoing edges
        (allowing DM free navigation within the node set when no edges defined)
    """
    node_names = plot_inspection.get("node_names", {})
    label_to_id = plot_inspection.get("label_to_id", {})

    # Resolve labels → UUIDs (for DM-friendly label-based navigation)
    # Also handle ｜-separated names (AI sometimes appends scene descriptions)
    if current_node and current_node not in node_names:
        resolved = label_to_id.get(current_node, "")
        if not resolved and '｜' in current_node:
            prefix = current_node.split('｜')[0].strip()
            resolved = label_to_id.get(prefix, "")
        if resolved:
            current_node = resolved
    if target_node and target_node not in node_names:
        resolved = label_to_id.get(target_node, "")
        if not resolved and '｜' in target_node:
            prefix = target_node.split('｜')[0].strip()
            resolved = label_to_id.get(prefix, "")
        if resolved:
            target_node = resolved

    if not current_node:
        # First transition — accept any valid target
        return bool(target_node)

    connections = plot_inspection.get("connections", {})

    valid_targets = connections.get(current_node, [])
    valid_target_ids = set()
    for item in valid_targets:
        if isinstance(item, dict):
            valid_target_ids.add(item.get("target", ""))
        elif isinstance(item, str):
            valid_target_ids.add(item)

    if target_node in valid_target_ids:
        return True

    # Fallback: if current node has no outgoing edges, allow any node in the graph
    if not valid_target_ids and target_node in node_names:
        return True

    return False


def extract_playable_roles(characters_data: List[dict]) -> List[str]:
    """Extract list of playable character IDs from character data."""
    roles = []
    for char in characters_data:
        if isinstance(char, dict) and char.get("is_playable"):
            roles.append(char.get("id", ""))
    return roles
