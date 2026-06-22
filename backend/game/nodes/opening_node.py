"""
opening_node — OPENING stage.
Centralized pre-PLAYING processing:
  1. AI-generated DM opening narration (based on script + characters + plot)
  2. Resolve display scene name
  3. Role assignment (single-player auto-assign)
  4. Scene image generation trigger flag
  5. Stage transition: ROLE_SELECT (multi-player) or PLAYING (single/no roles)

This node runs AFTER generate_node or json_load_node and BEFORE playing_node.
"""
import hashlib
from datetime import datetime
from typing import Dict, Any, List, Optional

from game.state import GameState


async def opening_node(state: GameState) -> Dict[str, Any]:
    """
    Orchestrate the game opening:
    - Generate AI narration
    - Resolve scene name
    - Auto-assign roles for single-player
    - Set stage to ROLE_SELECT or PLAYING
    """
    # Guard: skip if already handled
    stage = state.get("stage", "")
    if stage in ("PLAYING", "ROLE_SELECT", "ENDING"):
        if state.get("opening_narration"):
            print(f"[opening_node] Already processed (stage={stage}), skipping")
            return {}
        elif stage == "PLAYING":
            # PLAYING without opening_narration — generate minimal opening
            pass
        else:
            return {}

    print(f"[opening_node] === Generating opening ===")

    script_title = state.get("script_title", "未命名剧本")
    world_setting = state.get("world_setting", [])
    characters_data = state.get("characters_data", [])
    locations_data = state.get("locations_data", [])
    items_data = state.get("items_data", [])
    plot_inspection = state.get("plot_inspection", {})
    plot_graph = state.get("plot_graph", {})
    current_node_id = state.get("current_node", "")
    available_roles = list(state.get("available_roles", []))
    raw_scene_desc = state.get("scene_description", "")

    updates: Dict[str, Any] = {}

    # ========================================
    #  1. Resolve display scene name
    # ========================================
    display_scene_name = _resolve_scene_name(
        current_node_id, plot_graph, plot_inspection, locations_data
    )

    # ========================================
    #  2. Build role details
    # ========================================
    role_details = _build_role_details(available_roles, characters_data)

    # ========================================
    #  3. Handle role selection / stage decision FIRST (fast, no AI)
    # ========================================
    has_roles = len(available_roles) > 0

    if has_roles:
        updates["stage"] = "ROLE_SELECT"
        updates["_needs_role_select"] = True
        updates["_role_details"] = role_details
    else:
        updates["stage"] = "PLAYING"
        updates["_needs_role_select"] = False
        updates["_role_details"] = []

    # ========================================
    #  4. AI opening narration — attempt async, but don't block stage transition.
    #     If AI takes too long (>2s), defer to background via _opening_pending flag.
    #     Fallback text is always ready immediately.
    # ========================================
    world_summary = _summarize_world(world_setting)
    char_summary = _summarize_characters(characters_data)
    player_identity = _summarize_player_identities(characters_data)
    loc_summary = _summarize_locations(locations_data)

    # Build plot context
    plot_context = ""
    # ── Preset DM notes (from editor "主持人笔记" module, highest priority) ──
    preset_dm_notes = state.get("dm_notes", "")
    if preset_dm_notes:
        plot_context += f"**【预设主持人笔记】**：{preset_dm_notes[:300]}\n"
    if isinstance(plot_inspection, dict):
        story_goal = plot_inspection.get("story_goal", "")
        dm_notes = plot_inspection.get("dm_notes", "")
        if story_goal:
            plot_context += f"故事目标：{story_goal}\n"
        if dm_notes:
            plot_context += f"DM备注（自动摘要）：{dm_notes[:200]}\n"

    # ── Extract initial checkpoint node rich data ──
    initial_node_context = _build_initial_node_context(
        current_node_id, plot_graph, locations_data, characters_data, items_data
    )

    # ── Build story overview (full plot tree) for DM context ──
    story_overview = _build_story_overview(plot_graph, plot_inspection)

    fallback_text = _build_fallback_opening(
        script_title, world_summary, display_scene_name, raw_scene_desc
    )

    # AI generation is always deferred to background (async fire-and-forget).
    # This way the player gets the role selection screen immediately,
    # and the AI narration arrives as soon as it's ready — no waiting.
    opening_text = fallback_text
    opening_options: list = []
    opening_pending = True if has_roles else False
    world_summary_gen = ""
    plot_summary_gen = ""
    print(f"[opening_node] AI generation deferred to background "
          f"(has_roles={has_roles}, pending={opening_pending})")

    updates["scene"] = display_scene_name
    updates["scene_description"] = raw_scene_desc or opening_text
    updates["opening_narration"] = opening_text
    updates["opening_options"] = opening_options
    updates["world_summary"] = world_summary_gen
    updates["plot_summary"] = plot_summary_gen
    updates["_opening_pending"] = opening_pending
    updates["_opening_is_ai"] = not opening_pending  # True if AI successfully generated
    updates["_opening_prompt_data"] = {
        "script_title": script_title,
        "world_summary": world_summary,
        "char_summary": char_summary,
        "player_identity": player_identity,
        "loc_summary": loc_summary,
        "plot_context": plot_context,
        "scene_name": display_scene_name,
        "raw_scene_desc": raw_scene_desc,
        "initial_node_context": initial_node_context,
        "story_overview": story_overview,
    }  # always stored — background AI task reads this
    updates["_scene_image_prompt"] = _build_image_prompt(
        display_scene_name, raw_scene_desc, script_title, plot_graph,
        current_node_id, characters_data, locations_data
    )

    print(f"[opening_node] Done: stage={updates['stage']}, "
          f"_needs_role_select={updates.get('_needs_role_select')}, "
          f"_role_details count={len(updates.get('_role_details', []))}, "
          f"narration={len(opening_text or '')} chars (pending_ai={opening_pending}), "
          f"roles={len(available_roles)}, "
          f"scene={display_scene_name}")

    return updates


