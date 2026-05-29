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
    boundLocations?: string[];
    boundItems?: string[];
    boundCharacters?: string[];
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
  characters: GraphData;
  locations: GraphData;
  items: GraphData;
  plot: PlotData;
  aiConfig?: AIConfig;
  updatedAt?: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export type PageType = 'character' | 'location' | 'worldview' | 'plot' | 'item';

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
