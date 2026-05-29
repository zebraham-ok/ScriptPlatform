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


class AIConfig(BaseModel):
    apiKey: Optional[str] = None
    model: str = "qwen-plus"


class ProjectData(BaseModel):
    projectId: str = ""
    title: str = ""
    worldSetting: List[WorldBlock] = Field(default_factory=list)
    characterParams: List[CharacterParamDefinition] = Field(default_factory=list)
    characters: GraphData = Field(default_factory=GraphData)
    locations: GraphData = Field(default_factory=GraphData)
    items: GraphData = Field(default_factory=GraphData)
    plot: PlotData = Field(default_factory=PlotData)
    aiConfig: Optional[AIConfig] = None
    updatedAt: str = ""


class ProjectSummary(BaseModel):
    id: str
    title: str
    updatedAt: str


class CreateProjectRequest(BaseModel):
    title: str = "新项目"


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


class AIFillFieldResponse(BaseModel):
    content: str
    analysis: str = ""