# ========================================
#  Helper functions
# ========================================

def _resolve_scene_name(
    current_node_id: str,
    plot_graph: dict,
    plot_inspection: dict,
    locations_data: list,
) -> str:
    """Resolve the display scene name from plot graph or locations."""
    # Try plot_inspection.node_names (UUID → label)
    if current_node_id and isinstance(plot_inspection, dict):
        node_names = plot_inspection.get("node_names", {})
        name = node_names.get(current_node_id, "")
        if name:
            return name
        # Try label→id reverse lookup (current_node might be a label)
        label_to_id = plot_inspection.get("label_to_id", {})
        resolved_id = label_to_id.get(current_node_id, "")
        if resolved_id:
            name = node_names.get(resolved_id, "")
            if name:
                return name

    # Try plot graph node data (label field)
    if current_node_id:
        for n in plot_graph.get("nodes", []):
            if isinstance(n, dict) and n.get("id") == current_node_id:
                nd = n.get("data", {}) if isinstance(n.get("data"), dict) else {}
                name = nd.get("label", "") or n.get("label", "")
                if name:
                    return name
                break

    # Fallback: first location name (prefer label over placeholder name)
    if locations_data:
        first_loc = locations_data[0]
        if isinstance(first_loc, dict):
            name = first_loc.get("name", "")
            label = first_loc.get("label", "")
            # Use label if name is a placeholder
            if label and name in ("新地点", "新位置", "未命名地点", ""):
                return label
            if name and name not in ("新地点", "新位置", "未命名地点"):
                return name
            if label:
                return label

    return "第一幕"


