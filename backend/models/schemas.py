"""Pydantic models for project data."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime


class Position(BaseModel):
    x: float = 0
    y: float = 0


class NodeData(BaseModel):
    id: str
    type: str  # 'character' | 'location' | 'checkpoint'
    label: str
    position: Position = Field(default_factory=Position)
    data: Dict[str, Any] = Field(default_factory=dict)


# === Character-specific NodeData (for type-safe playable-role config) ===

class AttributeConstraint(BaseModel):
    """Constraint for player-customizable attributes."""
    sum_min: Optional[int] = None     # 总属性值下限
    sum_max: Optional[int] = None     # 总属性值上限
    individual_min: Optional[int] = None  # 单项最小值
    individual_max: Optional[int] = None  # 单项最大值


class CharacterNodeData(BaseModel):
    """Strongly-typed character node data used in editor character panel.
    Stored inside NodeData.data dict; also usable standalone for validation.
    """
    # Basic character info
    name: str = ""
    description: str = ""
    personality: str = ""
    appearance: str = ""
    background: str = ""
    motivation: str = ""

    # Attributes (name → description or initial value)
    attributes: Dict[str, Any] = Field(default_factory=dict)

    # === Playable role config (multiplayer) ===
    is_playable: bool = False             # 是否可作为玩家扮演角色
    min_players: int = 0                  # 最少需要几位扮演者 (0=不限制)
    max_players: int = 1                  # 最多容纳几位扮演者

    # === Player-customizable attribute config ===
    customizable_attributes: List[str] = Field(default_factory=list)  # 哪些属性可由玩家自定
    attribute_constraints: Optional[AttributeConstraint] = None       # 属性约束

    # === Custom fields (catch-all for any extra data) ===
    extra: Dict[str, Any] = Field(default_factory=dict)


class EdgeData(BaseModel):
    id: str
    source: str
    target: str
    label: str = ""
    data: Dict[str, Any] = Field(default_factory=dict)


class GraphData(BaseModel):
    nodes: List[NodeData] = Field(default_factory=list)
    edges: List[EdgeData] = Field(default_factory=list)


class WorldBlock(BaseModel):
    id: str
    title: str = ""
    content: str = ""


class PlotData(BaseModel):
    initialCheckpoint: str = ""
    endCheckpoints: List[str] = Field(default_factory=list)
    graph: GraphData = Field(default_factory=GraphData)


class CharacterParamDefinition(BaseModel):
    """世界观中的人物参数定义：分类或数值型，设置后所有人物的自定义属性中都会出现。"""
    name: str = ""
    paramType: str = "number"  # "category" | "number"
    categories: List[str] = Field(default_factory=list)  # 分类的类别选项
    minValue: float = 0.0
    maxValue: float = 10.0


class CheckDefinition(BaseModel):
    """检定定义：触发条件、难度、说明、成功影响、失败影响"""
    id: str = ""
    name: str = ""
    triggerCondition: str = ""
    difficulty: int = 5
    checkTarget: str = ""  # 检定对象：指向世界观中人物数值参数的名称
    description: str = ""
    successEffect: str = ""
    failureEffect: str = ""


class VoteDefinition(BaseModel):
    """投票定义：选项、参与条件"""
    id: str = ""
    name: str = ""
    options: List[str] = Field(default_factory=list)
    participationCondition: str = ""


class MechanicsData(BaseModel):
    checks: List[CheckDefinition] = Field(default_factory=list)
    votes: List[VoteDefinition] = Field(default_factory=list)


class AIConfig(BaseModel):
    apiKey: Optional[str] = None
    model: str = "qwen-plus"


class ProjectData(BaseModel):
    projectId: str = ""
    title: str = ""
    worldSetting: List[WorldBlock] = Field(default_factory=list)
    dmNotes: str = ""
    bgm: str = ""  # background music filename (from resource/music/)
    characterParams: List[CharacterParamDefinition] = Field(default_factory=list)
    characters: GraphData = Field(default_factory=GraphData)
    locations: GraphData = Field(default_factory=GraphData)
    items: GraphData = Field(default_factory=GraphData)
    plot: PlotData = Field(default_factory=PlotData)
    mechanics: MechanicsData = Field(default_factory=MechanicsData)
    aiConfig: Optional[AIConfig] = None
    updatedAt: str = ""


class ProjectSummary(BaseModel):
    id: str
    title: str
    updatedAt: str


class CreateProjectRequest(BaseModel):
    title: str = "新项目"


class ImportProjectRequest(BaseModel):
    data: Dict[str, Any]


class AIGenerateRequest(BaseModel):
    project_id: str
    context: Dict[str, Any] = Field(default_factory=dict)
    instruction: str = ""
    prompt_template: Optional[str] = None


class AIGenerateResponse(BaseModel):
    generated_text: str


class AIChatRecord(BaseModel):
    id: str
    timestamp: str
    page: str = ""
    instruction: str = ""
    template: str = ""
    response: str = ""
    model: str = ""


class AIHistoryData(BaseModel):
    records: List[AIChatRecord] = Field(default_factory=list)


class AIHistoryResponse(BaseModel):
    records: List[AIChatRecord]


class AIModifyRequest(BaseModel):
    project_id: str
    context: Dict[str, Any] = Field(default_factory=dict)
    instruction: str = ""


class AIModifyResponse(BaseModel):
    success: bool
    modified_project: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
    has_backup: bool = False


class AIUndoResponse(BaseModel):
    success: bool
    restored_project: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class AIFillFieldRequest(BaseModel):
    project_id: str
    field_name: str
    existing_content: str = ""
    node_type: str = ""
    node_data: str = ""


class AIFillFieldResponse(BaseModel):
    content: str
    analysis: str = ""


# === TTS ===

class TTSRequest(BaseModel):
    text: str
    voice: str = "default"
    rate: str = "+0%"
    pitch: str = "+0Hz"
    style: Optional[str] = None


class TTSResponse(BaseModel):
    audio_base64: str = ""
    success: bool = True
    error: Optional[str] = None
