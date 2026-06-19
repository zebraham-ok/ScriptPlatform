"""
wait_players_node — WAIT_PLAYERS stage (multiplayer core).
Waits for all online players to submit their actions each turn.
Supports turn timeout and auto-skip for disconnected players.
"""

import asyncio
import time
from typing import Dict, Any, Set

from langgraph.graph import END
from game.state import GameState


async def wait_players_node(state: GameState) -> Dict[str, Any]:
    """
    Multiplayer turn synchronization node.
    
    After DM narration, waits for all players to act.
    - Each player sends their action via Socket.IO
    - Players can explicitly skip their turn
    - Timeout auto-skips unresponsive players
    - When only 1 player remains unacted, timeout shortens to 60s
    - Room owner can extend time (+30s, max 3 times)
    """
    players = state.get("players", {})
    assigned_roles = state.get("assigned_roles", {})
    acted = state.get("players_acted_this_turn", set())
    skipped = state.get("players_skipped_this_turn", set())
    timeout = state.get("turn_timeout_seconds", 120)

    # Determine which players need to act
    active_players = set()
    for sid, pdata in players.items():
        if sid in assigned_roles.values() or True:  # All players need to act
            active_players.add(sid)

    total_active = len(active_players)
    if total_active == 0:
        # No active players, proceed immediately
        return _build_turn_summary(state, "no_players")

    # Already all acted/skipped
    unacted = active_players - acted - skipped
    if not unacted:
        return _build_turn_summary(state, "all_acted")

    # Adjust timeout if only 1 player remains unacted
    remaining = len(unacted)
    effective_timeout = min(timeout, 60) if remaining <= 1 else timeout

    # In production, this node is driven by Socket.IO events.
    # The actual waiting happens in game_server.py via asyncio events.
    # Here we set up the state for the game_server to manage.

    turn_started = time.time()
    updates: Dict[str, Any] = {
        "_wait_started": turn_started,
        "_wait_timeout": effective_timeout,
        "_wait_active_players": list(active_players),
        "_wait_unacted": list(unacted),
        "turn_started_at": turn_started,
        "turn_timeout_seconds": effective_timeout,
        "turn_number": state.get("turn_number", 0),
    }

    # Signal game_server that we're waiting
    updates["_route"] = "waiting"

    return updates


def _build_turn_summary(state: GameState, reason: str) -> Dict[str, Any]:
    """Build state updates when the turn wait is complete."""
    return {
        "players_acted_this_turn": set(),
        "players_skipped_this_turn": set(),
        "turn_started_at": None,
        "turn_number": state.get("turn_number", 0) + 1,
        "_route": "continue",
        "_turn_reason": reason,
    }


def wait_condition(state: GameState) -> str:
    """Conditional edge function for routing from wait_players."""
    route = state.get("_route", "continue")

    # Check if game should end (all players disconnected, etc.)
    players = state.get("players", {})
    if not players:
        return "ending"

    if route == "waiting":
        return END  # stop graph, wait for external player actions

    if route == "continue":
        return "continue"

    if route == "ending":
        return "ending"

    return "continue"
