import { create } from 'zustand';
import { ProjectData, PageType, GraphData, PlotData, WorldBlock, NodeData, EdgeData } from '../types';
import { patchProject, getProject } from '../api';
import { debounce } from 'lodash';
import { v4 as uuidv4 } from 'uuid';

interface ProjectStore {
  // Project data
  project: ProjectData | null;
  projectList: { id: string; title: string; updatedAt: string }[];

  // UI state
  currentPage: PageType;
  selectedElementId: string | null;
  selectedElementType: 'node' | 'edge' | null;
  loading: boolean;
  showAI: boolean;

  // Actions - Project
  setProject: (project: ProjectData) => void;
  setProjectList: (list: any[]) => void;
  loadProject: (projectId: string) => Promise<void>;
  clearProject: () => void;

  // Actions - UI
  setCurrentPage: (page: PageType) => void;
  setSelectedElement: (id: string | null, type: 'node' | 'edge' | null) => void;
  setLoading: (loading: boolean) => void;
  setShowAI: (show: boolean) => void;

  // Actions - World
  addWorldBlock: () => void;
  updateWorldBlock: (id: string, data: Partial<WorldBlock>) => void;
  deleteWorldBlock: (id: string) => void;
  reorderWorldBlocks: (blocks: WorldBlock[]) => void;

  // Actions - Graph (generic for characters, locations, plot)
  getGraphData: () => GraphData;
  getPlotData: () => PlotData;
  addNode: (node: NodeData) => void;
  updateNode: (id: string, data: Partial<NodeData>) => void;
  deleteNode: (id: string) => void;
  addEdge: (edge: EdgeData) => void;
  updateEdge: (id: string, data: Partial<EdgeData>) => void;
  deleteEdge: (id: string) => void;
  updateNodePosition: (id: string, position: { x: number; y: number }) => void;
  setInitialCheckpoint: (nodeId: string) => void;
  toggleEndCheckpoint: (nodeId: string) => void;

  // Internal
  _getGraphKey: () => 'characters' | 'locations' | 'items' | 'plot';
  _autoSave: () => void;
}

const _doSave = debounce(
  async (projectId: string, data: Record<string, any>) => {
    try {
      await patchProject(projectId, data);
    } catch (e) {
      console.error('Auto-save failed:', e);
    }
  },
  2000
);