def _build_role_details(available_roles: list, characters_data: list) -> list:
    """Build list of role detail dicts for frontend, including customizable fields."""
    print(f"[_build_role_details] available_roles={available_roles}, "
          f"characters_data count={len(characters_data)}")
    details = []
    for role_id in available_roles:
        char_info = next(
            (c for c in characters_data if c.get("id") == role_id), None
        )
        if char_info:
            # Resolve customizable field display names from dotted paths
            raw_custom = char_info.get("customizable_attributes", [])
            attr_cap = char_info.get("attribute_constraints")
            parsed_custom = []
            for field in raw_custom:
                if isinstance(field, str):
                    # "worldParams.因果值" → displayName="因果值", path="worldParams.因果值"
                    parts = field.split(".", 1)
                    display = parts[1] if len(parts) > 1 else parts[0]
                    field_type = _infer_attr_type(field, char_info)
                    parsed_custom.append({
                        "path": field,
                        "displayName": display,
                        "type": field_type,
                    })
            details.append({
                "id": role_id,
                "name": char_info.get("name", role_id),
                "description": char_info.get("description", ""),
                "identity": char_info.get("identity", ""),
                "appearance": char_info.get("appearance", ""),
                "personality": char_info.get("personality", ""),
                "attributes": char_info.get("attributes", {}),
                "customizableAttributes": parsed_custom,
                "numericAttributeCap": attr_cap,
            })
    print(f"[_build_role_details] Returned {len(details)} role(s): "
          f"{[(d['id'], d['name']) for d in details]}")
    return details


def _infer_attr_type(field_path: str, char_info: dict) -> str:
    """Infer whether a customizable field is 'text' or 'number'.

    Resolution order:
    1. Look up the value in char_info attributes (both flat and nested)
    2. If found: isinstance check (int/float → "number", str → "text")
    3. If not found: heuristics based on field name
    """
    # "name" is always text
    if field_path == "name":
        return "text"

    attrs = char_info.get("attributes", {})

    if "." in field_path:
        # Dotted path: e.g. "worldParams.魔力值" → look up "魔力值" in attributes
        _, key = field_path.split(".", 1)
        if key in attrs:
            val = attrs[key]
            if isinstance(val, (int, float)):
                return "number"
            if isinstance(val, str):
                return "text"
        # Default for prefixed (world params): numeric
        return "number"
    else:
        # Simple name: check char_info top-level and attributes
        # Top-level fields like "age", "gender", etc.
        if field_path in char_info:
            val = char_info[field_path]
            if isinstance(val, (int, float)):
                return "number"
            if isinstance(val, str):
                return "text"
        # Check in attributes
        if field_path in attrs:
            val = attrs[field_path]
            if isinstance(val, (int, float)):
                return "number"
            if isinstance(val, str):
                return "text"
        # Heuristic fallback
        if field_path in ("age",):
            return "text"   # age could be "中年", "30岁" etc.
        if field_path in ("gender", "appearance", "personality", "identity",
                          "description", "motivation", "alias", "label"):
            return "text"
        # Anything else defaults to number
        return "number"


def _summarize_world(world_setting: list) -> str:
    """Build a complete world summary string (all blocks, for AI context)."""
    if not world_setting:
        return ""
    blocks = []
    for block in world_setting:
        if isinstance(block, dict):
            content = block.get("content", "")
            if content:
                title = block.get("title", "")
                prefix = f"{title}：" if title else ""
                blocks.append(f"{prefix}{content[:500]}")
    return "\n\n".join(blocks)


def _summarize_characters(characters_data: list) -> str:
    """Build a condensed character summary including appearance."""
    if not characters_data:
        return ""
    lines = []
    for c in characters_data[:6]:  # max 6 characters
        if isinstance(c, dict):
            name = c.get("name", "无名")
            desc = c.get("description", "")
            ident = c.get("identity", "")
            appearance = c.get("appearance", "")
            personality = c.get("personality", "")
            motivation = c.get("motivation", "")
            line = f"- {name}"
            if ident:
                line += f"（{ident}）"
            if desc:
                line += f"：{desc[:80]}"
            if personality:
                line += f" [性格：{personality[:60]}]"
            if appearance:
                line += f" [外貌：{appearance[:60]}]"
            if motivation:
                line += f" [动机：{motivation[:80]}]"
            lines.append(line)
    return "\n".join(lines) if lines else ""


