import React, { useCallback, useMemo, useRef } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
  NodeTypes,
  MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Button, Space } from 'antd';
import { PlusOutlined, DeleteOutlined, AimOutlined, TrophyOutlined } from '@ant-design/icons';
import { useProjectStore } from '../../store/useProjectStore';
import { v4 as uuidv4 } from 'uuid';
import type { PageType } from '../../types';
import CustomCharacterNode from './CustomCharacterNode';
import CustomLocationNode from './CustomLocationNode';
import CustomCheckpointNode from './CustomCheckpointNode';

interface GraphCanvasProps {
  pageType: PageType;
}

const nodeTypes: NodeTypes = {
  characterNode: CustomCharacterNode,
  locationNode: CustomLocationNode,
  checkpointNode: CustomCheckpointNode,
};

const mapNodeType: Record<PageType, string> = {
  character: 'characterNode',
  location: 'locationNode',
  plot: 'checkpointNode',
  worldview: 'characterNode',
};

const defaultLabels: Record<PageType, string> = {
  character: '新人物',
  location: '新地点',
  plot: '新检查点',
  worldview: '',
};

const GraphCanvas: React.FC<GraphCanvasProps> = ({ pageType }) => {
  const {
    addNode,
    addEdge,
    deleteNode,
    deleteEdge,
    updateNodePosition,
    setSelectedElement,
    currentPage,
    setInitialCheckpoint,
    toggleEndCheckpoint,
  } = useProjectStore();

  // Subscribe to graph data reactively via Zustand selector
  const graphData = useProjectStore((state) => {
    if (!state.project) return { nodes: [], edges: [] };
    const key = pageType === 'character' ? 'characters' as const
      : pageType === 'location' ? 'locations' as const
      : 'plot' as const;
    if (key === 'plot') return state.project.plot.graph;
    return state.project[key];
  });

  const plotData = useProjectStore((state) => {
    return state.project?.plot || { initialCheckpoint: '', endCheckpoints: [], graph: { nodes: [], edges: [] } };
  });

  // Subscribe to selection state for highlighting
  const selectedElementId = useProjectStore((s) => s.selectedElementId);
  const selectedElementType = useProjectStore((s) => s.selectedElementType);

  const reactFlowWrapper = useRef<HTMLDivElement>(null);

  const getNodeStyle = useCallback(
    (nodeId: string): React.CSSProperties | undefined => {
      const isInitial = plotData.initialCheckpoint === nodeId;
      const isEnd = (plotData.endCheckpoints || []).includes(nodeId);
      if (isInitial && isEnd) {
        return { border: '2px solid #722ed1', boxShadow: '0 0 8px rgba(114,46,209,0.5)' };
      }
      if (isInitial) {
        return { border: '2px solid #1677ff', boxShadow: '0 0 8px rgba(22,119,255,0.4)' };
      }
      if (isEnd) {
        return { border: '2px solid #fa8c16', boxShadow: '0 0 8px rgba(250,140,22,0.5)' };
      }
      return undefined;
    },
    [plotData.initialCheckpoint, plotData.endCheckpoints]
  );

  const initialNodes: Node[] = useMemo(
    () =>
      graphData.nodes.map((n) => {
        const isSelected = selectedElementType === 'node' && n.id === selectedElementId;
        const baseStyle = pageType === 'plot' ? getNodeStyle(n.id) : undefined;
        return {
          id: n.id,
          type: mapNodeType[currentPage],
          position: n.position,
          data: {
            label: n.label,
            nodeData: n.data,
            isInitial: pageType === 'plot' && plotData.initialCheckpoint === n.id,
            isEnd: pageType === 'plot' && (plotData.endCheckpoints || []).includes(n.id),
          },
          selected: isSelected,
          style: isSelected
            ? {
                ...baseStyle,
                boxShadow: baseStyle?.boxShadow
                  ? `${baseStyle.boxShadow}, 0 0 0 2px #1677ff, 0 0 16px rgba(22,119,255,0.6)`
                  : '0 0 0 2px #1677ff, 0 0 16px rgba(22,119,255,0.6)',
              }
            : baseStyle,
        };
      }),
    [graphData.nodes, currentPage, pageType, plotData.initialCheckpoint, plotData.endCheckpoints, getNodeStyle, selectedElementId, selectedElementType]
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      graphData.edges.map((e) => {
        const isSelected = selectedElementType === 'edge' && e.id === selectedElementId;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label,
          data: e.data,
          markerEnd: pageType === 'plot' ? { type: MarkerType.ArrowClosed } : undefined,
          selected: isSelected,
          style: isSelected
            ? { stroke: '#1677ff', strokeWidth: 2.5 }
            : pageType === 'plot' ? {} : { stroke: '#999' },
        };
      }),
    [graphData.edges, pageType, selectedElementId, selectedElementType]
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync canvas when store data changes (e.g. from DetailPanel edits)
  React.useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      const id = uuidv4();
      const defaultLabel = pageType === 'plot' ? '转化' : pageType === 'location' ? '通行方式' : '';
      const newEdge: any = {
        id,
        source: connection.source,
        target: connection.target,
        label: defaultLabel,
        data: { description: '', relationType: '', trigger: '', conditionLogic: '' },
      };
      addEdge(newEdge);

      const rfEdge: Edge = {
        id,
        source: connection.source,
        target: connection.target,
        sourceHandle: connection.sourceHandle || undefined,
        targetHandle: connection.targetHandle || undefined,
        label: newEdge.label,
        data: newEdge.data,
        markerEnd: pageType === 'plot' ? { type: MarkerType.ArrowClosed } : undefined,
      };
      setEdges((eds) => [...eds, rfEdge]);
    },
    [addEdge, pageType, setEdges]
  );

  // Use single-click callbacks instead of onSelectionChange to avoid
  // ReactFlow double-fire / deselect-on-rerender issues
  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      setSelectedElement(node.id, 'node');
    },
    [setSelectedElement]
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setSelectedElement(edge.id, 'edge');
    },
    [setSelectedElement]
  );

  const onPaneClick = useCallback(() => {
    setSelectedElement(null, null);
  }, [setSelectedElement]);

  const handleAddNode = useCallback(() => {
    const id = uuidv4();
    const newNode: any = {
      id,
      type: mapNodeType[pageType],
      label: defaultLabels[pageType],
      position: { x: Math.random() * 400 + 100, y: Math.random() * 300 + 100 },
      data: {
        name: defaultLabels[pageType],
        description: '',
        aliases: [],
        gender: '',
        appearance: '',
        personality: '',
        attributes: {},
        locationType: '',
        terrain: '',
        sceneDescription: '',
        conditions: [],
        customFields: {},
      },
    };
    addNode(newNode);
    setNodes((nds) => [
      ...nds,
      {
        id: newNode.id,
        type: mapNodeType[pageType],
        position: newNode.position,
        data: { label: newNode.label, nodeData: newNode.data, isInitial: false },
      },
    ]);
  }, [addNode, pageType, setNodes]);

  const handleDeleteSelected = useCallback(() => {
    const { selectedElementId, selectedElementType } = useProjectStore.getState();
    if (!selectedElementId) return;
    if (selectedElementType === 'node') {
      deleteNode(selectedElementId);
      setNodes((nds) => nds.filter((n) => n.id !== selectedElementId));
      setEdges((eds) => eds.filter((e) => e.source !== selectedElementId && e.target !== selectedElementId));
    } else if (selectedElementType === 'edge') {
      deleteEdge(selectedElementId);
      setEdges((eds) => eds.filter((e) => e.id !== selectedElementId));
    }
  }, [deleteNode, deleteEdge, setNodes, setEdges]);

  const handleSetInitial = useCallback(() => {
    const { selectedElementId } = useProjectStore.getState();
    if (!selectedElementId || pageType !== 'plot') return;
    setInitialCheckpoint(selectedElementId);
    // Re-read updated store to get latest ends
    const state = useProjectStore.getState();
    const p = state.project?.plot;
    const ends = p?.endCheckpoints || [];
    const init = p?.initialCheckpoint || '';
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isInitial: n.id === init, isEnd: ends.includes(n.id) },
        style: (n.id === init && ends.includes(n.id))
          ? { border: '2px solid #722ed1', boxShadow: '0 0 8px rgba(114,46,209,0.5)' }
          : (n.id === init)
            ? { border: '2px solid #1677ff', boxShadow: '0 0 8px rgba(22,119,255,0.4)' }
            : (ends.includes(n.id))
              ? { border: '2px solid #fa8c16', boxShadow: '0 0 8px rgba(250,140,22,0.5)' }
              : undefined,
      }))
    );
  }, [pageType, setInitialCheckpoint, setNodes]);

  const handleToggleEnding = useCallback(() => {
    const { selectedElementId } = useProjectStore.getState();
    if (!selectedElementId || pageType !== 'plot') return;
    toggleEndCheckpoint(selectedElementId);
    // Re-read updated store after toggle
    const state = useProjectStore.getState();
    const p = state.project?.plot;
    const ends = p?.endCheckpoints || [];
    const init = p?.initialCheckpoint || '';
    setNodes((nds) =>
      nds.map((n) => ({
        ...n,
        data: { ...n.data, isInitial: n.id === init, isEnd: ends.includes(n.id) },
        style: (n.id === init && ends.includes(n.id))
          ? { border: '2px solid #722ed1', boxShadow: '0 0 8px rgba(114,46,209,0.5)' }
          : (n.id === init)
            ? { border: '2px solid #1677ff', boxShadow: '0 0 8px rgba(22,119,255,0.4)' }
            : (ends.includes(n.id))
              ? { border: '2px solid #fa8c16', boxShadow: '0 0 8px rgba(250,140,22,0.5)' }
              : undefined,
      }))
    );
  }, [pageType, toggleEndCheckpoint, setNodes]);

  const onNodeDragStop = useCallback(
    (_: any, node: Node) => {
      updateNodePosition(node.id, node.position);
    },
    [updateNodePosition]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          padding: '4px 8px',
          borderBottom: '1px solid #f0f0f0',
          background: '#fafafa',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <Space size="small">
          <Button size="small" icon={<PlusOutlined />} onClick={handleAddNode}>
            添加
          </Button>
          <Button size="small" icon={<DeleteOutlined />} danger onClick={handleDeleteSelected}>
            删除选中
          </Button>
          {pageType === 'plot' && (
            <Button size="small" icon={<AimOutlined />} onClick={handleSetInitial}>
              设为起始
            </Button>
          )}
          {pageType === 'plot' && (
            <Button size="small" icon={<TrophyOutlined />} onClick={handleToggleEnding}>
              设为结局
            </Button>
          )}
        </Space>
      </div>
      <div ref={reactFlowWrapper} style={{ flex: 1 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodeDragStop={onNodeDragStop}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[20, 20]}
          deleteKeyCode={['Backspace', 'Delete']}
        >
          <Background />
          <Controls />
          <MiniMap />
        </ReactFlow>
      </div>
    </div>
  );
};

export default GraphCanvas;
