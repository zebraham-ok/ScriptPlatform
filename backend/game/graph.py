"""
LangGraph state graph assembly.
Defines the complete game state machine with all nodes and edges.
"""

from langgraph.graph import StateGraph, END
from langgraph.checkpoint.memory import MemorySaver

from game.state import GameState
from game.nodes import (
    lobby_node,
    generate_node,
    json_load_node,
    opening_node,
    playing_node,
    dm_response_node,
    check_node,
    vote_node,
    wait_players_node,
    ending_node,
)
from game.nodes.opening_node import opening_condition
from game.nodes.playing_node import playing_condition
from game.nodes.wait_players_node import wait_condition


def route_condition(state: GameState) -> str:
    """Conditional routing after LOBBY: determines script generation path."""
    mode = state.get("mode", "sandbox")
    if mode == "sandbox":
        return "sandbox"
    elif mode in ("script", "import"):
        return "script"
    return "sandbox"  # default


def build_graph(checkpointer=None) -> StateGraph:
    """
    Build and compile the LangGraph state graph for the DM engine.
    Returns a compiled graph ready for invocation.
    """
    builder = StateGraph(GameState)

    # Add nodes
    builder.add_node("lobby", lobby_node)
    builder.add_node("generate", generate_node)
    builder.add_node("json_load", json_load_node)
    builder.add_node("opening", opening_node)
    builder.add_node("playing", playing_node)
    builder.add_node("dm_response", dm_response_node)
    builder.add_node("check", check_node)
    builder.add_node("vote", vote_node)
    builder.add_node("wait_players", wait_players_node)
    builder.add_node("ending", ending_node)

    # Set entry point
    builder.set_entry_point("lobby")

    # Lobby → Route → Generate/JSON_Load
    builder.add_conditional_edges(
        "lobby",
        route_condition,
        {
            "sandbox": "generate",
            "script": "json_load",
        }
    )

    # Generate/JSON_Load → Opening
    builder.add_edge("generate", "opening")
    builder.add_edge("json_load", "opening")

    # Opening → Playing (only if no role selection needed)
    # → END (wait for role selection + ready → external _invoke_graph)
    builder.add_conditional_edges(
        "opening",
        opening_condition,
        {
            "playing": "playing",
            "__end__": END,
        }
    )

    # Playing → DM_Response / Check / Vote / Ending / END (wait for input)
    builder.add_conditional_edges(
        "playing",
        playing_condition,
        {
            "dm_response": "dm_response",
            "check": "check",
            "vote": "vote",
            "ending": "ending",
            END: END,  # wait for external input
        }
    )

    # DM_Response → Wait_Players
    builder.add_edge("dm_response", "wait_players")

    # Check → Wait_Players
    builder.add_edge("check", "wait_players")

    # Vote → Wait_Players
    builder.add_edge("vote", "wait_players")

    # Wait_Players → Playing / Ending / END (wait for player actions)
    builder.add_conditional_edges(
        "wait_players",
        wait_condition,
        {
            "continue": "playing",
            "ending": "ending",
            END: END,  # wait for external player actions
        }
    )

    # Ending → END
    builder.add_edge("ending", END)

    # Compile with checkpoint support
    if checkpointer is None:
        checkpointer = MemorySaver()

    graph = builder.compile(checkpointer=checkpointer)
    return graph


# Default graph instance (each room should create its own)
_default_graph = None


def get_default_graph() -> StateGraph:
    """Get or create the default compiled graph."""
    global _default_graph
    if _default_graph is None:
        _default_graph = build_graph()
    return _default_graph


def create_room_graph() -> StateGraph:
    """Create a new graph instance for a room (with isolated MemorySaver)."""
    checkpointer = MemorySaver()
    return build_graph(checkpointer=checkpointer)
