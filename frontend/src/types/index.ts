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
    appearance?: string;
    personality?: string;
    attributes?: Record<string, any>;
    description?: string;
    // Location fields
    locationType?: string;
    terrain?: string;
    // Checkpoint fields
    sceneDescription?: string;
    conditions?: string[];
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
  plot: PlotData;
  aiConfig?: AIConfig;
  updatedAt?: string;
}

export interface ProjectSummary {
  id: string;
  title: string;
  updatedAt: string;
}

export type PageType = 'character' | 'location' | 'worldview' | 'plot';

export type SelectionType = 'node' | 'edge' | null;
