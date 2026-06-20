"""GameState TypedDict — the central state passed through all LangGraph nodes."""

from typing import TypedDict, List, Dict, Optional, Any, Set


class MessageDict(TypedDict, total=False):
    role: str        # "dm" | "player" | "system"
    sender: str      # character name or "DM"
    content: str
    timestamp: str


class GameState(TypedDict, total=False):
    # === 房间信息 ===
    room_id: str
    room_name: str
    mode: str                          # "sandbox" | "script" | "import"
    owner_sid: str

    # === 玩家 ===
    players: Dict[str, dict]           # {sid: {playerId, nickname, characterId, ...}}
    player_count: int
    assigned_roles: Dict[str, str]     # {characterId: sid}
    available_roles: List[str]         # unassigned character IDs
    ready_players: Set[str]            # ready player sids

    # === 阶段 ===
    stage: str                         # "LOBBY" | "GENERATE" | "JSON_LOAD" | "PLAYING" | "ENDING"
    current_round: int                 # current round number
    total_rounds: int                  # total rounds

    # === 沙盒模式 ===
    suggestions: List[str]             # player worldview suggestions
    role_prefs: Dict[str, str]         # player role prefs {playerId: preference}

    # === 剧本数据（script/import 模式从 JSON 加载） ===
    script_title: str
    world_setting: List[dict]          # worldview text blocks
    characters_data: List[dict]        # character definitions
    locations_data: List[dict]         # location definitions
    items_data: List[dict]             # item definitions
    plot_graph: dict                   # plot node graph
    mechanics_checks: List[dict]       # check definitions
    mechanics_votes: List[dict]        # vote definitions
    character_attributes: Dict[str, Dict[str, int]]  # {characterId: {attrName: value}}

    # === 剧本模式运行时 ===
    current_node: str                  # current plot node ID
    node_history: List[str]            # visited node IDs

    # === 场景 ===
    scene: str                         # current scene name
    scene_description: str             # scene description
    scene_image: Optional[str]         # scene image base64/url
    opening_narration: str             # AI-generated DM opening (markdown)

    # === 游戏运行时 ===
    inventory: List[dict]              # player inventory
    chat_history: list  # all messages (custom dicts, managed externally; plain list = replacement semantics)
    long_term_memory: dict             # {player_memory: {name: str}, npc_memory: {name: str}, global_note: str}
    plot_inspection: dict              # DM director notes

    # === 多人轮次管理 ===
    turn_number: int                   # current turn number
    turn_timeout_seconds: int          # turn timeout (default 120s)
    players_acted_this_turn: Set[str]  # players who acted this turn
    players_skipped_this_turn: Set[str]  # players who skipped this turn
    turn_started_at: Optional[float]   # turn start timestamp

    # === DM 状态 ===
    dm_response: str                   # current DM narration
    dm_actions: List[dict]             # AI action list [{type, params}]
    dm_options: List[str]              # quick options for players
    dm_modifications: List[dict]       # AI modifications: addItem/lossItem/changeAttr
    private_messages: Dict[str, str]   # {sid: message} DM private messages

    # === 检定/投票 ===
    pending_check: Optional[dict]      # pending check definition
    pending_vote: Optional[dict]       # pending vote definition
    dice_result: Optional[dict]        # latest dice result
    vote_results: Dict[str, int]       # {option: count}

    # === 内部路由 ===
    _route: str                        # routing hint: "start" | "wait" | "dm_turn" | "check" | "vote" | "ending" | "done"
    _need_dm_narration: bool           # flag for new-round DM narration
    _lobby_ready: bool                 # flag: lobby initialization done
    _needs_role_select: bool           # flag: role selection needed (set by opening_node)
    _role_details: List[dict]          # role detail list for frontend role selection UI
    _scene_image_prompt: str           # AI image prompt for scene background
    _opening_pending: bool             # flag: AI opening narration generation pending
    _opening_prompt_data: Optional[dict]  # cached prompt data for retry

    # === 结局 ===
    ending_reached: bool
    ending_data: Optional[dict]        # ending content
    _end_node_reached: bool            # deferred ending flag: end checkpoint hit, end after next DM response
    _is_final_round: bool              # flag: AI should deliver an elevated, ceremonial final narration
    _final_narration_delivered: bool   # flag: ceremony narration has been generated, can now end
    end_checkpoints: List[str]         # plot end checkpoint node IDs