def _summarize_player_identities(characters_data: list) -> str:
    """Build a player character identity section specifically for opening narration.
    
    Only includes playable characters, with rich identity info so the DM AI
    knows who the player(s) are embodying.
    """
    if not characters_data:
        return ""
    playable = [c for c in characters_data if isinstance(c, dict) and c.get("is_playable")]
    if not playable:
        return ""
    lines = []
    for c in playable:
        name = c.get("name", "无名")
        ident = c.get("identity", "")
        desc = c.get("description", "")
        personality = c.get("personality", "")
        motivation = c.get("motivation", "")
        parts = [f"**{name}**"]
        if ident:
            parts.append(f"身份：{ident}")
        if desc:
            parts.append(f"简介：{desc}")
        if personality:
            parts.append(f"性格：{personality}")
        if motivation:
            parts.append(f"背景/动机：{motivation}")
        lines.append("  " + "；".join(parts))
    if not lines:
        return ""
    header = '**玩家扮演角色（请将玩家身份自然融入开场叙述，不要直接列出"可选角色"）**：'
    return header + "\n" + "\n".join(lines)


def _summarize_locations(locations_data: list) -> str:
    """Build a condensed location summary using labels and atmosphere."""
    if not locations_data:
        return ""
    lines = []
    for loc in locations_data[:4]:
        if isinstance(loc, dict):
            name = loc.get("name", "")
            label = loc.get("label", "")
            display = label or name
            desc = loc.get("description", "")
            atmosphere = loc.get("atmosphere", "")
            terrain = loc.get("terrain", "")
            if display:
                line = f"- {display}"
                extras = []
                if desc:
                    extras.append(desc[:60])
                if atmosphere:
                    extras.append(f"氛围：{atmosphere[:40]}")
                if terrain:
                    extras.append(f"地形：{terrain[:30]}")
                if extras:
                    line += f"：{'；'.join(extras)}"
                lines.append(line)
    return "\n".join(lines) if lines else ""


def _build_image_prompt(
    scene_name: str,
    scene_desc: str,
    script_title: str,
    plot_graph: dict,
    current_node_id: str,
    characters_data: Optional[List[dict]] = None,
    locations_data: Optional[List[dict]] = None,
) -> str:
    """Build a rich prompt string for scene image generation, incorporating
    character appearances and location atmosphere for visual fidelity."""
    parts = [f"[{script_title}] 场景：{scene_name}"]

    # Try to get scene description from current node
    node_desc = ""
    for n in plot_graph.get("nodes", []):
        if isinstance(n, dict) and n.get("id") == current_node_id:
            nd = n.get("data", {}) if isinstance(n.get("data"), dict) else {}
            node_desc = nd.get("sceneDescription", "")
            break

    desc = node_desc or scene_desc
    if desc:
        parts.append(desc[:200])

    # Inject location atmosphere/description for visual mood
    if locations_data:
        for loc in locations_data[:2]:  # first 2 locations
            if isinstance(loc, dict):
                loc_label = loc.get("label", "") or loc.get("name", "")
                loc_desc = loc.get("description", "")
                loc_atmosphere = loc.get("atmosphere", "")
                loc_terrain = loc.get("terrain", "")
                if loc_label and loc_label in scene_name:
                    if loc_desc:
                        parts.append(f"环境细节：{loc_desc[:150]}")
                    if loc_atmosphere:
                        parts.append(f"氛围：{loc_atmosphere[:100]}")
                    if loc_terrain:
                        parts.append(f"地形：{loc_terrain[:80]}")
                    break

    # Inject character appearance descriptions
    if characters_data:
        char_visuals = []
        for c in characters_data[:4]:  # max 4 characters
            if isinstance(c, dict):
                name = c.get("name", "")
                appearance = c.get("appearance", "")
                identity = c.get("identity", "")
                if appearance and name:
                    visual = f"{name}"
                    if identity:
                        visual += f"（{identity}）"
                    visual += f"外貌：{appearance[:120]}"
                    char_visuals.append(visual)
        if char_visuals:
            parts.append("场景中的人物：" + "；".join(char_visuals))

    return "，".join(parts)


