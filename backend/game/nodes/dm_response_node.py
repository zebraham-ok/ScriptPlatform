"""
dm_response_node — DM_RESPONSE stage.
Calls AI (DeepSeek/Qwen) to generate DM narration based on current context.
Migrated from BUMENGweb-main plot_management.py and manager.py.
"""


import re
import json
from typing import Dict, Any, List

from game.state import GameState
from game.utils.context_builder import build_dm_context, summarize_history


async def dm_response_node(state: GameState) -> Dict[str, Any]:
    """
    Generate DM response using AI.
    Builds a comprehensive context then calls the AI model to produce:
    - dm_response: public narration
    - dm_actions: AI instructions (change_scene, roll_dice, etc.)
    - dm_options: quick options for players
    - private_messages: per-player private messages
    """
    # Build context for the AI
    context_prompt = build_dm_context(state)
    system_prompt = _build_system_prompt(state)

    # ======== FULL LOGGING: what we send to AI ========
    print("=" * 80)
    print(f"[dm_response_node] ===== DM AI CALL (round {state.get('current_round', '?')}) =====")
    print(f"[dm_response_node] chat_history has {len(state.get('chat_history', []))} messages:")
    for i, m in enumerate(state.get("chat_history", [])):
        if isinstance(m, dict):
            print(f"  [{i}] role={m.get('role','?')} sender={m.get('sender','?')}: {m.get('content','')[:120]}")
    print("-" * 40)
    print(f"[dm_response_node] SYSTEM PROMPT ({len(system_prompt)} chars):")
    print(system_prompt)
    print("-" * 40)
    print(f"[dm_response_node] USER CONTEXT ({len(context_prompt)} chars):")
    print(context_prompt)
    print("=" * 80)

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": context_prompt},
    ]

    try:
        from services.ai_service import get_ai_client, get_default_model

        client = get_ai_client()
        if client:
            model = get_default_model()
            print(f"[dm_response_node] Calling {model}...")
            response = await client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=0.8,
                max_tokens=2000,
            )
            raw = response.choices[0].message.content or ""
            print("-" * 40)
            print(f"[dm_response_node] AI RAW RESPONSE ({len(raw)} chars):")
            print(raw)
            print("=" * 80)
        else:
            print("[dm_response_node] No AI client available, using fallback")
            raw = _get_fallback_response(state)
    except Exception as e:
        print(f"[dm_response_node] AI call failed: {e}")
        raw = _get_fallback_response(state)
        print(f"[dm_response_node] FALLBACK: {raw[:200]}")
        print("=" * 80)

    # Parse the AI response
    parsed = _parse_dm_response(raw)
    print(f"[dm_response_node] Parsed: narration={len(parsed.get('narration',''))} chars, "
          f"actions={len(parsed.get('actions',[]))}, options={len(parsed.get('options',[]))}, "
          f"private_msgs={len(parsed.get('private_messages',{}))}")
    print(f"[dm_response_node] PARSED NARRATION: {parsed.get('narration','')[:200]}")
    if parsed.get('options'):
        print(f"[dm_response_node] PARSED OPTIONS: {parsed['options']}")
    if parsed.get('actions'):
        print(f"[dm_response_node] PARSED ACTIONS: {parsed['actions']}")

    # Append DM narration to chat_history so playing_node knows it's been answered
    from datetime import datetime
    chat = list(state.get("chat_history", []))
    narration = parsed.get("narration", raw)
    chat.append({
        "role": "dm",
        "sender": "DM",
        "content": narration,
        "timestamp": datetime.now().isoformat(),
    })

    updates: Dict[str, Any] = {
        "dm_response": narration,
        "dm_actions": parsed.get("actions", []),
        "dm_options": parsed.get("options", []),
        "private_messages": parsed.get("private_messages", {}),
        "chat_history": chat,
        "_route": "done",
        # Clear previous round's consumable state to prevent stale replays
        "dice_result": None,
        "pending_check": None,
    }

    # Advance round if a full turn is complete
    updates["current_round"] = state.get("current_round", 0) + 1

    print(f"[dm_response_node] chat_history appended, now {len(chat)} entries, "
          f"current_round -> {updates['current_round']}")

    return updates


