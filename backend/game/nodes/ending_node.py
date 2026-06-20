"""
ending_node — ENDING stage.
Resolves the current ending node label and creates a simple ending card.
The narrative text is already in chat from dm_response_node.
"""

from typing import Dict, Any
from datetime import datetime

from game.state import GameState


async def ending_node(state: GameState) -> Dict[str, Any]:
    """
    Ending stage: resolve ending label.
    Does NOT generate separate AI narration — the DM's final response
    (already in chat_history) serves as the ending narrative.
    Only resolves the ending node label for a simple popup.
    """
    ending_data = state.get("ending_data")
    if ending_data:
        # Already have ending data
        return {
            "stage": "ENDING",
            "ending_reached": True,
            "_route": "done",
        }

    # ── Resolve current node label (the ending name) ──
    current_node_id = state.get("current_node", "")
    plot_graph = state.get("plot_graph", {})
    plot_inspection = state.get("plot_inspection", {})

    ending_label = _resolve_ending_label(current_node_id, plot_graph, plot_inspection)

    script_title = state.get("script_title", "冒险")
    current_round = state.get("current_round", 0)

    ending = {
        "title": script_title,
        "endingLabel": ending_label,
        "currentRound": current_round,
        "timestamp": datetime.now().isoformat(),
    }

    print(f"[ending_node] Ending reached: '{ending_label}' (node={current_node_id})")

    return {
        "stage": "ENDING",
        "ending_reached": True,
        "ending_data": ending,
        "_route": "done",
    }


def _resolve_ending_label(
    current_node_id: str,
    plot_graph: dict,
    plot_inspection: dict,
) -> str:
    """Resolve the display name of the current ending node."""
    # Try plot_inspection node_names (UUID → label)
    if current_node_id and isinstance(plot_inspection, dict):
        node_names = plot_inspection.get("node_names", {})
        name = node_names.get(current_node_id, "")
        if name:
            return name

    # Try plot graph node label
    if current_node_id and plot_graph:
        for n in plot_graph.get("nodes", []):
            if isinstance(n, dict) and n.get("id") == current_node_id:
                label = n.get("label", "")
                if label:
                    return label
                nd = n.get("data", {}) if isinstance(n.get("data"), dict) else {}
                name = nd.get("name", "")
                if name and name not in ("新检查点", ""):
                    return name
                break

    return "故事结局"
