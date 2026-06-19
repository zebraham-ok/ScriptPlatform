"""Pydantic models for game-related API (rooms, scripts, plaza)."""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any


# --- Script / Plaza ---

class ScriptCard(BaseModel):
    id: str
    title: str
    author: str
    coverPath: Optional[str] = None
    tags: List[str] = Field(default_factory=list)
    rating: float = 5.0
    playCount: int = 0
    duration: str = ""
    playerCount: str = ""
    createTime: str = ""
    isOfficial: bool = False


class ScriptListResponse(BaseModel):
    total: int
    list: List[ScriptCard]
    hasMore: bool


class PublishScriptRequest(BaseModel):
    projectId: str


class PublishScriptResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# --- Room ---

class CreateRoomRequest(BaseModel):
    mode: str = "sandbox"                 # "sandbox" | "script" | "import"
    scriptId: Optional[str] = None        # 广场剧本 ID
    editorJson: Optional[Dict[str, Any]] = None  # 编辑器 JSON（试玩）
    worldview: Optional[str] = None       # 沙盒：世界观偏好
    rolePrefs: Optional[str] = None       # 沙盒：角色偏好
    totalRounds: int = 15


class CreateRoomResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class JoinRoomRequest(BaseModel):
    nickname: str


class JoinRoomResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class RoomStatusResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


# --- Roles ---

class PlayableRole(BaseModel):
    characterId: str
    name: str
    minPlayers: int = 1
    maxPlayers: int = 1
    customizableAttributes: List[str] = Field(default_factory=list)
    attributeConstraints: Optional[dict] = None


class SelectRoleRequest(BaseModel):
    characterId: str


class CharacterSheetRequest(BaseModel):
    characterId: str
    attributes: Dict[str, int] = Field(default_factory=dict)


class CharacterSheetResponse(BaseModel):
    success: bool
    data: Optional[Dict[str, Any]] = None
    error: Optional[str] = None
