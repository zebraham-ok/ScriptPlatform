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

export type PageType = 'character' | 'location' | 'worldview' | 'plot' | 'item' | 'mechanics';

export type SelectionType = 'node' | 'edge' | null;

export interface AIFillFieldRequest {
  project_id: string;
  field_name: string;
  existing_content: string;
  node_type: string;
}

export interface AIFillFieldResponse {
  content: string;
  analysis: string;
}