def _build_initial_node_context(
    current_node_id: str,
    plot_graph: dict,
    locations_data: list,
    characters_data: list,
    items_data: list,
) -> str:
    """Build context from the initial checkpoint node's rich data.

    Extracts: sceneDescription, conditions (player choices),
    boundLocations (resolved to names), triggerConditions (resolved to entity names),
    potentialActions, and DM notes (description field).
    """
    if not current_node_id:
        return ""

    # Build entity name resolvers
    entity_names = {}
    for c in characters_data:
        if isinstance(c, dict):
            eid = c.get("id", "")
            name = c.get("name", c.get("label", eid))
            entity_names[f"character:{eid}"] = f"角色「{name}」"
            entity_names[eid] = f"角色「{name}」"
    for loc in locations_data:
        if isinstance(loc, dict):
            eid = loc.get("id", "")
            name = loc.get("name", loc.get("label", eid))
            entity_names[f"location:{eid}"] = f"地点「{name}」"
            entity_names[eid] = f"地点「{name}」"
    for it in items_data:
        if isinstance(it, dict):
            eid = it.get("id", "")
            name = it.get("name", it.get("label", eid))
            entity_names[f"item:{eid}"] = f"物品「{name}」"
            entity_names[eid] = f"物品「{name}」"

    # Find the current node's data
    node_data = {}
    for n in plot_graph.get("nodes", []):
        if isinstance(n, dict) and n.get("id") == current_node_id:
            node_data = n.get("data", {}) if isinstance(n.get("data"), dict) else {}
            break

    if not node_data:
        return ""

    lines = []

    # 1. Scene description (visible to players)
    scene_desc = node_data.get("sceneDescription", "")
    if scene_desc:
        lines.append(f"**当前场景描述（告知玩家）**：{scene_desc}")

    # 2. DM note (hidden from players, the description field of the node)
    dm_note = node_data.get("description", "")
    if dm_note:
        lines.append(f"**DM备注（不告知玩家）**：{dm_note[:300]}")

    # 3. Conditions (player choices available at this node)
    conditions = node_data.get("conditions", [])
    if conditions and isinstance(conditions, list) and len(conditions) > 0:
        cond_str = "、".join(str(c) for c in conditions)
        lines.append(f"**当前节点玩家可选行动**：{cond_str}")

    # 4. Potential actions (structured action → result mapping)
    potential_actions = node_data.get("potentialActions", {})
    if potential_actions and isinstance(potential_actions, dict):
        action_lines = []
        for action, result in potential_actions.items():
            action_lines.append(f"  · {action.strip()} → {str(result)[:80]}")
        if action_lines:
            lines.append("**节点预置行动映射**：\n" + "\n".join(action_lines))

    # 5. Bound locations
    bound_locs = node_data.get("boundLocations", [])
    if bound_locs:
        loc_names = []
        for lid in bound_locs:
            name = entity_names.get(lid) or entity_names.get(f"location:{lid}") or lid
            loc_names.append(name)
        lines.append(f"**绑定地点**：{'、'.join(loc_names)}")

    # 6. Trigger conditions (resolved to entity names)
    trigger_conds = node_data.get("triggerConditions", [])
    if trigger_conds:
        resolved = [entity_names.get(tc, tc) for tc in trigger_conds]
        lines.append(f"**触发条件**：{'、'.join(resolved)}")

    # 7. Bound checks (mechanics)
    bound_checks = node_data.get("boundChecks", [])
    if bound_checks:
        lines.append(f"**绑定检定**：{', '.join(str(c) for c in bound_checks)}")

    return "\n".join(lines)


