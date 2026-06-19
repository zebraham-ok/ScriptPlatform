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

    fallback_text = _build_fallback_opening(
        script_title, world_summary, display_scene_name, raw_scene_desc
    )

    # Try AI with a short timeout so stage transition isn't blocked
    opening_text = fallback_text
    opening_pending = False
    try:
        opening_text = await asyncio.wait_for(
            _generate_ai_opening(
                script_title=script_title,
                world_summary=world_summary,
                char_summary=char_summary,
                loc_summary=loc_summary,
                plot_context=plot_context,
                scene_name=display_scene_name,
                raw_scene_desc=raw_scene_desc,
            ),
            timeout=3.0,  # Don't block stage transition for more than 3s
        )
    except (asyncio.TimeoutError, Exception) as e:
        if isinstance(e, asyncio.TimeoutError):
            print(f"[opening_node] AI opening timed out (>3s), using fallback, will retry in background")
        else:
            print(f"[opening_node] AI opening failed: {e}, using fallback")
        opening_text = fallback_text
        # If we have roles, mark that AI opening should be retried in background
        if has_roles:
            opening_pending = True

    updates["scene"] = display_scene_name
    updates["scene_description"] = raw_scene_desc or opening_text
    updates["opening_narration"] = opening_text
    updates["_opening_pending"] = opening_pending
    updates["_opening_prompt_data"] = {
        "script_title": script_title,
        "world_summary": world_summary,
        "char_summary": char_summary,
        "loc_summary": loc_summary,
        "plot_context": plot_context,
        "scene_name": display_scene_name,
        "raw_scene_desc": raw_scene_desc,
    } if opening_pending else None
    updates["_scene_image_prompt"] = _build_image_prompt(
        display_scene_name, raw_scene_desc, script_title, plot_graph, current_node_id
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

    # Fallback: first location name (only if meaningful, not a placeholder)
    if locations_data:
        first_loc = locations_data[0]
        if isinstance(first_loc, dict):
            name = first_loc.get("name", "")
            if name and name not in ("新地点", "新位置", "未命名地点"):
                return name

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
                    parsed_custom.append({
                        "path": field,
                        "displayName": display,
                        "type": "number",  # default to number; could be inferred in future
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


def _summarize_world(world_setting: list) -> str:
    """Build a condensed world summary string."""
    if not world_setting:
        return ""
    for block in world_setting:
        if isinstance(block, dict):
            content = block.get("content", "")
            if content:
                title = block.get("title", "")
                prefix = f"{title}：" if title else ""
                return f"{prefix}{content[:300]}"
    return ""


def _summarize_characters(characters_data: list) -> str:
    """Build a condensed character summary."""
    if not characters_data:
        return ""
    lines = []
    for c in characters_data[:6]:  # max 6 characters
        if isinstance(c, dict):
            name = c.get("name", "无名")
            desc = c.get("description", "")
            ident = c.get("identity", "")
            line = f"- {name}"
            if ident:
                line += f"（{ident}）"
            if desc:
                line += f"：{desc[:80]}"
            lines.append(line)
    return "\n".join(lines) if lines else ""


def _summarize_locations(locations_data: list) -> str:
    """Build a condensed location summary."""
    if not locations_data:
        return ""
    lines = []
    for loc in locations_data[:4]:
        if isinstance(loc, dict):
            name = loc.get("name", "")
            desc = loc.get("description", "")
            if name:
                line = f"- {name}"
                if desc:
                    line += f"：{desc[:60]}"
                lines.append(line)
    return "\n".join(lines) if lines else ""


def _build_image_prompt(
    scene_name: str,
    scene_desc: str,
    script_title: str,
    plot_graph: dict,
    current_node_id: str,
) -> str:
    """Build a prompt string for scene image generation (consumed by game_server)."""
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

    return "，".join(parts)


def _build_fallback_opening(
    script_title: str,
    world_text: str,
    scene_name: str,
    raw_scene_desc: str,
) -> str:
    """Build a fallback DM opening without AI (used when AI call fails)."""
    lines = [f"## 🎬 {script_title}"]

    # World intro
    if world_text:
        lines.append(f"\n{world_text[:300]}")

    lines.append(f"\n📍 *{scene_name}*")

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
) -> str:
    """Use AI to generate a rich DM opening narration."""
    prompt = f"""你是一个专业的跑团/剧本杀 DM（主持人）。请为以下剧本写一个开场白，要求：

1. 用生动、沉浸式的语言营造氛围
2. 简要引入世界观
3. 描述当前场景
4. 介绍场上可扮演的角色（不剧透秘密身份）
5. 给予玩家自然的行动引导
6. 长度控制在 300 字以内

---

**剧本标题**：{script_title}

**世界观**：
{world_summary or "（暂无世界观设定）"}

**当前场景**：{scene_name}

**场景描述**：
{raw_scene_desc or "场景尚未详细描述"}

**可扮演角色**：
{char_summary or "（暂无角色）"}

**地点**：
{loc_summary or "（暂无地点）"}

**剧情上下文**：
{plot_context or "（自由探索）"}

---

请输出 Markdown 格式的开场白，包含标题、场景名和正文。
直接输出，不要添加解释。"""

    try:
        from services.ai_service import get_ai_client, get_default_model

        client = get_ai_client()
        if client:
            response = await client.chat.completions.create(
                model=get_default_model(),
                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                max_tokens=800,
            )
            text = response.choices[0].message.content or ""
            if text.strip():
                # Ensure markdown structure
                if not text.startswith("##"):
                    text = f"## 🎬 {script_title}\n\n📍 *{scene_name}*\n\n{text}"
                print(f"[opening_node] AI opening generated: {len(text)} chars")
                return text
    except Exception as e:
        print(f"[opening_node] AI opening generation failed: {e}")

    # Fallback
    return _build_fallback_opening(
        script_title, world_summary, scene_name, raw_scene_desc
    )


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

