"""
check_node — CHECK stage.
Executes dice roll checks based on pending_check data.
Migrated from BUMENGweb-main manager.py festival_check.
"""

from typing import Dict, Any
from datetime import datetime

from game.state import GameState
from game.utils.dice import roll_check


async def check_node(state: GameState) -> Dict[str, Any]:
    """
    Handle a dice check.
    1. Parse pending_check for target attribute and difficulty
    2. Roll dice based on character's attribute value
    3. Determine success/failure
    4. Apply attribute changes based on result
    """
    pending = state.get("pending_check", {})

    if not pending:
        return {"dice_result": None, "pending_check": None, "_route": "done"}

    check_target = pending.get("checkTarget", pending.get("check_target", "未指定属性"))
    difficulty = pending.get("difficulty", 10)
    description = pending.get("description", "检定")

    # Get character attributes — use the first player's character
    char_attrs = {}
    assigned_roles = state.get("assigned_roles", {})
    character_attributes = state.get("character_attributes", {})

    # Find the relevant character's attributes
    for char_id, player_sid in assigned_roles.items():
        if char_id in character_attributes:
            char_attrs = character_attributes[char_id]
            break

    # If no assigned roles, use first available character
    if not char_attrs and character_attributes:
        char_attrs = next(iter(character_attributes.values()), {})

    # Get the attribute value for the check
    attr_value = char_attrs.get(check_target, 10)

    # Roll the dice
    result = roll_check(attr_value, difficulty)

    # Build result
    dice_result = {
        "checkTarget": check_target,
        "difficulty": difficulty,
        "description": description,
        "attrValue": attr_value,
        "diceRoll": result["roll"],
        "total": result["roll"],
        "success": result["success"],
        "timestamp": datetime.now().isoformat(),
    }

    # Apply attribute change on success/failure
    attr_changes = {}
    if result["success"]:
        effect = pending.get("successEffect", "")
        attr_changes["_effect"] = effect or "检定成功！"
    else:
        effect = pending.get("failureEffect", "")
        attr_changes["_effect"] = effect or "检定失败..."

    # Persist dice result to chat_history so AI can see the outcome in subsequent turns
    result_text = (
        f"🎲 检定「{description}」：{check_target}({attr_value}) "
        f"vs 难度{difficulty} → 掷出{dice_result['diceRoll']} → "
        f"{'✅ 成功' if result['success'] else '❌ 失败'}"
    )
    if result["success"]:
        result_text += f"\n结果：{pending.get('successEffect', '检定成功')}"
    else:
        result_text += f"\n结果：{pending.get('failureEffect', '检定失败')}"

    chat = list(state.get("chat_history", []))
    chat.append({
        "role": "system",
        "sender": "系统",
        "content": result_text,
        "timestamp": datetime.now().isoformat(),
    })

    updates: Dict[str, Any] = {
        "dice_result": dice_result,
        "pending_check": None,
        "chat_history": chat,
        "_route": "done",
        "_attr_changes": attr_changes,
        # Automatically trigger DM response so AI sees the dice result
        # and can decide to advance the plot node based on success/failure
        "_need_dm_narration": True,
    }

    return updates