def _build_story_overview(plot_graph: dict, plot_inspection: dict) -> str:
    """Build a summary of the entire plot tree for DM context.

    Shows all nodes, their labels/descriptions, and how they connect,
    giving the DM a high-level map of the story structure.
    """
    nodes = plot_graph.get("nodes", []) if isinstance(plot_graph, dict) else []
    node_names = plot_inspection.get("node_names", {}) if isinstance(plot_inspection, dict) else {}
    connections = plot_inspection.get("connections", {}) if isinstance(plot_inspection, dict) else {}
    initial = plot_inspection.get("initial_checkpoint", "") if isinstance(plot_inspection, dict) else ""
    endings = plot_inspection.get("end_checkpoints", []) if isinstance(plot_inspection, dict) else []

    if not nodes:
        return ""

    # Build node data index
    nodes_index = {}
    for n in nodes:
        if isinstance(n, dict):
            nid = n.get("id", "")
            nd = n.get("data", {}) if isinstance(n.get("data"), dict) else {}
            nodes_index[nid] = {
                "label": n.get("label", nid),
                "name": nd.get("name", ""),
                "scene_desc": nd.get("sceneDescription", "")[:80],
                "dm_note": nd.get("description", "")[:60],
            }

    lines = ["## 剧情树总览", ""]
    lines.append(f"起始节点：{node_names.get(initial, initial) or '（未设置）'}")
    lines.append(f"结局节点数：{len(endings)}")
    lines.append(f"总节点数：{len(nodes)}")
    lines.append("")

    # Build a simple adjacency representation
    for nid, info in sorted(nodes_index.items(), key=lambda x: (x[0] == initial, x[0])):
        label = info["label"]
        is_initial = "🚩 " if nid == initial else ""
        is_ending = "🏁 " if nid in endings else ""
        prefix = is_initial + is_ending

        # Brief description
        desc_parts = []
        if info["scene_desc"]:
            desc_parts.append(f"场景：{info['scene_desc']}")
        if info["dm_note"]:
            desc_parts.append(f"DM备注：{info['dm_note']}")

        # Outgoing edges
        out_edges = connections.get(nid, [])
        next_labels = []
        for e in out_edges:
            tgt = e.get("target", "") if isinstance(e, dict) else e
            tgt_label = nodes_index.get(tgt, {}).get("label", tgt) if tgt else "?"
            edge_label = e.get("label", "") if isinstance(e, dict) else ""
            if edge_label:
                next_labels.append(f"[{edge_label}]→{tgt_label}")
            else:
                next_labels.append(f"→{tgt_label}")

        line = f"{prefix}{label}"
        if desc_parts:
            line += f"  （{'；'.join(desc_parts)}）"
        if next_labels:
            line += f"\n    出边：{'  '.join(next_labels)}"

        lines.append(line)

    return "\n".join(lines)


def _build_fallback_opening(
    script_title: str,
    world_text: str,
    scene_name: str,
    raw_scene_desc: str,
) -> str:
    """Build a fallback DM opening without AI (used when AI call fails)."""
    lines = []

    # World intro
    if world_text:
        lines.append(f"\n{world_text[:300]}")

    # lines.append(f"\n📍 {scene_name}")

    if raw_scene_desc and raw_scene_desc not in ("故事开始了...", "故事即将开始..."):
        lines.append(f"\n{raw_scene_desc[:400]}")
    elif world_text:
        lines.append(f"\n{world_text[:400]}")
    else:
        lines.append("\n故事即将开始...")

    return "\n".join(lines)


async def _generate_ai_opening_text(
    script_title: str,
    world_summary: str,
    char_summary: str,
    loc_summary: str,
    plot_context: str,
    scene_name: str,
    raw_scene_desc: str,
    player_identity: str = "",
    initial_node_context: str = "",
) -> tuple[str | None, list[str]]:
    """Generate opening narration + options. Returns (narration_or_None, options_list)."""
    char_context = f"\n\n**场上其它人物（仅供背景参考）**：\n{char_summary}" if char_summary else ""

    player_section = ""
    if player_identity:
        player_section = f"""

{player_identity}"""

    node_section = ""
    if initial_node_context:
        node_section = f"""
---
**📍 起始节点详细信息**：
{initial_node_context}
"""

    prompt = f"""你是一个专业的跑团/剧本杀 DM（主持人）。请为以下剧本写一个开场白。

---
{node_section}
---
**剧本标题**：{script_title}

**世界观**：
{world_summary or "（暂无世界观设定）"}

**当前场景**：{scene_name}

**场景描述**：
{raw_scene_desc or "场景尚未详细描述"}{player_section}{char_context}

**地点**：
{loc_summary or "（暂无地点）"}

**剧情上下文**：
{plot_context or "（自由探索）"}

---

【核心要求】
1. **开场白必须以"起始节点详细信息"中的场景描述为核心展开**，严格还原其中的场景设定、氛围和情节起点。不要偏离或自行发挥新的场景设定。
2. **严格遵循"预设主持人笔记"中的指导**：如果剧情上下文中包含"预设主持人笔记"，其中关于开场氛围、误导方向、信息控制、节奏把控等指导必须严格遵守。
3. 用生动、沉浸式的语言营造氛围。
4. **开场白必须从玩家角色的视角出发**：根据"玩家扮演角色"的身份、背景和动机信息，自然地将玩家带入其所扮演的角色处境中。叙述中可以使用"你"或"你们"来称呼玩家。
5. 如果起始节点有"玩家可选行动"或"预置行动映射"，请围绕这些行动方向来描写场景，让玩家自然产生对应的行动意图。
6. 长度控制在 300 字以内
7. **重要**：不要出现"可扮演角色""可选角色""角色列表"等元信息，角色选择已在专门页面完成

输出格式：
##FORBIDS##
请先分析：在开场白中，哪些信息、伏笔、秘密和未来剧情发展是绝对不能告诉玩家的。
列出3-5条核心禁忌，并说明为什么此刻不能透露。这部分仅供内部审核使用，不会发送给玩家。

##NARRATION##
（你的开场白正文）

##OPTIONS##
- 玩家可以选择的行动方向1（简短，5-15字）
- 玩家可以选择的行动方向2
- 玩家可以选择的行动方向3
（给出2-3个自然的行动选择，优先从起始节点的"可选行动"或"预置行动"中提炼，选项要简短清晰）"""

    raw = await _call_ai_text(prompt, "opening narration", max_tokens=6000, temperature=0.8)
    if not raw:
        return None, []

    narration, options = _parse_opening_response(raw)

    # Log if either part is empty (diagnostic)
    if not narration:
        print(f"[opening_node] ⚠️ Parsed narration is empty! Raw: {raw[:200]}...")
    if not options:
        print(f"[opening_node] ⚠️ Parsed options is empty! Raw ends: ...{raw[-200:]}")

    return narration, options


