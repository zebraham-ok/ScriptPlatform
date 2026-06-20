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
        else:
            # First time hitting end checkpoint: allow one more DM response cycle
            updates["_end_node_reached"] = True
            print(f"[playing_node] ⚠️ 结局节点 [{cn_name}] 已到达，下一轮对话后结束游戏")

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
    for action in dm_actions:
        action_type = action.get("type", "")
        # Action may have a nested "params" dict, or the action itself IS the params
        params = action.get("params") or action

        # --- Handle update_node action: advance plot node ---
        if action_type == "update_node":
            target_node_id = params.get("nodeId", "") if isinstance(params, dict) else ""
            if target_node_id:
                from game.utils.script_loader import validate_node_transition
                plot_graph = state.get("plot_graph", {"nodes": [], "edges": []})
                current_node = state.get("current_node", "")

                # ⚠️ 容错：DM 可能返回 label 而非 UUID，统一解析
                if target_node_id not in node_names and target_node_id in label_to_id:
                    resolved = label_to_id[target_node_id]
                    print(f"  🔧 label→UUID: [{target_node_id}] → [{resolved}]")
                    target_node_id = resolved
                if current_node and current_node not in node_names and current_node in label_to_id:
                    current_node = label_to_id[current_node]

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
