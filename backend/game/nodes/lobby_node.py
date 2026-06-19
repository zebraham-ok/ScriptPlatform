"""
lobby_node — LOBBY stage.
Collects player worldview/role preferences.
Transitions to route_game when the owner starts the game.
"""

from datetime import datetime
from typing import Dict, Any
from game.state import GameState


async def lobby_node(state: GameState) -> Dict[str, Any]:
    """
    LOBBY node: waits for players to join and submit preferences.
    Returns state updates for newly submitted preferences.
    """
    updates: Dict[str, Any] = {}

    # Ensure default values
    if not state.get("suggestions"):
        updates["suggestions"] = []
    if not state.get("role_prefs"):
        updates["role_prefs"] = {}
    if not state.get("ready_players"):
        updates["ready_players"] = set()
    if not state.get("stage"):
        updates["stage"] = "LOBBY"

    # In production, this node is driven by Socket.IO events.
    # For now, it just ensures state is initialized.
    updates["_lobby_ready"] = True

    return updates
