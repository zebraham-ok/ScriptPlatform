/* TypeScript interfaces for the platform */

export interface Position {
  x: number;
  y: number;
}

export interface NodeData {
  id: string;
  type: string;
  label: string;
  position: Position;
  data: {
    // Character fields
    name?: string;
    aliases?: string[];
    gender?: string;
    age?: number;
    appearance?: string;
    personality?: string;
    motivation?: string;
    initialLocation?: string;
    attributes?: Record<string, any>;
    worldParams?: Record<string, any>;
    description?: string;
    // Location fields
    locationType?: string;
    terrain?: string;
    // Item fields
    function?: string;
    acquisitionMethod?: string;
    // Plot / checkpoint fields
    sceneDescription?: string;
    conditions?: string[];
    potentialActions?: Record<string, any>;
    boundLocations?: string[];
    boundItems?: string[];
    boundCharacters?: string[];
    triggerConditions?: string[];  // "character:id" | "location:id" | "item:id" | "check:id" | "vote:id"
    associatedObjects?: { id: string; relationDescription: string }[];
    // Player role settings
    isPlayable?: boolean;
    minPlayers?: number;
    maxPlayers?: number;
    customizableFields?: string[];
    numericAttributeCap?: number;
    // Mechanics bindings (for character / checkpoint / item)
    boundChecks?: string[];
    boundVotes?: string[];
    // Generic
    customFields?: Record<string, any>;
  };
}

export interface EdgeData {
  id: string;
  source: string;
  target: string;
  label: string;
  data: {
    description?: string;
    relationType?: string;
    trigger?: string;
    conditionLogic?: string;
    customFields?: Record<string, any>;
  };
}

export interface GraphData {
  nodes: NodeData[];
  edges: EdgeData[];
}

export interface WorldBlock {
  id: string;
  title: string;
  content: string;
}

export interface CharacterParamDefinition {
  name: string;
  paramType: 'category' | 'number';
  categories: string[];
  minValue: number;
  maxValue: number;
}

export interface CheckDefinition {
  id: string;
  name: string;
  triggerCondition: string;
  difficulty: number;
  checkTarget: string;
  description: string;
  successEffect: string;
  failureEffect: string;
}

export interface VoteDefinition {
  id: string;
  name: string;
  options: string[];
  participationCondition: string;
}

export interface MechanicsData {
  checks: CheckDefinition[];
  votes: VoteDefinition[];
}

export interface PlotData {
  initialCheckpoint: string;
  endCheckpoints: string[];
  graph: GraphData;
}

export interface AIConfig {
  apiKey?: string;
  model: string;
}

export interface ProjectData {
  projectId: string;
  title: string;
  worldSetting: WorldBlock[];
  dmNotes?: string;
  bgm?: string;  // BGM filename (from resource/music/)
  characterParams: CharacterParamDefinition[];
  characters: GraphData;
  locations: GraphData;
  items: GraphData;
  plot: PlotData;
  mechanics: MechanicsData;
  aiConfig?: AIConfig;
  updatedAt?: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export type PageType = 'home'
  | 'character' | 'location' | 'worldview' | 'plot' | 'item' | 'mechanics'
  | 'plaza' | 'game' | 'lobby' | 'role_select';

export type SelectionType = 'node' | 'edge' | null;

export interface AIFillFieldRequest {
  project_id: string;
  field_name: string;
  existing_content: string;
  node_type: string;
  node_data: string;
}

export interface AIFillFieldResponse {
  content: string;
  analysis: string;
}

// ========================================
//  Game Mode Types
// ========================================

export type GameStage = 'LOBBY' | 'GENERATE' | 'ROLE_SELECT' | 'PLAYING' | 'VOTE' | 'CHECK' | 'ENDING';

export interface RoleDetail {
  id: string;
  name: string;
  description: string;
  identity: string;
  appearance?: string;
  personality?: string;
  attributes?: Record<string, any>;
  customizableAttributes?: Array<{
    path: string;
    displayName: string;
    type: string;
  }>;
  numericAttributeCap?: number;
}

export interface GameRoomInfo {
  roomId: string;
  roomName: string;
  mode: 'script' | 'sandbox' | 'import';
  scriptId?: string | null;
  scriptTitle: string;
  stage: GameStage;
  totalRounds: number;
  owner: string;
  shareUrl: string;
  players?: Record<string, PlayerInfo>;
}

export interface PlayerInfo {
  playerId: string;
  nickname: string;
  isGuest: boolean;
  characterId: string | null;
  characterName: string | null;
  attributes: Record<string, any>;
  inventory: Array<{ name: string; description?: string; quantity?: number }>;
  isReady?: boolean;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  type: 'player' | 'dm' | 'dm_narration' | 'system' | 'narration' | 'dice' | 'private';
  timestamp: number;
  dmOptions?: string[];
  narration?: string;
  actionType?: 'normal' | 'check' | 'vote';
  targetPlayerId?: string;  // for private messages
}

// TTS related types
export interface TTSAudioPayload {
  audio: string;      // base64-encoded MP3
  text: string;        // original text for matching
  messageId: string;   // unique ID for this TTS event
}

export interface VoiceConfig {
  voice: string;
  rate: string;
  pitch: string;
}

export interface TTSState {
  enabled: boolean;
  playing: boolean;
  audioQueue: TTSAudioPayload[];
  currentAudio: TTSAudioPayload | null;
}

export interface SceneInfo {
  location: string;
  description: string;
  imageUrl: string | null;
  characters: string[];
}

export interface DiceResult {
  id: string;
  playerName: string;
  target: string;
  description: string;
  dice: number;
  difficulty: number;
  result: 'success' | 'failure';
  timestamp: number;
}

export interface PendingVote {
  name: string;
  options: string[];
  results: Record<string, number>;
  winner?: string;
  complete?: boolean;
}

export interface EndingData {
  title: string;
  endingLabel: string;
}

export interface TurnInfo {
  round: number;
  phase: string;
  timeRemaining: number;  // seconds
  actedPlayers: string[];
  skippedPlayers: string[];
}

export interface ScriptCardData {
  id: string;
  title: string;
  author: string;
  cover: string;
  tags: string[];
  rating: number;
  playCount: number;
  duration: string;
  playerCount: string;
  createTime: string;
  isOfficial: boolean;
}

export interface ScriptListResponse {
  total: number;
  list: ScriptCardData[];
  hasMore: boolean;
}

export interface CreateRoomParams {
  mode: 'script' | 'sandbox' | 'import' | 'create';
  editorJson?: any;
  scriptId?: string;
  worldview?: string;
  rolePrefs?: string;
  totalRounds?: number;
}

export interface CreateRoomResult {
  success: boolean;
  data: {
    roomId: string;
    mode: string;
    scriptTitle: string;
    shareUrl: string;
  };
}

export interface JoinRoomResult {
  success: boolean;
  data: {
    roomId: string;
    playerId: string;
    role: string;
  };
}
