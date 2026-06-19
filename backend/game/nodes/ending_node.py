"""
ending_node — ENDING stage.
Generates ending narration and final scene card.
Migrated from BUMENGweb-main plot_management.py ending logic.
"""

import os
from typing import Dict, Any, Optional
from datetime import datetime

from game.state import GameState


async def ending_node(state: GameState) -> Dict[str, Any]:
    """
    Ending stage: generate conclusion.
    1. If ending_data already exists, use it
    2. Otherwise, try to generate ending via AI
    3. Fallback to a simple ending message
    """
    ending_data = state.get("ending_data")
    if ending_data:
        # Already have ending data
        return {
            "stage": "ENDING",
            "ending_reached": True,
            "_route": "done",
        }

    # Try to generate ending via AI
    title = state.get("script_title", "冒险")
    chat = state.get("chat_history", [])
    current_round = state.get("current_round", 0)

    # Build a brief summary from chat history
    summary_lines = []
    for msg in chat[-10:]:  # Last 10 messages
        if isinstance(msg, dict):
            role = msg.get("role", "")
            content = msg.get("content", "")
            if role == "dm":
                summary_lines.append(f"DM: {content[:100]}")
            elif role == "player":
                sender = msg.get("sender", "玩家")
                summary_lines.append(f"{sender}: {content[:100]}")

    summary = "\n".join(summary_lines)

    prompt = f"""请为跑团剧本《{title}》撰写结局。以下是故事摘要：

{summary}

请用生动的中文撰写结局叙述（约300字），包含故事的收尾和角色的结局。只返回叙述文本。"""

    narration = None
    try:
        from services.ai_service import get_ai_client, get_default_model
        client = get_ai_client()
        if client:
            response = await client.chat.completions.create(
                model=get_default_model(),
                messages=[
                    {"role": "system", "content": "你是一个专业的跑团游戏主持人，请为剧本撰写精彩的结局。"},
                    {"role": "user", "content": prompt},
                ],
                temperature=0.9,
                max_tokens=1000,
            )
            narration = response.choices[0].message.content
    except Exception as e:
        print(f"[ending_node] AI call failed: {e}")

    if not narration:
        narration = f"经过{current_round}个回合的冒险，《{title}》的故事落下帷幕。每位角色都在这段旅程中留下了自己的印记，这段经历将永远铭刻在记忆之中。"

    ending = {
        "title": title,
        "narration": narration,
        "totalRounds": current_round,
        "timestamp": datetime.now().isoformat(),
        "characters": _get_character_summaries(state),
    }

    return {
        "stage": "ENDING",
        "ending_reached": True,
        "ending_data": ending,
        "_route": "done",
    }


def _get_character_summaries(state: GameState) -> list:
    """Get brief character summaries for the ending card."""
    characters = state.get("characters_data", [])
    summaries = []
    for char in characters:
        if isinstance(char, dict):
            name = char.get("name", char.get("id", "未知角色"))
            desc = char.get("description", "")
            summaries.append({"name": name, "description": desc[:100]})
    return summaries
