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
import asyncio
import hashlib
import json
import re
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
    loc_summary = _summarize_locations(locations_data)

    # Build plot context
    plot_context = ""
    if isinstance(plot_inspection, dict):
        story_goal = plot_inspection.get("story_goal", "")
        dm_notes = plot_inspection.get("dm_notes", "")
        if story_goal:
            plot_context += f"故事目标：{story_goal}\n"
        if dm_notes:
            plot_context += f"DM备注：{dm_notes[:200]}\n"

    # ── Extract initial checkpoint node rich data ──
    initial_node_context = _build_initial_node_context(
        current_node_id, plot_graph, locations_data, characters_data, items_data
    )

    # ── Build story overview (full plot tree) for DM context ──
    story_overview = _build_story_overview(plot_graph, plot_inspection)

    fallback_text = _build_fallback_opening(
        script_title, world_summary, display_scene_name, raw_scene_desc
    )

    # Try AI with a short timeout so stage transition isn't blocked
    opening_text = fallback_text
    opening_pending = False
    world_summary_gen = ""
    plot_summary_gen = ""
    try:
        ai_result = await asyncio.wait_for(
            _generate_ai_opening(
                script_title=script_title,
                world_summary=world_summary,
                char_summary=char_summary,
                loc_summary=loc_summary,
                plot_context=plot_context,
                scene_name=display_scene_name,
                raw_scene_desc=raw_scene_desc,
                initial_node_context=initial_node_context,
                story_overview=story_overview,
            ),
            timeout=5.0,  # Increased to 5s to allow summaries generation
        )
        opening_text = ai_result.get("opening", fallback_text)
        world_summary_gen = ai_result.get("world_summary", "")
        plot_summary_gen = ai_result.get("plot_summary", "")
    except (asyncio.TimeoutError, Exception) as e:
        if isinstance(e, asyncio.TimeoutError):
            print(f"[opening_node] AI opening timed out (>5s), using fallback, will retry in background")
        else:
            print(f"[opening_node] AI opening failed: {e}, using fallback")
        opening_text = fallback_text
        # If we have roles, mark that AI opening should be retried in background
        if has_roles:
            opening_pending = True

    updates["scene"] = display_scene_name
    updates["scene_description"] = raw_scene_desc or opening_text
    updates["opening_narration"] = opening_text
    updates["world_summary"] = world_summary_gen
    updates["plot_summary"] = plot_summary_gen
    updates["_opening_pending"] = opening_pending
    updates["_opening_is_ai"] = not opening_pending  # True if AI successfully generated
    updates["_opening_prompt_data"] = {
        "script_title": script_title,
        "world_summary": world_summary,
        "char_summary": char_summary,
        "loc_summary": loc_summary,
        "plot_context": plot_context,
        "scene_name": display_scene_name,
        "raw_scene_desc": raw_scene_desc,
        "initial_node_context": initial_node_context,
        "story_overview": story_overview,
    } if opening_pending else None
    updates["_scene_image_prompt"] = _build_image_prompt(
        display_scene_name, raw_scene_desc, script_title, plot_graph,
        current_node_id, characters_data, locations_data
    )

    print(f"[opening_node] Done: stage={updates['stage']}, "
          f"_needs_role_select={updates.get('_needs_role_select')}, "
          f"_role_details count={len(updates.get('_role_details', []))}, "
          f"narration={len(opening_text)} chars (pending_ai={opening_pending}), "
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
            line = f"- {name}"
            if ident:
                line += f"（{ident}）"
            if desc:
                line += f"：{desc[:80]}"
            if appearance:
                line += f" [外貌：{appearance[:60]}]"
            lines.append(line)
    return "\n".join(lines) if lines else ""


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


async def _generate_ai_opening(
    script_title: str,
    world_summary: str,
    char_summary: str,
    loc_summary: str,
    plot_context: str,
    scene_name: str,
    raw_scene_desc: str,
    initial_node_context: str = "",
    story_overview: str = "",
) -> dict:
    """Use AI to generate: opening narration + world_summary + plot_summary.
    Returns {"opening": str, "world_summary": str, "plot_summary": str}."""
    # Build character context for AI background knowledge (not for listing)
    char_context = f"\n\n**场上人物（仅供背景参考，不要在开场白中列出可选角色）**：\n{char_summary}" if char_summary else ""

    # Build story overview section
    overview_section = ""
    if story_overview:
        overview_section = f"""
---

**📖 剧情树总览（DM参考）**：
{story_overview}
"""

    # Build initial node context section
    node_section = ""
    if initial_node_context:
        node_section = f"""
---

**📍 起始节点详细信息**：
{initial_node_context}
"""

    prompt = f"""你是一个专业的跑团/剧本杀 DM（主持人）。请完成以下两项任务，严格按照输出格式回复。

---

**剧本标题**：{script_title}

**世界观**：
{world_summary or "（暂无世界观设定）"}

**当前场景**：{scene_name}

**场景描述**：
{raw_scene_desc or "场景尚未详细描述"}{char_context}

**地点**：
{loc_summary or "（暂无地点）"}

**剧情上下文**：
{plot_context or "（自由探索）"}
{node_section}{overview_section}

---

## 任务1：开场白
为以下剧本写一个开场白，要求：
1. 用生动、沉浸式的语言营造氛围
2. 简要引入世界观
3. 根据"起始节点详细信息"中的场景描述和玩家可选行动，自然地引导玩家进入剧情
4. 如果节点有DM备注（不告知玩家的信息），请将这些隐藏信息融入叙述中以营造悬念或伏笔，但不要直接透露
5. 描述当前场景，自然地融入在场人物的描写（作为场景的一部分，而非列出可选角色）
6. 给予玩家自然的行动引导（参考节点中的玩家可选行动方向，但不要以列表形式呈现）
7. 长度控制在 300 字以内
8. 重要：不要出现"可扮演角色""可选角色""角色列表"等内容，角色选择已在专门页面完成

## 任务2：世界观摘要 + 情节摘要
请严格按以下JSON格式输出（不要任何解释，只输出JSON）：
{{
    "opening": "开场白正文...",
    "world_summary": "凝练的世界观摘要（200-400字，概括世界观关键设定、核心规则、重要背景）",
    "plot_summary": "凝练的情节总览摘要（200-400字，概括主线剧情走向、关键节点、核心冲突、伏笔和结局方向）"
}}"""

    try:
        from services.ai_service import get_ai_client, get_default_model

        client = get_ai_client()
        if client:
            response = await client.chat.completions.create(
                model=get_default_model(),
                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                max_tokens=2500,
                stop=None,
            )
            raw_text = response.choices[0].message.content or ""
            if raw_text.strip():
                print(f"[opening_node] AI opening generated: {len(raw_text)} chars")
                return _parse_opening_response(raw_text, script_title, world_summary,
                                               scene_name, raw_scene_desc, char_summary,
                                               loc_summary, plot_context, story_overview)
    except Exception as e:
        print(f"[opening_node] AI opening generation failed: {e}")

    # Fallback
    return {
        "opening": _build_fallback_opening(script_title, world_summary, scene_name, raw_scene_desc),
        "world_summary": "",
        "plot_summary": "",
    }


def _parse_opening_response(
    raw_text: str,
    script_title: str,
    world_summary_fallback: str,
    scene_name: str,
    raw_scene_desc: str,
    char_summary: str = "",
    loc_summary: str = "",
    plot_context: str = "",
    story_overview: str = "",
) -> dict:
    """Parse AI's JSON response containing opening + world_summary + plot_summary."""
    result = {
        "opening": _build_fallback_opening(script_title, world_summary_fallback, scene_name, raw_scene_desc),
        "world_summary": "",
        "plot_summary": "",
    }

    try:
        # Strip markdown code blocks
        json_str = raw_text.strip()
        if json_str.startswith("```"):
            json_str = re.sub(r'^```(?:json)?\s*', '', json_str)
            json_str = re.sub(r'\s*```$', '', json_str)

        parsed = json.loads(json_str)
        if isinstance(parsed, dict):
            if parsed.get("opening"):
                result["opening"] = str(parsed["opening"])
            if parsed.get("world_summary"):
                result["world_summary"] = str(parsed["world_summary"])[:600]
            if parsed.get("plot_summary"):
                result["plot_summary"] = str(parsed["plot_summary"])[:600]
            print(f"[opening_node] Parsed summaries: world={len(result['world_summary'])} chars, "
                  f"plot={len(result['plot_summary'])} chars")
    except (json.JSONDecodeError, Exception) as e:
        print(f"[opening_node] Failed to parse opening JSON: {e}")
        # If JSON parsing fails, try to extract opening text from raw response
        clean = raw_text.strip()
        if clean and len(clean) > 20:
            result["opening"] = clean

    return result


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

