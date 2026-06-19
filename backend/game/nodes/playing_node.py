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
    print(f"[playing_node] Entered: _route={state.get('_route', '?')}, "
          f"chat_history_len={len(state.get('chat_history', []))}, "
          f"current_round={state.get('current_round', 0)}")
    
    updates: Dict[str, Any] = {}

    current_round = state.get("current_round", 0)
    total_rounds = state.get("total_rounds", 15)
    ending_reached = state.get("ending_reached", False)

    # Check round limit
    if current_round >= total_rounds:
        updates["ending_reached"] = True
        updates["_route"] = "ending"
        return updates

    # Check plot-based ending
    current_node = state.get("current_node", "")
    end_checkpoints = state.get("end_checkpoints", [])
    if current_node and end_checkpoints and current_node in end_checkpoints:
        updates["ending_reached"] = True
        updates["_route"] = "ending"
        return updates

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
                plot_inspection = state.get("plot_inspection", {})
                current_node = state.get("current_node", "")
                node_names = plot_inspection.get("node_names", {})
                label_to_id = plot_inspection.get("label_to_id", {})

                # ⚠️ 容错：DM 可能返回 label 而非 UUID，统一解析
                if target_node_id not in node_names and target_node_id in label_to_id:
                    resolved = label_to_id[target_node_id]
                    print(f"[plot节点推进] 🔧 label→UUID: [{target_node_id}] → [{resolved}]")
                    target_node_id = resolved
                # 同时确保 current_node 是 UUID
                if current_node and current_node not in node_names and current_node in label_to_id:
                    current_node = label_to_id[current_node]

                if validate_node_transition(current_node, target_node_id,
                                            plot_graph, plot_inspection):
                    old_name = node_names.get(current_node, current_node or "起始")
                    new_name = node_names.get(target_node_id, target_node_id)
                    node_history = list(state.get("node_history", []))
                    node_history.append(target_node_id)
                    updates["current_node"] = target_node_id
                    updates["node_history"] = node_history
                    has_node_update = True
                    print(f"\n{'='*60}")
                    print(f"[plot节点推进] 🎬 剧情推进！")
                    print(f"  从节点: [{current_node}] {old_name}")
                    print(f"  到节点: [{target_node_id}] {new_name}")
                    print(f"  已访问路径: {' → '.join(node_history)}")
                    print(f"{'='*60}\n")
                else:
                    print(f"\n[plot节点推进] ⚠️ 非法节点切换被拒绝: "
                          f"[{current_node}] → [{target_node_id}]，"
                          f"target不在有效下一节点列表中\n")
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

    # Clear dm_actions after processing (keep node_update visible for log)
    if dm_actions and not updates.get("_route"):
        updates["dm_actions"] = []
        if not has_node_update:
            print(f"[playing_node] Cleared stale dm_actions: {dm_actions}")

    # Check if we need DM response (new messages)
    chat = state.get("chat_history", [])
    if chat and len(chat) > 0:
        last_msg = chat[-1] if isinstance(chat[-1], dict) else {"role": "unknown"}
        print(f"[playing_node] Last chat message: role={last_msg.get('role', '?')}, "
              f"sender={last_msg.get('sender', '?')}, "
              f"content={(last_msg.get('content', '') or '')[:60]}, "
              f"chat_len={len(chat)}")
        # If last message is from a player, route to DM
        if last_msg.get("role") == "player":
            print(f"[playing_node] New player message detected: "
                  f"role={last_msg.get('role')}, sender={last_msg.get('sender')}, "
                  f"content={last_msg.get('content', '')[:50]}, "
                  f"chat_len={len(chat)}")
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
