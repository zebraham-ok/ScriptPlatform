"""
Context builder — constructs AI prompts from game state.
Migrated from BUMENGweb-main plot_management.py and context building logic.
"""

from typing import Dict, Any, List
from game.state import GameState


def build_dm_context(state: GameState) -> str:
    """
    Build a comprehensive context prompt for the DM AI.
    Includes: script info, current scene, character info,
    chat history, plot progress, and DM notes.
    """
    parts = []

    # Script info
    title = state.get("script_title", "未知剧本")
    parts.append(f"剧本：《{title}》")

    # Current scene
    scene = state.get("scene_description", state.get("scene", ""))
    if scene:
        parts.append(f"当前场景：{scene[:500]}")

    # Current round
    current_round = state.get("current_round", 1)
    total_rounds = state.get("total_rounds", 15)
    parts.append(f"回合：{current_round}/{total_rounds}")

    # Characters
    characters = state.get("characters_data", [])
    if characters:
        char_lines = []
        for c in characters:
            if isinstance(c, dict):
                name = c.get("name", c.get("id", "?"))
                desc = c.get("description", "")[:80]
                attrs = c.get("attributes", {})
                attr_str = ", ".join(f"{k}:{v}" for k, v in attrs.items()) if attrs else ""
                char_lines.append(f"  - {name}：{desc}" + (f" [{attr_str}]" if attr_str else ""))
            elif isinstance(c, str):
                char_lines.append(f"  - {c}")
        if char_lines:
            parts.append("角色：\n" + "\n".join(char_lines))

    # Locations
    locations = state.get("locations_data", [])
    if locations:
        loc_lines = []
        for loc in locations[:5]:
            if isinstance(loc, dict):
                loc_lines.append(f"  - {loc.get('name', '?')}: {loc.get('description', '')[:80]}")
        if loc_lines:
            parts.append("地点：\n" + "\n".join(loc_lines))

    # Items / inventory
    items = state.get("items_data", [])
    inventory = state.get("inventory", [])
    all_items = items + inventory
    if all_items:
        item_lines = []
        for it in all_items[:10]:
            if isinstance(it, dict):
                item_lines.append(f"  - {it.get('name', '?')}: {it.get('description', '')[:80]}")
        if item_lines:
            parts.append("物品：\n" + "\n".join(item_lines))

    # Plot progress — with full node advancement info (labels only, no UUIDs)
    current_node = state.get("current_node", "")
    node_history = state.get("node_history", [])
    plot_graph = state.get("plot_graph", {"nodes": [], "edges": []})
    plot_inspection = state.get("plot_inspection", {})

    # Build entity resolvers for triggerConditions (id → name)
    entity_names = {}
    for c in characters:
        if isinstance(c, dict):
            eid = c.get("id", "")
            name = c.get("name", c.get("label", eid))
            entity_names[f"character:{eid}"] = f"角色「{name}」"
            entity_names[eid] = f"角色「{name}」"
    for loc in locations:
        if isinstance(loc, dict):
            eid = loc.get("id", "")
            name = loc.get("name", loc.get("label", eid))
            entity_names[f"location:{eid}"] = f"地点「{name}」"
            entity_names[eid] = f"地点「{name}」"
    for it in items:
        if isinstance(it, dict):
            eid = it.get("id", "")
            name = it.get("name", it.get("label", eid))
            entity_names[f"item:{eid}"] = f"物品「{name}」"
            entity_names[eid] = f"物品「{name}」"

    bound_check_ids = []  # collected from current node, used later in mechanics section

    if current_node or plot_graph.get("nodes"):
        from game.utils.script_loader import get_node_advancement_info
        node_info = get_node_advancement_info(current_node, plot_graph, plot_inspection)
        node_names_map = plot_inspection.get("node_names", {})

        # Current node (label only)
        current_name = node_info.get("current_node_name", current_node or "?")
        parts.append(f"📍 当前剧情节点：{current_name}")

        # Current node's own potential actions (what the player can do NOW)
        curr_data = node_info.get("current_node_data", {})
        curr_actions = curr_data.get("potentialActions", {})
        if curr_actions and isinstance(curr_actions, dict):
            action_lines = []
            for action, result in curr_actions.items():
                action_lines.append(f"    · {action.strip()} → {result[:60]}")
            if action_lines:
                parts.append("🎯 当前节点可选行动：\n" + "\n".join(action_lines))

        # Current node's bound checks — these MUST be considered at this node
        bound_check_ids = curr_data.get("boundChecks", [])
        if bound_check_ids:
            mechanics_checks = state.get("mechanics_checks", [])
            checks_index = {}
            for ch in mechanics_checks:
                if isinstance(ch, dict):
                    checks_index[ch.get("id", "")] = ch

            bound_lines = []
            for chk_id in bound_check_ids:
                chk = checks_index.get(chk_id, {})
                if chk:
                    name = chk.get("name", chk_id)
                    target = chk.get("checkTarget", "?")
                    diff = chk.get("difficulty", 5)
                    desc = chk.get("triggerCondition", "")
                    success = chk.get("successEffect", "")
                    failure = chk.get("failureEffect", "")
                    bound_lines.append(
                        f"  ⚡ {name}\n"
                        f"     检定属性：{target}  难度：{diff}\n"
                        f"     触发条件：{desc}\n"
                        f"     成功→{success}" + (f"  失败→{failure}" if failure else "")
                    )
            if bound_lines:
                parts.append("⚡ 当前节点绑定检定（当剧情推进到此节点时务必触发）：\n" + "\n".join(bound_lines))

        # Node history trail
        if node_history:
            trail_names = []
            for nid in node_history[-5:]:
                name = node_names_map.get(nid, nid)
                trail_names.append(name)
            parts.append(f"🛤️ 已访问路径：{' → '.join(trail_names)}")

        # Available next nodes (labels only, with trigger info)
        next_nodes = node_info.get("next_nodes", [])
        if next_nodes:
            next_lines = []
            for idx, nn in enumerate(next_nodes):
                name = nn['name']
                node_parts = [f"  {idx+1}. {name}"]
                
                # Show what this next node is about
                scene = nn.get("scene_desc", "")
                if scene:
                    node_parts.append(f"     场景：{scene}")
                
                # Show trigger conditions resolved to entity names
                triggers = nn.get("trigger_conditions", [])
                if triggers:
                    resolved = []
                    for t in triggers:
                        resolved.append(entity_names.get(t, t))
                    if resolved:
                        node_parts.append(f"     关联实体：{'，'.join(resolved)}")
                
                # Show potential actions inside the next node
                actions = nn.get("potential_actions", {})
                if actions and isinstance(actions, dict):
                    for action, result in actions.items():
                        node_parts.append(f"     · {action.strip()} → {result[:60]}")
                
                # DM note
                note = nn.get("dm_note", "")
                if note:
                    node_parts.append(f"     DM备注：{note[:120]}")
                
                next_lines.append("\n".join(node_parts))
            
            parts.append("🔜 可推进到的节点（切换时请使用节点完整名称作为nodeId）：\n" + "\n".join(next_lines))
        else:
            if not node_info.get("is_ending"):
                parts.append("🔜 可推进到的节点：（当前节点无出边，DM可自由推进到任意节点）")
    elif node_history:
        trail_names = []
        for nid in node_history[-5:]:
            name = plot_inspection.get("node_names", {}).get(nid, nid)
            trail_names.append(name)
        parts.append(f"已访问剧情节点：{' → '.join(trail_names)}")
    elif current_node:
        name = plot_inspection.get("node_names", {}).get(current_node, current_node)
        parts.append(f"当前剧情节点：{name}")

    # Mechanics — show all checks with full detail, excluding ones already bound to current node
    mechanics_checks = state.get("mechanics_checks", [])
    if mechanics_checks:
        # Collect bound check IDs from current node to avoid duplication
        curr_bound = set(bound_check_ids) if bound_check_ids else set()
        check_lines = []
        for ch in mechanics_checks:
            if isinstance(ch, dict):
                ch_id = ch.get("id", "")
                if ch_id in curr_bound:
                    continue  # already shown in bound checks section above
                success = ch.get("successEffect", "")
                failure = ch.get("failureEffect", "")
                line = (
                    f"  - {ch.get('name', '')}\n"
                    f"    触发条件：{ch.get('triggerCondition', '')}\n"
                    f"    检定属性：{ch.get('checkTarget', '')}  难度：{ch.get('difficulty', 5)}\n"
                    f"    成功→{success}" + (f"  失败→{failure}" if failure else "")
                )
                check_lines.append(line)
        if check_lines:
            parts.append("📋 全部可用检定（当前节点已绑定检定的详情见上方⚡部分）：\n" + "\n".join(check_lines))

    # Chat history (recent)
    chat = state.get("chat_history", [])
    if chat:
        recent = chat[-12:] if len(chat) > 12 else chat
        print(f"[context_builder] === CHAT HISTORY ({len(chat)} total, using last {len(recent)}) ===")
        chat_lines = []
        for i, msg in enumerate(recent):
            if isinstance(msg, dict):
                role = msg.get("role", "")
                content = msg.get("content", "")
                sender = msg.get("sender", "")
                label = "DM" if role == "dm" else sender or "玩家"
                chat_lines.append(f"{label}：{content[:150]}")
                print(f"  [{i}] {label}: {content[:120]}")
        print(f"[context_builder] === END CHAT HISTORY ===")
        if chat_lines:
            parts.append("近期对话：\n" + "\n".join(chat_lines))
    else:
        print(f"[context_builder] chat_history is EMPTY!")

    # ── Final round: elevated ending ceremony ──
    is_final_round = state.get("_is_final_round", False)
    if is_final_round:
        title = state.get("script_title", "剧本")
        ceremony_prompt = f"""🎭 **这是结局对话！故事即将落幕！**

当前已抵达《{title}》的最终节点。这是你作为DM的最后一次叙述，请以一定的仪式感完成这场演出，或是回顾，或是展望，或是含蓄。
⚠️ 这之后游戏将正式结束，请给出一次完整、饱满、有分量的最终叙述，字数250-500字。"""
        parts.append(ceremony_prompt)

    # DM notes
    plot_inspection = state.get("plot_inspection", {})
    if isinstance(plot_inspection, dict):
        notes = plot_inspection.get("dm_notes", "")
        if notes:
            parts.append(f"DM注意事项：{notes[:300]}")

    # Player actions this turn
    players_acted = state.get("players_acted_this_turn", set())
    players = state.get("players", {})
    assigned_roles = state.get("assigned_roles", {})

    if players_acted and len(players) > 1:
        # Multiplayer: list each player's action with their character name
        action_lines = []
        for sid in players_acted:
            pdata = players.get(sid, {})
            char_id = pdata.get("characterId", "")
            char_name = ""
            for cid, name_data in state.get("characters_data", []):
                if isinstance(name_data, dict) and name_data.get("id") == char_id:
                    char_name = name_data.get("name", char_id)
                    break
            action_lines.append(f"  {char_name}({pdata.get('nickname', '?')})：已行动")
        if action_lines:
            parts.append("本轮已行动的玩家：\n" + "\n".join(action_lines))

    # Prompt the DM
    instruction = """
请作为DM，根据以上信息推进剧情。你可以：
1. 描述场景变化、NPC反应、环境细节
2. 在合适时机触发检定（使用 ##ACTIONS## 标记）
3. 提供玩家可选的行动方向（使用 ##OPTIONS## 标记）
4. 向特定玩家发送私密信息（使用 ##PRIVATE## 标记）

请保持叙述生动、氛围到位，字数控制在200-400字。"""

    parts.append(instruction)

    return "\n\n".join(parts)


def summarize_history(state: GameState, max_messages: int = 20) -> str:
    """Create a condensed summary of recent chat history."""
    chat = state.get("chat_history", [])
    if not chat:
        return "（暂无对话记录）"

    recent = chat[-max_messages:] if len(chat) > max_messages else chat
    lines = []
    for msg in recent:
        if isinstance(msg, dict):
            role = msg.get("role", "")
            content = msg.get("content", "")
            sender = msg.get("sender", "")
            label = "DM" if role == "dm" else sender or "玩家"
            lines.append(f"[{label}] {content[:100]}")
    return "\n".join(lines)
