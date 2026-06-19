"""
generate_node — GENERATE stage (sandbox mode).
Calls AI to generate world setting, characters, locations, and opening scene.
Migrated from BUMENGweb-main game_flow.py start_game() method.
"""

import os
import json
import asyncio
from datetime import datetime
from typing import Dict, Any

from game.state import GameState


async def generate_node(state: GameState) -> Dict[str, Any]:
    """
    AI-generated script (sandbox mode).
    Builds a prompt from player preferences and calls Qwen-Turbo to
    generate the complete scenario: world, characters, locations, plot.
    
    On subsequent graph invocations (stage already PLAYING), skips
    regeneration to preserve runtime state like current_round and chat_history.
    """
    # If already generated (stage beyond GENERATE), skip — preserve runtime state
    stage = state.get("stage", "")
    if stage not in ("", "LOBBY", "GENERATE") and state.get("characters_data"):
        print("[generate_node] Data already exists, skipping regeneration "
              f"(stage={stage}, current_round={state.get('current_round')})")
        return {}

    worldview = ", ".join(state.get("suggestions", [])) or "一个奇幻冒险世界"
    role_prefs = state.get("role_prefs", {})

    # Build AI prompt
    role_desc = ""
    if role_prefs:
        role_desc = "玩家角色偏好：\n" + "\n".join(
            f"- {name}: {pref}" for name, pref in role_prefs.items()
        )

    prompt = f"""你是一个专业跑团剧本创作者。请根据以下偏好生成一个完整的跑团剧本。

世界观偏好：{worldview}
{role_desc}

请以JSON格式输出，包含以下字段：
{{
  "script_title": "剧本标题",
  "world_setting": [{{"id": "w1", "title": "世界观概述", "content": "..."}}],
  "characters_data": [
    {{
      "id": "c1",
      "name": "角色名",
      "description": "角色描述",
      "is_playable": true,
      "min_players": 1,
      "max_players": 1,
      "attributes": {{"力量": 12, "智力": 14, "敏捷": 10}}
    }}
  ],
  "locations_data": [
    {{"id": "l1", "name": "地点名", "description": "地点描述"}}
  ],
  "items_data": [
    {{"id": "it1", "name": "物品名", "description": "物品描述"}}
  ],
  "plot_inspection": {{
    "initial_scene": "开场场景描述",
    "story_goal": "故事目标",
    "key_events": ["事件1", "事件2"],
    "dm_notes": "DM注意事项"
  }},
  "opening_scene": "详细的开场叙述，约200字"
}}

请生成4个可扮演角色，每个角色3-5个属性。
只返回JSON，不要添加任何解释。"""

    # Try to call AI service
    try:
        from services.ai_service import get_ai_client, get_default_model

        client = get_ai_client()
        if client:
            response = await client.chat.completions.create(
                model=get_default_model(),
                messages=[{"role": "user", "content": prompt}],
                temperature=0.8,
                max_tokens=4000,
            )
            raw = response.choices[0].message.content or ""

            # Extract JSON from response
            json_str = _extract_json(raw)
            data = json.loads(json_str)
        else:
            data = _get_fallback_script(worldview)
    except Exception as e:
        print(f"[generate_node] AI call failed: {e}, using fallback")
        data = _get_fallback_script(worldview)

    # Build state updates (stage will be set by opening_node)
    updates: Dict[str, Any] = {
        "stage": "OPENING",
        "script_title": data.get("script_title", "AI生成的剧本"),
        "world_setting": data.get("world_setting", []),
        "characters_data": data.get("characters_data", []),
        "locations_data": data.get("locations_data", []),
        "items_data": data.get("items_data", []),
        "plot_graph": data.get("plot_graph", {"nodes": [], "edges": []}),
        "mechanics_checks": data.get("mechanics_checks", []),
        "mechanics_votes": data.get("mechanics_votes", []),
        "plot_inspection": data.get("plot_inspection", {}),
        "character_attributes": {},
        "scene_description": data.get("opening_scene", "故事开始了..."),
        "current_round": 1,
        "turn_number": 1,
    }

    # Initialize character attributes
    for char in data.get("characters_data", []):
        char_id = char.get("id", char.get("name", ""))
        attrs = char.get("attributes", {})
        updates["character_attributes"][char_id] = attrs

    # Mark all AI-generated characters as playable
    updates["available_roles"] = [
        c["id"] for c in data.get("characters_data", []) if c.get("is_playable", True)
    ]

    return updates


def _extract_json(text: str) -> str:
    """Extract JSON from AI response text."""
    # Try to find JSON block between ```json and ```
    import re
    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', text)
    if match:
        return match.group(1)

    # Try to find { ... } block
    start = text.find('{')
    if start == -1:
        raise ValueError("No JSON found in AI response")

    # Find matching closing brace
    depth = 0
    end = start
    for i, c in enumerate(text[start:], start):
        if c == '{':
            depth += 1
        elif c == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    return text[start:end]


def _get_fallback_script(worldview: str) -> dict:
    """Generate a minimal fallback script when AI is unavailable."""
    return {
        "script_title": "快速冒险",
        "world_setting": [
            {"id": "w1", "title": "世界观", "content": worldview or "一个充满未知的冒险世界"}
        ],
        "characters_data": [
            {
                "id": "c1", "name": "冒险者", "description": "勇敢的探险家",
                "is_playable": True, "min_players": 1, "max_players": 1,
                "attributes": {"力量": 12, "智力": 12, "敏捷": 12}
            }
        ],
        "locations_data": [
            {"id": "l1", "name": "起始之地", "description": "冒险开始的地方"}
        ],
        "items_data": [],
        "plot_inspection": {
            "initial_scene": "你站在一个陌生的地方，前方充满了未知...",
            "story_goal": "探索世界",
            "key_events": [],
            "dm_notes": "这是一个由AI生成的快速冒险"
        },
        "opening_scene": "你环顾四周，发现自己置身于一个完全陌生的环境。空气中弥漫着神秘的气息，远处隐约传来不知名的声响。你的冒险，即将开始。",
    }