def _parse_opening_response(raw: str) -> tuple[str | None, list[str]]:
    """Parse AI opening response: separate forbids, narration and options.
    Handles formatted (##FORBIDS## / ##NARRATION## / ##OPTIONS##) and unformatted responses.
    
    ##FORBIDS## content is printed to backend logs only, NEVER sent to frontend.
    """
    import re

    narration: str | None = None
    options: list[str] = []

    # Extract ##FORBIDS## block — backend log only, never sent to players
    forbids_match = re.search(
        r'##FORBIDS##\s*([\s\S]*?)(?=##NARRATION##|##OPTIONS##|$)',
        raw, re.IGNORECASE,
    )
    if forbids_match:
        forbids_text = forbids_match.group(1).strip()
        if forbids_text:
            print(f"[opening_node] ===== ##FORBIDS## (backend audit only) =====")
            print(forbids_text)
            print(f"[opening_node] ===== END FORBIDS =====")

    # Try to extract ##NARRATION## block
    narr_match = re.search(
        r'##NARRATION##\s*([\s\S]*?)(?=##OPTIONS##|$)',
        raw, re.IGNORECASE,
    )
    if narr_match:
        narration = narr_match.group(1).strip()

    # Try to extract ##OPTIONS## block
    opts_match = re.search(
        r'##OPTIONS##\s*([\s\S]*?)$',
        raw, re.IGNORECASE,
    )
    if opts_match:
        opts_text = opts_match.group(1).strip()
        options = _clean_opening_options(opts_text)

    # If no narration block found, use everything before ##OPTIONS## or the whole text
    # (but exclude ##FORBIDS## block content)
    if not narration:
        # Strip ##FORBIDS## block if present before fallback extraction
        clean_raw = re.sub(
            r'##FORBIDS##\s*[\s\S]*?(?=##NARRATION##|##OPTIONS##|$)',
            '', raw, flags=re.IGNORECASE,
        ).strip()
        if opts_match:
            narration = clean_raw[:clean_raw.find('##OPTIONS##')].strip()
        else:
            narration = clean_raw.strip()

    if not narration:
        narration = None

    return narration, options


def _clean_opening_options(opts_text: str) -> list[str]:
    """Clean option lines: strip bullet markers and numbering."""
    import re
    options = []
    for line in opts_text.split("\n"):
        line = line.strip()
        if not line:
            continue
        # Remove leading bullet markers: "- ", "• ", "* ", "▸ "
        line = re.sub(r'^[•\*▸\-•]\s*', '', line)
        # Remove leading numbering: "1. ", "1) ", "1、"
        line = re.sub(r'^\d+[\.\)、]\s*', '', line)
        if line:
            options.append(line)
    return options