def _build_system_prompt(state: GameState) -> str:
    """Build the system prompt for the DM AI."""
    script_title = state.get("script_title", "未知剧本")
    scene = state.get("scene_description", "")

    rules = """
你是一个专业的跑团游戏主持人（DM）。你的职责：
1. 根据剧本设定和玩家行动推进剧情
2. 描述场景、NPC对话、环境变化
3. 在合适的时机触发检定（用 ##ACTIONS## 标记）
4. 保持剧情连贯和有趣
5. 回应时使用生动的中文描述
6. ⚠️ 当剧情推进到新的情节节点时，必须在 ##ACTIONS## 中声明 update_node

输出格式：
##NARRATION##
（你的叙述内容）
##ACTIONS##
[{"type": "update_node", "params": {"nodeId": "目标节点名称"}}, {"type": "roll_dice", "params": {"checkTarget": "属性名", "difficulty": 10, "description": "检定描述"}}]
##OPTIONS##
- 选项1
- 选项2
##PRIVATE##
{"角色ID": "私密消息内容"}

⚠️ 重要规则：
- 如果当前回合的剧情已经推进到了一个新的情节节点，务必在 ##ACTIONS## 中加入 update_node 声明
- 如果你认为剧情仍在当前节点内（刚进入、正在展开），可以不加 update_node
- nodeId 必须直接复制"🔜 可推进到的节点"列表中某个节点的完整名称，
  例如下一条是 "节点3｜这大叔好像我爸年轻版"，则 nodeId 填写 "节点3｜这大叔好像我爸年轻版"
  （直接从上文复制粘贴，一字不差，不要自己编造）
- 每次最多推进一个节点
"""

    plot_notes = ""
    inspection = state.get("plot_inspection", {})
    if inspection:
        if isinstance(inspection, dict):
            dn = inspection.get("dm_notes", "")
            if dn:
                plot_notes = f"\nDM注意事项：{dn}"

    return f"""{rules}

当前剧本：《{script_title}》
{plot_notes}

当前场景：{scene}
当前回合：{state.get('current_round', 1)}/{state.get('total_rounds', 15)}"""


def _parse_dm_response(raw: str) -> dict:
    """Parse DM AI response into structured components."""
    result = {
        "narration": raw,
        "actions": [],
        "options": [],
        "private_messages": {},
    }

    # Extract ##NARRATION## block
    narr_match = re.search(r'##NARRATION##\s*([\s\S]*?)(?=##ACTIONS##|##OPTIONS##|##PRIVATE##|$)', raw)
    if narr_match:
        result["narration"] = narr_match.group(1).strip()

    # Extract ##ACTIONS## block
    actions_match = re.search(r'##ACTIONS##\s*([\s\S]*?)(?=##NARRATION##|##OPTIONS##|##PRIVATE##|$)', raw)
    if actions_match:
        try:
            actions_text = actions_match.group(1).strip()
            result["actions"] = json.loads(actions_text)
        except json.JSONDecodeError:
            result["actions"] = []

    # Extract ##OPTIONS## block
    options_match = re.search(r'##OPTIONS##\s*([\s\S]*?)(?=##NARRATION##|##ACTIONS##|##PRIVATE##|$)', raw)
    if options_match:
        opts_text = options_match.group(1).strip()
        result["options"] = [
            o.strip().lstrip("- ") for o in opts_text.split("\n") if o.strip()
        ]

    # Extract ##PRIVATE## block
    priv_match = re.search(r'##PRIVATE##\s*([\s\S]*?)(?=##NARRATION##|##ACTIONS##|##OPTIONS##|$)', raw)
    if priv_match:
        try:
            result["private_messages"] = json.loads(priv_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    return result


def _get_fallback_response(state: GameState) -> str:
    """Generate a simple fallback response without AI."""
    scene = state.get("scene_description", "")
    round_num = state.get("current_round", 1)

    return f"""##NARRATION##
第{round_num}回合。{scene}

DM正在思考接下来的发展...

（提示：AI服务暂不可用，请检查API配置。）
##OPTIONS##
- 继续探索
- 查看周围环境
- 与同伴交谈"""

