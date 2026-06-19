"""
Dice utility — dice rolling and check resolution.
Migrated from BUMENGweb-main manager.py festival_check logic.
"""

import random
from typing import Dict, Any


def roll_d20() -> int:
    """Roll a single d20."""
    return random.randint(1, 20)


def roll_d6() -> int:
    """Roll a single d6."""
    return random.randint(1, 6)


def roll_dice(count: int, sides: int) -> list:
    """Roll multiple dice. Returns list of individual results."""
    return [random.randint(1, sides) for _ in range(count)]


def roll_check(attr_value: int, difficulty: int) -> Dict[str, Any]:
    """
    Perform a standard d20 attribute check.
    - Roll a d20
    - Add attribute modifier: (attr_value - 10) // 2
    - Compare to difficulty
    Returns detailed result.
    """
    roll = roll_d20()
    modifier = (attr_value - 10) // 2
    total = roll + modifier

    # Critical success (natural 20) or critical failure (natural 1)
    is_critical_success = roll == 20
    is_critical_failure = roll == 1

    if is_critical_success:
        success = True
        result_desc = "大成功！"
    elif is_critical_failure:
        success = False
        result_desc = "大失败..."
    else:
        success = total >= difficulty
        result_desc = "成功！" if success else "失败..."

    return {
        "roll": roll,
        "modifier": modifier,
        "total": total,
        "difficulty": difficulty,
        "success": success,
        "critical_success": is_critical_success,
        "critical_failure": is_critical_failure,
        "description": result_desc,
    }


def parse_dice_expression(expr: str) -> Dict[str, Any]:
    """
    Parse a dice expression like "2d6+3" or "1d20".
    Returns {"count": N, "sides": M, "bonus": B, "rolls": [...], "total": T}
    """
    if not expr:
        return {"count": 1, "sides": 20, "bonus": 0, "rolls": [], "total": 0}

    expr = expr.strip().lower().replace(" ", "")

    # Extract bonus/modifier
    bonus = 0
    if "+" in expr:
        expr, bonus_str = expr.rsplit("+", 1)
        bonus = int(bonus_str)
    elif "-" in expr:
        expr, bonus_str = expr.rsplit("-", 1)
        bonus = -int(bonus_str)

    # Parse "NdM" part
    if "d" in expr:
        parts = expr.split("d")
        count = int(parts[0]) if parts[0] else 1
        sides = int(parts[1])
    else:
        count = 1
        sides = int(expr)

    rolls = roll_dice(count, sides)
    total = sum(rolls) + bonus

    return {
        "count": count,
        "sides": sides,
        "bonus": bonus,
        "rolls": rolls,
        "total": total,
    }
