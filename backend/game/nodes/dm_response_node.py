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
        # ⚠️ Do NOT clear dice_result here! The second dm_response call (post-check)
        #    would overwrite the dice_result set by check_node, preventing
        #    _process_graph_results from entering the check-specific emission flow.
        #    dice_result is consumed & cleared in _process_graph_results instead.
        # Clear previous round's consumable state to prevent stale replays
        "pending_check": None,
    }

    # ── Final round cleanup: ceremony delivered, clear flags ──
    if state.get("_is_final_round"):
        updates["_is_final_round"] = False
        updates["_final_narration_delivered"] = True
        print(f"[dm_response_node] 🎭 结局仪式叙述已生成 ({len(narration)} chars)")

    # Advance round if a full turn is complete
    updates["current_round"] = state.get("current_round", 0) + 1

    print(f"[dm_response_node] chat_history appended, now {len(chat)} entries, "
          f"current_round -> {updates['current_round']}")

    return updates


def _build_system_prompt(state: GameState) -> str:
    """Build the system prompt for the DM AI."""
    script_title = state.get("script_title", "未知剧本")
    scene = state.get("scene_description", "")
    is_final = state.get("_is_final_round", False)

    rules = """
你是一个专业的跑团游戏主持人（DM）。你的职责：
1. 根据剧本设定和玩家行动推进剧情
2. 描述场景、NPC对话、环境变化
3. 在合适的时机触发检定（用 ##ACTIONS## 标记）
   ⚠️ 如果上下文中有「⚡ 当前节点绑定检定」，必须在本节点触发该检定！
4. 保持剧情连贯和有趣
5. 回应时使用生动的中文描述
6. ⚠️ 当剧情推进到新的情节节点时，必须在 ##ACTIONS## 中声明 update_node
7. 检定时务必使用上下文中给定的检定属性名和难度值，不要自己编造
8. 检定成功后按上下文中给定的"成功→"效果推进；失败后按"失败→"效果推进"""

    # Append final-round ceremony rules if applicable
    if is_final:
        rules += """

🎭 **结局仪式感专有规则：**
9. 这是故事的最后一次叙述，不需要再触发检定或推进节点
10. 用诗意的语言收束全篇：回顾角色成长、升华主题、描绘最终画面
11. 让每个玩家的选择都有回声，情感既要释放也要留有余韵
12. 像一部电影或小说的结尾一样，给玩家一个值得回味的告别"""
    else:
        rules += """

⚙️ 检定机制说明（你只需要触发检定，系统会自动执行掷骰）：
  - 系统从 0 ~ 检定属性值 之间随机取一个整数
  - 若该随机数 >= 难度，则成功；否则失败
  - 例：力量=14、难度=10 → 系统取 randint(0,14)，若结果≥10 则成功（概率约 36%）
  - 例：洞察值=3、难度=3  → 系统取 randint(0,3)，若结果≥3 则成功（概率 25%）
  - 因此：难度越接近属性值上限，成功率越低；难度超过属性值则不可能成功"""

    rules += """

输出格式：
##NARRATION##
（你的叙述内容）
##ACTIONS##
[{"type": "update_node", "params": {"nodeId": "目标节点名称"}}, {"type": "change_scene", "params": {"name": "新场景名", "description": "场景描述"}}, {"type": "roll_dice", "params": {"checkTarget": "属性名", "difficulty": 10, "description": "检定描述"}}]
##OPTIONS##
- 选项1
- 选项2
##PRIVATE##
{"角色ID": "私密消息内容"}

⚠️ 检定后解读规则（当对话记录中出现 🎲 检定结果时）：
9. ⛔ 此时系统已完成掷骰，你的任务是**严格根据结果为成功或失败
   解读后果**，绝对不能再在 ##ACTIONS## 中加入 roll_dice！
10. 🔴 如果结果是 **❌ 失败**，你必须叙述负面后果，如：
    - 行动失败、信息获取不完整、被 NPC 察觉或反感、线索断裂等，按照"失败→"效果推进剧情。
11. 🟢 如果结果是 **✅ 成功**，按上下文中"成功→"效果推进剧情。
12. 📋 可以在 ##OPTIONS## 中列出玩家接下来的可选项，引导下一步行动。
13. 🔄 如果需要推进剧情节点，仍可加入 update_node 或 change_scene。

⚠️ 重要规则：
- 如果当前回合的剧情已经推进到了一个新的情节节点，务必在 ##ACTIONS## 中加入 update_node 声明
- 如果玩家行动导致地点/场景发生了变化（进入新房间、前往新区域等），但情节节点未变，请使用 change_scene 声明新场景
  change_scene 的 name 使用简洁的场景名（如"废弃医院大厅"），description 提供详细的场景氛围描述（50-200字）
- 如果你认为剧情仍在当前节点内（刚进入、正在展开），可以不加 update_node
- nodeId 必须直接复制"🔜 可推进到的节点"列表中某个节点的名称（仅复制节点名称本身即可），
  例如下一条节点名称是 "节点3"，则 nodeId 填写 "节点3"
  （直接从上文复制粘贴，不要自己编造或添加额外描述）
- 每次最多推进一个节点
- ⚠️ 选项标注规则：如果某个选项在你计划中会触发检定（roll_dice），请在该选项末尾标注「（需检定）」，
  例如：\"- 用力推开石门「（需检定）」\"。纯对话或观察类选项则不需标注。"""

    if is_final:
        rules += """

⚠️ **结局对话特殊规则：**
- 这是故事的终点，##ACTIONS## 应该为空数组 []，不要再触发检定或推进节点
- ##OPTIONS## 如果不是必需的，可以留空 []
- 集中于给出一次完整、饱满的最终叙述"""

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
    """Parse DM AI response into structured components.
    Handles multiple format variations from different AI models."""
    result = {
        "narration": "",
        "actions": [],
        "options": [],
        "private_messages": {},
    }

    # Extract ##NARRATION## block (case-insensitive for robustness)
    narr_match = re.search(r'##NARRATION##\s*([\s\S]*?)(?=##ACTIONS##|##OPTIONS##|##PRIVATE##|$)', raw, re.IGNORECASE)
    if narr_match:
        result["narration"] = narr_match.group(1).strip()
    else:
        # AI may have skipped the narration header — use everything before first known section
        stripped = _strip_section_headers(raw)
        result["narration"] = stripped.strip()

    # Extract ##ACTIONS## block
    actions_match = re.search(r'##ACTIONS##\s*([\s\S]*?)(?=##NARRATION##|##OPTIONS##|##PRIVATE##|$)', raw, re.IGNORECASE)
    if actions_match:
        try:
            actions_text = actions_match.group(1).strip()
            result["actions"] = json.loads(actions_text)
        except json.JSONDecodeError:
            result["actions"] = []

    # Extract ##OPTIONS## block — handle bullet (-), numbered (1.), and mixed formats
    options_match = re.search(r'##OPTIONS##\s*([\s\S]*?)(?=##NARRATION##|##ACTIONS##|##PRIVATE##|$)', raw, re.IGNORECASE)
    if options_match:
        opts_text = options_match.group(1).strip()
        result["options"] = [
            _clean_option(o) for o in opts_text.split("\n") if o.strip()
        ]

    # Extract ##PRIVATE## block
    priv_match = re.search(r'##PRIVATE##\s*([\s\S]*?)(?=##NARRATION##|##ACTIONS##|##OPTIONS##|$)', raw, re.IGNORECASE)
    if priv_match:
        try:
            result["private_messages"] = json.loads(priv_match.group(1).strip())
        except json.JSONDecodeError:
            pass

    return result


def _strip_section_headers(text: str) -> str:
    """Remove any remaining ##SECTION## headers and content blocks from text.
    Handles all known section types, including NARRATION and EPILOGUE."""
    # First remove section markers themselves (keep content between them as narration)
    cleaned = re.sub(
        r'##(?:ACTIONS|OPTIONS|PRIVATE|NARRATION|EPILOGUE)##',
        '',
        text,
        flags=re.IGNORECASE,
    )
    # Then remove section content blocks that follow headers
    cleaned = re.sub(
        r'##(?:ACTIONS|OPTIONS|PRIVATE|EPILOGUE)##\s*[\s\S]*?(?=##|$)',
        '',
        cleaned,
        flags=re.IGNORECASE,
    )
    return cleaned.strip()


def _clean_option(opt_text: str) -> str:
    """Clean an option line: strip bullet markers and numbering."""
    cleaned = opt_text.strip()
    # Remove leading bullet markers: "- ", "• ", "* ", "▸ "
    cleaned = re.sub(r'^[•\*▸\-•]\s*', '', cleaned)
    # Remove leading numbering: "1. ", "1) ", "1、"
    cleaned = re.sub(r'^\d+[\.\)、]\s*', '', cleaned)
    return cleaned


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

