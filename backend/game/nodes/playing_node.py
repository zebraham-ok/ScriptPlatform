"""
playing_node — PLAYING stage main loop.
Collects player input, checks for triggers (checks/votes), and routes to
appropriate nodes (dm_response, check, vote, ending).
"""

from typing import Dict, Any, Literal

from langgraph.graph import END
from game.state import GameState


async def playing_node(state: GameState) -> Dict[str, Any]:
    """
    Main game loop node.
    Evaluates current state and determines next action:
    - New player messages → route to dm_response
    - Pending check → route to check_node
    - Pending vote → route to vote_node
    - Ending conditions met → route to ending_node
    - Waiting for more input → stay in playing
    """
    updates: Dict[str, Any] = {}

    current_round = state.get("current_round", 0)
    total_rounds = state.get("total_rounds", 15)
    ending_reached = state.get("ending_reached", False)
    mode = state.get("mode", "sandbox")

    # ── unified status block: current node & path ──
    plot_ins = state.get("plot_inspection", {})
    node_names = plot_ins.get("node_names", {}) if isinstance(plot_ins, dict) else {}
    label_to_id = plot_ins.get("label_to_id", {}) if isinstance(plot_ins, dict) else {}
    cn = state.get("current_node", "")
    cn_name = node_names.get(cn, cn or "起始")
    nh = state.get("node_history", [])
    nh_names = [node_names.get(n, n) for n in nh]
    trail = " → ".join(nh_names) if nh_names else "(无)"
    _node_switch_attempted: bool = False
    _node_switch_success: bool = False
    _node_switch_target: str = ""

    print(f"\n{'─'*55}")
    print(f"[回合 {current_round}] 🔵 模式: {mode}")
    print(f"  📍 当前节点: {cn_name}")
    print(f"  🗺️  已访问路径: {trail}")
    print(f"{'─'*55}")

    # Check round limit (sandbox mode only; script/import rely on plot end_checkpoints)
    if mode == "sandbox" and current_round >= total_rounds:
        updates["ending_reached"] = True
        updates["_route"] = "ending"
        return updates

    # Check plot-based ending (deferred: end after next DM response)
    current_node = state.get("current_node", "")
    end_checkpoints = state.get("end_checkpoints", [])
    if current_node and end_checkpoints and current_node in end_checkpoints:
        if state.get("_end_node_reached"):
            # Second pass: player sent another message after DM already narrated the ending
            updates["ending_reached"] = True
            updates["_route"] = "ending"
            return updates
        elif not state.get("_is_final_round") and not state.get("_final_narration_delivered"):
            # First time hitting end checkpoint: route to DM for elevated ceremony narration
            updates["_end_node_reached"] = True
            updates["_is_final_round"] = True  # Signal AI to deliver an elevated ending
            updates["_route"] = "dm_turn"
            print(f"[playing_node] 🎭 结局节点 [{cn_name}] 已到达，路由到 DM 生成最终仪式叙述")
            return updates
        # else: _is_final_round was set, _final_narration_delivered already done, let it fall through to ending check

    # Check ending data from DM
    if state.get("ending_data"):
        updates["ending_reached"] = True
        updates["_route"] = "ending"
        return updates

    # Check pending mechanics
    if state.get("pending_check"):
        updates["_route"] = "check"
        return updates

    if state.get("pending_vote"):
        updates["_route"] = "vote"
        return updates

    # Check for DM actions in the latest response
    dm_actions = state.get("dm_actions", [])
    has_node_update = False
    _scene_changed: bool = False
    for action in dm_actions:
        action_type = action.get("type", "")
        # Action may have a nested "params" dict, or the action itself IS the params
        params = action.get("params") or action

        # --- Handle change_scene action: switch scene/location without node change ---
        if action_type == "change_scene":
            if isinstance(params, dict):
                new_scene_name = params.get("name", "")
                new_scene_desc = params.get("description", "")
                if new_scene_name:
                    updates["scene"] = new_scene_name
                    updates["scene_description"] = new_scene_desc or updates.get("scene_description", state.get("scene_description", ""))
                    _scene_changed = True
                    print(f"[playing_node] 🏞️  场景切换 (非节点变更): → {new_scene_name}")
                    print(f"     场景描述: {new_scene_desc[:120] if new_scene_desc else '(沿用当前)'}")

        # --- Handle update_node action: advance plot node ---
        elif action_type == "update_node":
            target_node_id = params.get("nodeId", "") if isinstance(params, dict) else ""
            if target_node_id:
                from game.utils.script_loader import validate_node_transition
                plot_graph = state.get("plot_graph", {"nodes": [], "edges": []})
                current_node = state.get("current_node", "")

                # ⚠️ 容错：DM 可能返回 label（含｜分隔符）而非 UUID，统一解析
                if target_node_id not in node_names and target_node_id not in label_to_id:
                    # 尝试用 ｜ 切割（AI 有时会在 nodeId 后拼接场景描述）
                    if '｜' in target_node_id:
                        prefix = target_node_id.split('｜')[0].strip()
                        if prefix in label_to_id:
                            resolved = label_to_id[prefix]
                            print(f"  🔧 pipe-label→UUID: [{target_node_id}] → [{resolved}]")
                            target_node_id = resolved
                if target_node_id not in node_names and target_node_id in label_to_id:
                    resolved = label_to_id[target_node_id]
                    print(f"  🔧 label→UUID: [{target_node_id}] → [{resolved}]")
                    target_node_id = resolved
                if current_node and current_node not in node_names and current_node in label_to_id:
                    current_node = label_to_id[current_node]
                # 如果 current_node 也含 ｜，尝试解析
                if current_node and current_node not in node_names and current_node not in label_to_id:
                    if '｜' in current_node:
                        prefix = current_node.split('｜')[0].strip()
                        if prefix in label_to_id:
                            resolved = label_to_id[prefix]
                            print(f"  🔧 pipe-label current_node: [{current_node}] → [{resolved}]")
                            current_node = resolved

                _node_switch_attempted = True
                _node_switch_target = node_names.get(target_node_id, target_node_id)

                if validate_node_transition(current_node, target_node_id,
                                            plot_graph, plot_ins):
                    old_name = node_names.get(current_node, current_node or "起始")
                    new_name = node_names.get(target_node_id, target_node_id)
                    node_history = list(state.get("node_history", []))
                    node_history.append(target_node_id)
                    updates["current_node"] = target_node_id
                    updates["node_history"] = node_history
                    has_node_update = True
                    _node_switch_success = True
                    nh_after = [node_names.get(n, n) for n in node_history]
                    print(f"  🔄 节点切换: ✅ 成功")
                    print(f"     {old_name}  →  {new_name}")
                    print(f"  🗺️  新路径: {' → '.join(nh_after)}")
                else:
                    print(f"  🔄 节点切换: ❌ 失败")
                    print(f"     目标 [{_node_switch_target}] 不在当前节点的有效下一节点列表中")
        else:
            if action_type in ("roll_dice", "festival_check"):
                updates["pending_check"] = params
                updates["_route"] = "check"
                updates["dm_actions"] = []  # CLEAR to prevent re-processing on next round
                print(f"[playing_node] Routing to check for action: {action_type}")
                return updates
            if action_type == "start_vote":
                updates["pending_vote"] = params
                updates["_route"] = "vote"
                updates["dm_actions"] = []  # CLEAR to prevent re-processing on next round
                print(f"[playing_node] Routing to vote for action: {action_type}")
                return updates

    # ── node switch summary ──
    if not _node_switch_attempted:
        print(f"  🔄 节点切换: 未尝试 (DM 未请求 update_node)")

    # ── Handle DM modifications (addItem, lossItem, changeAttr) ──
    dm_mods = state.get("dm_modifications", [])
    if dm_mods:
        players = dict(state.get("players", {}))
        assigned_roles = state.get("assigned_roles", {})
        characters_data = state.get("characters_data", [])
        char_attrs = dict(state.get("character_attributes", {}))

        # Build name→characterId mapping
        name_to_cid = {}
        for c in characters_data:
            if isinstance(c, dict):
                name_to_cid[c.get("name", "").strip()] = c.get("id", "")
                # Also map label if different from name
                label = c.get("label", "")
                if label and label != c.get("name", ""):
                    name_to_cid[label.strip()] = c.get("id", "")

        # Build characterId→playerSid mapping
        cid_to_sid = {cid: psid for cid, psid in assigned_roles.items()}

        print(f"[playing_node] 📦 处理 DM 修改 ({len(dm_mods)} 条):")

        for mod in dm_mods:
            mod_type = mod.get("type", "")
            params = mod.get("params", {})
            person = params.get("person", "").strip()

            # Resolve person → characterId
            cid = person if person in cid_to_sid else name_to_cid.get(person, "")
            if not cid:
                print(f"[playing_node] ⚠️ 无法解析角色 '{person}'（可用角色: {list(name_to_cid.keys())}），跳过修改")
                continue

            psid = cid_to_sid.get(cid, "")
            pdata = dict(players.get(psid, {})) if psid else {}

            if mod_type == "addItem":
                inv = list(pdata.get("inventory", []))
                new_item = {
                    "name": params.get("item", ""),
                    "description": params.get("description", ""),
                }
                inv.append(new_item)
                players[psid] = {**pdata, "inventory": inv}
                print(f"  📦 {person} 获得物品: {new_item['name']}")

            elif mod_type == "lossItem":
                inv = list(pdata.get("inventory", []))
                item_name = params.get("item", "")
                new_inv = [i for i in inv if (i.get("name") if isinstance(i, dict) else i) != item_name]
                if len(new_inv) < len(inv):
                    players[psid] = {**pdata, "inventory": new_inv}
                    print(f"  🗑️ {person} 失去物品: {item_name}")
                else:
                    print(f"  ⚠️ {person} 背包中未找到物品 '{item_name}'")

            elif mod_type == "changeAttr":
                attr_name = params.get("attr", "")
                amount_val = params.get("amount", 0)
                try:
                    amount_val = int(amount_val)
                except (ValueError, TypeError):
                    amount_val = 0
                if cid in char_attrs:
                    old_val = char_attrs[cid].get(attr_name, 0)
                    char_attrs[cid] = dict(char_attrs[cid])
                    char_attrs[cid][attr_name] = old_val + amount_val
                    sign = "+" if amount_val >= 0 else ""
                    print(f"  🔧 {person} 属性 '{attr_name}': {old_val} → {old_val + amount_val} ({sign}{amount_val})")
                else:
                    print(f"  ⚠️ 角色 '{cid}' 无属性数据，无法修改")

        updates["players"] = players
        updates["character_attributes"] = char_attrs
        updates["dm_modifications"] = []  # clear after processing

    # Clear dm_actions after processing
    if dm_actions and not updates.get("_route"):
        updates["dm_actions"] = []

    # Check if we need DM response (new messages)
    chat = state.get("chat_history", [])
    if chat and len(chat) > 0:
        last_msg = chat[-1] if isinstance(chat[-1], dict) else {"role": "unknown"}
        if last_msg.get("role") == "player":
            updates["_route"] = "dm_turn"
            return updates
    else:
        print(f"[playing_node] chat_history is EMPTY or not a list")

    # Check if it's a new round that needs DM narration
    if state.get("_need_dm_narration"):
        updates["_route"] = "dm_turn"
        updates["_need_dm_narration"] = False
        return updates

    # Default: wait for more input
    updates["_route"] = "wait"
    return updates


def playing_condition(state: GameState) -> str:
    """Conditional edge function for routing from playing node."""
    route = state.get("_route", "wait")

    route_map = {
        "dm_turn": "dm_response",
        "check": "check",
        "vote": "vote",
        "ending": "ending",
        "wait": END,  # stop graph, wait for external input
    }

    return route_map.get(route, END)
