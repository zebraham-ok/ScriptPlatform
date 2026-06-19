"""
vote_node — VOTE stage.
Handles player voting mechanics.
Migrated from BUMENGweb-main manager.py start_vote.
"""

from typing import Dict, Any
from datetime import datetime

from game.state import GameState


async def vote_node(state: GameState) -> Dict[str, Any]:
    """
    Handle a player vote.
    1. Parse pending_vote for options and conditions
    2. Collect votes from players (via Socket.IO events in production)
    3. Determine the winning option
    """
    pending = state.get("pending_vote", {})

    if not pending:
        return {"dice_result": None, "pending_vote": None, "_route": "done"}

    vote_name = pending.get("name", "投票")
    options = pending.get("options", [])

    # In production, votes are collected via Socket.IO events.
    # For now, we structure the vote and let the game_server handle collection.
    vote_result = {
        "name": vote_name,
        "options": options,
        "results": state.get("vote_results", {}),
        "timestamp": datetime.now().isoformat(),
    }

    # Check if all required players have voted
    assigned_roles = state.get("assigned_roles", {})
    vote_results = state.get("vote_results", {})
    total_players = len(assigned_roles)
    total_votes = len(vote_results)

    # If all players have voted, determine winner
    if total_votes >= total_players and total_players > 0:
        # Find most voted option
        if vote_results:
            winning_option = max(vote_results, key=vote_results.get)
            vote_result["winner"] = winning_option
            vote_result["complete"] = True

    updates: Dict[str, Any] = {
        "dice_result": vote_result,
        "pending_vote": None if vote_result.get("complete") else pending,
        "vote_results": {} if vote_result.get("complete") else vote_results,
        "_route": "done",
    }

    return updates