export const useProjectStore = create<ProjectStore>((set, get) => ({
  project: null,
  projectList: [],
  currentPage: 'character',
  selectedElementId: null,
  selectedElementType: null,
  loading: false,
  showAI: false,

  // Project
  setProject: (project) => set({ project }),
  setProjectList: (list) => set({ projectList: list }),

  loadProject: async (projectId) => {
    set({ loading: true });
    try {
      const data = await getProject(projectId);
      set({ project: data, loading: false });
    } catch (e) {
      console.error('Failed to load project:', e);
      set({ loading: false });
    }
  },

  clearProject: () =>
    set({
      project: null,
      selectedElementId: null,
      selectedElementType: null,
    }),

  // UI
  setCurrentPage: (page) => set({ currentPage: page, selectedElementId: null, selectedElementType: null }),
  setSelectedElement: (id, type) => set({ selectedElementId: id, selectedElementType: type }),
  setLoading: (loading) => set({ loading }),
  setShowAI: (show) => set({ showAI: show }),

  // World
  addWorldBlock: () => {
    const project = get().project;
    if (!project) return;
    const newBlock: WorldBlock = { id: uuidv4(), title: '新模块', content: '' };
    const updated = {
      ...project,
      worldSetting: [...project.worldSetting, newBlock],
    };
    set({ project: updated });
    get()._autoSave();
  },

  updateWorldBlock: (id, data) => {
    const project = get().project;
    if (!project) return;
    const updated = {
      ...project,
      worldSetting: project.worldSetting.map((b) => (b.id === id ? { ...b, ...data } : b)),
    };
    set({ project: updated });
    get()._autoSave();
  },

  deleteWorldBlock: (id) => {
    const project = get().project;
    if (!project) return;
    const updated = {
      ...project,
      worldSetting: project.worldSetting.filter((b) => b.id !== id),
    };
    set({ project: updated });
    get()._autoSave();
  },

  reorderWorldBlocks: (blocks) => {
    const project = get().project;
    if (!project) return;
    set({ project: { ...project, worldSetting: blocks } });
    get()._autoSave();
  },

  // Graph - determine which graph to modify
  _getGraphKey: () => {
    const page = get().currentPage;
    if (page === 'character') return 'characters';
    if (page === 'location') return 'locations';
    if (page === 'item') return 'items';
    return 'plot';
  },

  getGraphData: () => {
    const project = get().project;
    if (!project) return { nodes: [], edges: [] };
    const key = get()._getGraphKey();
    if (key === 'plot') return project.plot.graph;
    if (key === 'items') return project.items;
    return project[key];
  },

  getPlotData: () => {
    const project = get().project;
    return project?.plot || { initialCheckpoint: '', endCheckpoints: [], graph: { nodes: [], edges: [] } };
  },

  addNode: (node) => {
    const project = get().project;
    if (!project) return;
    const key = get()._getGraphKey();
    let updated: ProjectData;
    if (key === 'plot') {
      updated = {
        ...project,
        plot: {
          ...project.plot,
          graph: {
            ...project.plot.graph,
            nodes: [...project.plot.graph.nodes, node],
          },
        },
      };
    } else {
      updated = {
        ...project,
        [key]: {
          ...project[key],
          nodes: [...project[key].nodes, node],
        },
      };
    }
    set({ project: updated });
    get()._autoSave();
  },

  updateNode: (id, data) => {
    const project = get().project;
    if (!project) return;
    const key = get()._getGraphKey();
    let updated: ProjectData;
    const updateNodes = (nodes: NodeData[]) =>
      nodes.map((n) => (n.id === id ? { ...n, ...data } : n));

    if (key === 'plot') {
      updated = {
        ...project,
        plot: {
          ...project.plot,
          graph: {
            ...project.plot.graph,
            nodes: updateNodes(project.plot.graph.nodes),
          },
        },
      };
    } else {
      updated = {
        ...project,
        [key]: {
          ...project[key],
          nodes: updateNodes(project[key].nodes),
        },
      };
    }
    set({ project: updated });
    get()._autoSave();
  },

  deleteNode: (id) => {
    const project = get().project;
    if (!project) return;
    const key = get()._getGraphKey();
    let updated: ProjectData;
    const filterNodes = (nodes: NodeData[]) => nodes.filter((n) => n.id !== id);
    const filterEdges = (edges: EdgeData[]) =>
      edges.filter((e) => e.source !== id && e.target !== id);

    if (key === 'plot') {
      updated = {
        ...project,
        plot: {
          initialCheckpoint: project.plot.initialCheckpoint === id ? '' : project.plot.initialCheckpoint,
          endCheckpoints: project.plot.endCheckpoints?.filter((c: string) => c !== id) || [],
          graph: {
            nodes: filterNodes(project.plot.graph.nodes),
            edges: filterEdges(project.plot.graph.edges),
          },
        },
      };
    } else {
      updated = {
        ...project,
        [key]: {
          nodes: filterNodes(project[key].nodes),
          edges: filterEdges(project[key].edges),
        },
      };
    }
    set({
      project: updated,
      selectedElementId: get().selectedElementId === id ? null : get().selectedElementId,
    });
    get()._autoSave();
  },

  addEdge: (edge) => {
    const project = get().project;
    if (!project) return;
    const key = get()._getGraphKey();
    let updated: ProjectData;
    if (key === 'plot') {
      updated = {
        ...project,
        plot: {
          ...project.plot,
          graph: {
            ...project.plot.graph,
            edges: [...project.plot.graph.edges, edge],
          },
        },
      };
    } else {
      updated = {
        ...project,
        [key]: {
          ...project[key],
          edges: [...project[key].edges, edge],
        },
      };
    }
    set({ project: updated });
    get()._autoSave();
  },

  updateEdge: (id, data) => {
    const project = get().project;
    if (!project) return;
    const key = get()._getGraphKey();
    let updated: ProjectData;
    const updateEdges = (edges: EdgeData[]) =>
      edges.map((e) => (e.id === id ? { ...e, ...data } : e));

    if (key === 'plot') {
      updated = {
        ...project,
        plot: {
          ...project.plot,
          graph: {
            ...project.plot.graph,
            edges: updateEdges(project.plot.graph.edges),
          },
        },
      };
    } else {
      updated = {
        ...project,
        [key]: {
          ...project[key],
          edges: updateEdges(project[key].edges),
        },
      };
    }
    set({ project: updated });
    get()._autoSave();
  },

  deleteEdge: (id) => {
    const project = get().project;
    if (!project) return;
    const key = get()._getGraphKey();
    let updated: ProjectData;
    const filterEdges = (edges: EdgeData[]) => edges.filter((e) => e.id !== id);

    if (key === 'plot') {
      updated = {
        ...project,
        plot: {
          ...project.plot,
          graph: {
            ...project.plot.graph,
            edges: filterEdges(project.plot.graph.edges),
          },
        },
      };
    } else {
      updated = {
        ...project,
        [key]: {
          ...project[key],
          edges: filterEdges(project[key].edges),
        },
      };
    }
    set({
      project: updated,
      selectedElementId: get().selectedElementId === id ? null : get().selectedElementId,
    });
    get()._autoSave();
  },

  updateNodePosition: (id, position) => {
    const state = get();
    state.updateNode(id, { position } as any);
  },

  setInitialCheckpoint: (nodeId) => {
    const project = get().project;
    if (!project) return;
    const updated = {
      ...project,
      plot: { ...project.plot, initialCheckpoint: nodeId },
    };
    set({ project: updated });
    get()._autoSave();
  },

  toggleEndCheckpoint: (nodeId) => {
    const project = get().project;
    if (!project) return;
    const ends = project.plot.endCheckpoints || [];
    const newEnds = ends.includes(nodeId)
      ? ends.filter((id) => id !== nodeId)
      : [...ends, nodeId];
    const updated = {
      ...project,
      plot: { ...project.plot, endCheckpoints: newEnds },
    };
    set({ project: updated });
    get()._autoSave();
  },

  _autoSave: () => {
    const { project } = get();
    if (!project) return;
    _doSave(project.projectId, project);
  },
}));