async def _generate_ai_summaries(
    script_title: str,
    world_summary: str,
    loc_summary: str,
    plot_context: str,
    initial_node_context: str = "",
    story_overview: str = "",
) -> dict | None:
    """Generate world_summary + plot_summary as JSON. Returns dict or None."""
    overview_section = ""
    if story_overview:
        overview_section = f"""
---

**📖 剧情树总览（DM参考）**：
{story_overview}
"""

    node_section = ""
    if initial_node_context:
        node_section = f"""
---

**📍 起始节点详细信息**：
{initial_node_context}
"""

    prompt = f"""你是一个剧本分析专家。请为以下剧本生成世界观摘要和情节总览摘要。

---
{node_section}
---

**剧本标题**：{script_title}

**世界观**：
{world_summary or "（暂无世界观设定）"}

**地点**：
{loc_summary or "（暂无地点）"}

**剧情上下文**：
{plot_context or "（自由探索）"}
{overview_section}
---

请严格按以下JSON格式输出（不要任何解释，只输出JSON）：
{{
    "world_summary": "凝练的世界观摘要（200-400字，概括世界观关键设定、核心规则、重要背景）",
    "plot_summary": "凝练的情节总览摘要（200-400字，概括主线剧情走向、关键节点、核心冲突、伏笔和结局方向，必须包含起始节点的场景设定作为情节起点）"
}}"""

    return await _call_ai_json(prompt, "summaries", max_tokens=1200, temperature=0.7)


async def _call_ai_text(prompt: str, label: str = "", max_tokens: int = 800, temperature: float = 0.8) -> str | None:
    """Call AI and return plain text response, or None on failure."""
    try:
        from services.ai_service import get_ai_client, get_default_model
        client = get_ai_client()
        if not client:
            print(f"[opening_node] AI client unavailable for {label}")
            return None

        response = await client.chat.completions.create(
            model=get_default_model(),
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        raw = (response.choices[0].message.content or "").strip()
        if raw:
            print(f"[opening_node] AI {label} generated: {len(raw)} chars")
            return raw
        return None
    except Exception as e:
        print(f"[opening_node] AI {label} failed: {e}")
        return None


async def _call_ai_json(prompt: str, label: str = "", max_tokens: int = 1200, temperature: float = 0.7) -> dict | None:
    """Call AI, parse JSON response via shared json_utils, return dict or None."""
    try:
        from services.ai_service import get_ai_client, get_default_model
        from utils.json_utils import parse_llm_json

        client = get_ai_client()
        if not client:
            print(f"[opening_node] AI client unavailable for {label}")
            return None

        response = await client.chat.completions.create(
            model=get_default_model(),
            messages=[{"role": "user", "content": prompt}],
            temperature=temperature,
            max_tokens=max_tokens,
        )
        raw = (response.choices[0].message.content or "").strip()
        if not raw:
            return None

        print(f"[opening_node] AI {label} generated: {len(raw)} chars")

        parsed = parse_llm_json(raw)
        if not parsed:
            print(f"[opening_node] Could not parse JSON from {label} response")
            return None

        result: dict = {}
        if parsed.get("world_summary"):
            result["world_summary"] = str(parsed["world_summary"])[:600]
        if parsed.get("plot_summary"):
            result["plot_summary"] = str(parsed["plot_summary"])[:600]
        print(f"[opening_node] Parsed {label}: world={len(result.get('world_summary', ''))} chars, "
              f"plot={len(result.get('plot_summary', ''))} chars")
        return result
    except Exception as e:
        print(f"[opening_node] AI {label} failed: {e}")
        return None


def opening_condition(state: GameState) -> str:
    """
    After opening_node: if roles exist and need selection → END (wait for external
    role select + character sheet submission). Otherwise → playing.
    """
    needs = state.get("_needs_role_select", False)
    stage = state.get("stage", "")
    print(f"[opening_condition] _needs_role_select={needs}, stage={stage}")
    if needs:
        return "__end__"
    return "playing"

