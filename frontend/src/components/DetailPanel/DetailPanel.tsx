import React, { useMemo, useCallback, useState, useEffect } from 'react';
import {
  Form,
  Input,
  InputNumber,
  Select,
  Slider,
  Button,
  Divider,
  Empty,
  Space,
  Tag,
  Card,
  Typography,
  Switch,
} from 'antd';
import { PlusOutlined, DeleteOutlined, RobotOutlined, LoadingOutlined } from '@ant-design/icons';
import { useProjectStore } from '../../store/useProjectStore';
import type { PageType } from '../../types';
import { aiFillField } from '../../api';

const { Text } = Typography;
const { TextArea } = Input;

interface DetailPanelProps {
  pageType: PageType;
}

const DetailPanel: React.FC<DetailPanelProps> = ({ pageType }) => {
  const {
    updateNode,
    updateEdge,
    setShowAI,
    setSelectedElement,
    selectedElementId,
    selectedElementType,
    toggleEndCheckpoint,
    setInitialCheckpoint,
  } = useProjectStore();

  // Subscribe to graph data reactively via Zustand selector
  const data = useProjectStore((state) => {
    if (!state.project) return { nodes: [], edges: [] };
    const key = pageType === 'character' ? 'characters' as const
      : pageType === 'location' ? 'locations' as const
      : pageType === 'item' ? 'items' as const
      : 'plot' as const;
    if (key === 'plot') return state.project.plot.graph;
    return state.project[key];
  });

  // Cross-graph data for plot bindings
  const project = useProjectStore((s) => s.project);
  const locationNodes = project?.locations.nodes || [];
  const itemNodes = project?.items.nodes || [];
  const characterNodes = project?.characters.nodes || [];
  const mechanics = project?.mechanics || { checks: [], votes: [] };

  const selectedNode = useMemo(
    () => data.nodes.find((n) => n.id === selectedElementId),
    [data.nodes, selectedElementId]
  );
  const selectedEdge = useMemo(
    () => data.edges.find((e) => e.id === selectedElementId),
    [data.edges, selectedElementId]
  );

  const handleFieldChange = useCallback(
    (field: string, value: any) => {
      if (selectedElementType === 'node' && selectedElementId) {
        const state = useProjectStore.getState();
        const currentData = (() => {
          if (!state.project) return { nodes: [], edges: [] };
          const key = pageType === 'character' ? 'characters' as const
            : pageType === 'location' ? 'locations' as const
            : pageType === 'item' ? 'items' as const
            : 'plot' as const;
          if (key === 'plot') return state.project.plot.graph;
          return state.project[key];
        })();
        const node = currentData.nodes.find((n) => n.id === selectedElementId);
        if (!node) return;
        if (['label', 'position', 'type'].includes(field)) {
          updateNode(selectedElementId, { [field]: value } as any);
        } else {
          // Character: name syncs to label
          if (pageType === 'character' && field === 'name') {
            updateNode(selectedElementId, {
              label: value,
              data: { ...node.data, name: value },
            } as any);
          } else {
            updateNode(selectedElementId, {
              data: { ...node.data, [field]: value },
            } as any);
          }
        }
      } else if (selectedElementType === 'edge' && selectedElementId) {
        const state = useProjectStore.getState();
        const currentData = (() => {
          if (!state.project) return { nodes: [], edges: [] };
          const key = pageType === 'character' ? 'characters' as const
            : pageType === 'location' ? 'locations' as const
            : pageType === 'item' ? 'items' as const
            : 'plot' as const;
          if (key === 'plot') return state.project.plot.graph;
          return state.project[key];
        })();
        const edge = currentData.edges.find((e) => e.id === selectedElementId);
        if (!edge) return;
        if (field === 'relationType') {
          // Character edges: relationType syncs to label
          updateEdge(selectedElementId, {
            label: value,
            data: { ...edge.data, relationType: value },
          } as any);
        } else if (field === 'label') {
          updateEdge(selectedElementId, { [field]: value } as any);
        } else {
          updateEdge(selectedElementId, {
            data: { ...edge.data, [field]: value },
          } as any);
        }
      }
    },
    [selectedElementType, selectedElementId, updateNode, updateEdge, pageType]
  );

  const handleAttributeAdd = useCallback(() => {
    if (!selectedElementId) return;
    const state = useProjectStore.getState();
    const currentData = (() => {
      if (!state.project) return { nodes: [], edges: [] };
      const key = pageType === 'character' ? 'characters' as const
        : pageType === 'location' ? 'locations' as const
        : pageType === 'item' ? 'items' as const
        : 'plot' as const;
      if (key === 'plot') return state.project.plot.graph;
      return state.project[key];
    })();
    const node = currentData.nodes.find((n) => n.id === selectedElementId);
    if (!node) return;
    const attrs = { ...(node.data.attributes || {}), '': '' };
    updateNode(selectedElementId, {
      data: { ...node.data, attributes: attrs },
    } as any);
  }, [selectedElementId, updateNode, pageType]);

  const handleAttributeChange = useCallback(
    (oldKey: string, newKey: string, newValue: any) => {
      if (!selectedElementId) return;
      const state = useProjectStore.getState();
      const currentData = (() => {
        if (!state.project) return { nodes: [], edges: [] };
        const key = pageType === 'character' ? 'characters' as const
          : pageType === 'location' ? 'locations' as const
          : pageType === 'item' ? 'items' as const
          : 'plot' as const;
        if (key === 'plot') return state.project.plot.graph;
        return state.project[key];
      })();
      const node = currentData.nodes.find((n) => n.id === selectedElementId);
      if (!node) return;
      const attrs = { ...(node.data.attributes || {}) };
      delete attrs[oldKey];
      attrs[newKey] = newValue;
      updateNode(selectedElementId, {
        data: { ...node.data, attributes: attrs },
      } as any);
    },
    [selectedElementId, updateNode, pageType]
  );

  const handleAttributeDelete = useCallback(
    (key: string) => {
      if (!selectedElementId) return;
      const state = useProjectStore.getState();
      const currentData = (() => {
        if (!state.project) return { nodes: [], edges: [] };
        const key2 = pageType === 'character' ? 'characters' as const
          : pageType === 'location' ? 'locations' as const
          : pageType === 'item' ? 'items' as const
          : 'plot' as const;
        if (key2 === 'plot') return state.project.plot.graph;
        return state.project[key2];
      })();
      const node = currentData.nodes.find((n) => n.id === selectedElementId);
      if (!node) return;
      const attrs = { ...(node.data.attributes || {}) };
      delete attrs[key];
      updateNode(selectedElementId, {
        data: { ...node.data, attributes: attrs },
      } as any);
    },
    [selectedElementId, updateNode, pageType]
  );

  const handleConditionAdd = useCallback(() => {
    if (!selectedElementId) return;
    const state = useProjectStore.getState();
    const currentData = (() => {
      if (!state.project) return { nodes: [], edges: [] };
      const key = pageType === 'character' ? 'characters' as const
        : pageType === 'location' ? 'locations' as const
        : pageType === 'item' ? 'items' as const
        : 'plot' as const;
      if (key === 'plot') return state.project.plot.graph;
      return state.project[key];
    })();
    const node = currentData.nodes.find((n) => n.id === selectedElementId);
    if (!node) return;
    const conditions = [...(node.data.conditions || []), ''];
    updateNode(selectedElementId, {
      data: { ...node.data, conditions },
    } as any);
  }, [selectedElementId, updateNode, pageType]);

  const handleConditionChange = useCallback(
    (index: number, value: string) => {
      if (!selectedElementId) return;
      const state = useProjectStore.getState();
      const currentData = (() => {
        if (!state.project) return { nodes: [], edges: [] };
        const key = pageType === 'character' ? 'characters' as const
          : pageType === 'location' ? 'locations' as const
          : pageType === 'item' ? 'items' as const
          : 'plot' as const;
        if (key === 'plot') return state.project.plot.graph;
        return state.project[key];
      })();
      const node = currentData.nodes.find((n) => n.id === selectedElementId);
      if (!node) return;
      const conditions = [...(node.data.conditions || [])];
      conditions[index] = value;
      updateNode(selectedElementId, {
        data: { ...node.data, conditions },
      } as any);
    },
    [selectedElementId, updateNode, pageType]
  );

  const handleConditionDelete = useCallback(
    (index: number) => {
      if (!selectedElementId) return;
      const state = useProjectStore.getState();
      const currentData = (() => {
        if (!state.project) return { nodes: [], edges: [] };
        const key = pageType === 'character' ? 'characters' as const
          : pageType === 'location' ? 'locations' as const
          : pageType === 'item' ? 'items' as const
          : 'plot' as const;
        if (key === 'plot') return state.project.plot.graph;
        return state.project[key];
      })();
      const node = currentData.nodes.find((n) => n.id === selectedElementId);
      if (!node) return;
      const conditions = (node.data.conditions || []).filter((_: any, i: number) => i !== index);
      updateNode(selectedElementId, {
        data: { ...node.data, conditions },
      } as any);
    },
    [selectedElementId, updateNode, pageType]
  );

  const handlePotentialActionAdd = useCallback(() => {
    if (!selectedElementId) return;
    const state = useProjectStore.getState();
    if (!state.project) return;
    const node = state.project.plot.graph.nodes.find((n) => n.id === selectedElementId);
    if (!node) return;
    const potentialActions = { ...(node.data.potentialActions || {}), '': '' };
    updateNode(selectedElementId, {
      data: { ...node.data, potentialActions },
    } as any);
  }, [selectedElementId, updateNode]);

  const handlePotentialActionChange = useCallback(
    (oldKey: string, newKey: string, newValue: any) => {
      if (!selectedElementId) return;
      const state = useProjectStore.getState();
      if (!state.project) return;
      const node = state.project.plot.graph.nodes.find((n) => n.id === selectedElementId);
      if (!node) return;
      const potentialActions = { ...(node.data.potentialActions || {}) };
      delete potentialActions[oldKey];
      potentialActions[newKey] = newValue;
      updateNode(selectedElementId, {
        data: { ...node.data, potentialActions },
      } as any);
    },
    [selectedElementId, updateNode]
  );

  const handlePotentialActionDelete = useCallback(
    (key: string) => {
      if (!selectedElementId) return;
      const state = useProjectStore.getState();
      if (!state.project) return;
      const node = state.project.plot.graph.nodes.find((n) => n.id === selectedElementId);
      if (!node) return;
      const potentialActions = { ...(node.data.potentialActions || {}) };
      delete potentialActions[key];
      updateNode(selectedElementId, {
        data: { ...node.data, potentialActions },
      } as any);
    },
    [selectedElementId, updateNode]
  );

  const handleWorldParamChange = useCallback(
    (paramName: string, value: any) => {
      if (!selectedElementId) return;
      const state = useProjectStore.getState();
      const currentData = (() => {
        if (!state.project) return { nodes: [], edges: [] };
        const key = pageType === 'character' ? 'characters' as const
          : pageType === 'location' ? 'locations' as const
          : pageType === 'item' ? 'items' as const
          : 'plot' as const;
        if (key === 'plot') return state.project.plot.graph;
        return state.project[key];
      })();
      const node = currentData.nodes.find((n) => n.id === selectedElementId);
      if (!node) return;
      const worldParams = { ...(node.data.worldParams || {}) };
      worldParams[paramName] = value;
      updateNode(selectedElementId, {
        data: { ...node.data, worldParams },
      } as any);
    },
    [selectedElementId, updateNode, pageType]
  );

  const handleOpenAI = useCallback(() => {
    setShowAI(true);
  }, [setShowAI]);

  // --- AI field fill ---
  const [aiLoadingFields, setAiLoadingFields] = useState<Set<string>>(new Set());

  const handleAIFill = useCallback(
    async (fieldName: string, existingContent: string) => {
      const projectId = useProjectStore.getState().project?.projectId;
      if (!projectId || !selectedElementId) return;

      setAiLoadingFields((prev) => new Set(prev).add(fieldName));
      try {
        const res = await aiFillField({
          project_id: projectId,
          field_name: fieldName,
          existing_content: existingContent || '',
          node_type: pageType,
        });
        console.log(`[AI 分析] ${fieldName}:`, res.analysis);
        handleFieldChange(fieldName, res.content);
      } catch (e) {
        console.error(`[AI 填充失败] ${fieldName}:`, e);
      } finally {
        setAiLoadingFields((prev) => {
          const next = new Set(prev);
          next.delete(fieldName);
          return next;
        });
      }
    },
    [selectedElementId, pageType, handleFieldChange]
  );

  if (!selectedElementId) {
    return (
      <div style={{ padding: 16, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Empty description="点击画布中的节点或连线查看详情" />
      </div>
    );
  }

  return (
    <div style={{ padding: '8px 12px', height: '100%', overflow: 'auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text strong style={{ fontSize: 15 }}>
          {selectedElementType === 'node' ? '节点详情' : '连线详情'}
        </Text>
        <Space>
          <Button size="small" icon={<RobotOutlined />} onClick={handleOpenAI}>
            AI 助手
          </Button>
          <Button
            size="small"
            danger
            type="text"
            onClick={() => setSelectedElement(null, null)}
          >
            ✕
          </Button>
        </Space>
      </div>

      {selectedElementType === 'node' && selectedNode && (
        <NodeEditForm
          pageType={pageType}
          node={selectedNode}
          characterParams={project?.characterParams || []}
          mechanics={mechanics}
          isEnd={(() => {
            const p = useProjectStore.getState().project;
            return p ? (p.plot.endCheckpoints || []).includes(selectedNode.id) : false;
          })()}
          onToggleEnd={() => selectedElementId && toggleEndCheckpoint(selectedElementId)}
          isStart={(() => {
            const p = useProjectStore.getState().project;
            return p ? p.plot.initialCheckpoint === selectedNode.id : false;
          })()}
          onSetStart={() => selectedElementId && setInitialCheckpoint(selectedElementId)}
          onChange={handleFieldChange}
          onAttrAdd={handleAttributeAdd}
          onAttrChange={handleAttributeChange}
          onAttrDelete={handleAttributeDelete}
          onCondAdd={handleConditionAdd}
          onCondChange={handleConditionChange}
          onCondDelete={handleConditionDelete}
          onPotentialActionAdd={handlePotentialActionAdd}
          onPotentialActionChange={handlePotentialActionChange}
          onPotentialActionDelete={handlePotentialActionDelete}
          onWorldParamChange={handleWorldParamChange}
          locationNodes={locationNodes}
          itemNodes={itemNodes}
          characterNodes={characterNodes}
          onAIFill={handleAIFill}
          aiLoadingFields={aiLoadingFields}
        />
      )}

      {selectedElementType === 'edge' && selectedEdge && (
        <EdgeEditForm
          pageType={pageType}
          edge={selectedEdge}
          onChange={handleFieldChange}
          onAIFill={handleAIFill}
          aiLoadingFields={aiLoadingFields}
        />
      )}
    </div>
  );
};

// --- Sub components ---

interface NodeEditFormProps {
  pageType: PageType;
  node: any;
  characterParams?: import('../../types').CharacterParamDefinition[];
  mechanics?: import('../../types').MechanicsData;
  isEnd?: boolean;
  onToggleEnd?: () => void;
  isStart?: boolean;
  onSetStart?: () => void;
  onChange: (field: string, value: any) => void;
  onAttrAdd: () => void;
  onAttrChange: (oldKey: string, newKey: string, newValue: any) => void;
  onAttrDelete: (key: string) => void;
  onCondAdd: () => void;
  onCondChange: (index: number, value: string) => void;
  onCondDelete: (index: number) => void;
  onPotentialActionAdd: () => void;
  onPotentialActionChange: (oldKey: string, newKey: string, newValue: any) => void;
  onPotentialActionDelete: (key: string) => void;
  onWorldParamChange?: (paramName: string, value: any) => void;
  locationNodes?: any[];
  itemNodes?: any[];
  characterNodes?: any[];
  onAIFill?: (fieldName: string, existingContent: string) => void;
  aiLoadingFields?: Set<string>;
}

const NodeEditForm: React.FC<NodeEditFormProps> = ({
  pageType,
  node,
  characterParams = [],
  mechanics = { checks: [], votes: [] },
  isEnd,
  onToggleEnd,
  isStart,
  onSetStart,
  onChange,
  onAttrAdd,
  onAttrChange,
  onAttrDelete,
  onCondAdd,
  onCondChange,
  onCondDelete,
  onPotentialActionAdd,
  onPotentialActionChange,
  onPotentialActionDelete,
  onWorldParamChange,
  locationNodes = [],
  itemNodes = [],
  characterNodes = [],
  onAIFill,
  aiLoadingFields = new Set(),
}) => {
  const fieldLabel = (text: string, fieldName: string) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span>{text}</span>
      <Button
        size="small"
        type="text"
        icon={aiLoadingFields.has(fieldName) ? <LoadingOutlined spin /> : <RobotOutlined />}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const existing = String(node.data?.[fieldName] || '');
          onAIFill?.(fieldName, existing);
        }}
        style={{ padding: 0, fontSize: 12, color: '#8c8c8c', height: 18, minWidth: 18, lineHeight: 1 }}
      />
    </span>
  );

  // --- Associated objects (plot only) ---
  const [newAssoc, setNewAssoc] = useState<{ id: string; desc: string }>({ id: '', desc: '' });

  useEffect(() => {
    setNewAssoc({ id: '', desc: '' });
  }, [node.id]);

  const handleAssocChange = (index: number, id: string, desc: string) => {
    const objects = [...(node.data.associatedObjects || [])];
    objects[index] = { id, relationDescription: desc };
    onChange('associatedObjects', objects);
  };

  const handleAssocDelete = (index: number) => {
    const objects = (node.data.associatedObjects || []).filter((_: any, i: number) => i !== index);
    onChange('associatedObjects', objects);
  };

  const handleNewAssocUpdate = (id: string, desc: string) => {
    setNewAssoc({ id, desc });
    if (id && desc) {
      const objects = [...(node.data.associatedObjects || []), { id, relationDescription: desc }];
      onChange('associatedObjects', objects);
      setNewAssoc({ id: '', desc: '' });
    }
  };

  return (
    <Form layout="vertical" size="small">
      {pageType === 'character' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 3 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{fieldLabel('姓名', 'name')}</Text>
              <Input size="small" value={node.data.name || ''} onChange={(e) => onChange('name', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>性别</Text>
              <Select
                size="small"
                value={node.data.gender || ''}
                onChange={(v) => onChange('gender', v)}
                allowClear
                style={{ width: '100%' }}
                options={[
                  { value: '男', label: '男' },
                  { value: '女', label: '女' },
                  { value: '其他', label: '其他' },
                ]}
              />
            </div>
            <div style={{ flex: 2 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>年龄</Text>
              <InputNumber
                size="small"
                min={0}
                max={200}
                value={node.data.age}
                onChange={(v) => onChange('age', v)}
                style={{ width: '100%' }}
                placeholder="年龄"
              />
            </div>
          </div>
          <Form.Item label={fieldLabel('外貌', 'appearance')}>
            <TextArea autoSize={{ minRows: 2, maxRows: 8 }} value={node.data.appearance || ''} onChange={(e) => onChange('appearance', e.target.value)} />
          </Form.Item>
          <Form.Item label={fieldLabel('性格', 'personality')}>
            <TextArea autoSize={{ minRows: 2, maxRows: 8 }} value={node.data.personality || ''} onChange={(e) => onChange('personality', e.target.value)} />
          </Form.Item>
          <Form.Item label={fieldLabel('核心动机', 'motivation')}>
            <TextArea autoSize={{ minRows: 2, maxRows: 8 }} value={node.data.motivation || ''} onChange={(e) => onChange('motivation', e.target.value)} />
          </Form.Item>
          <Form.Item label="初始位置">
            <Select
              value={node.data.initialLocation || undefined}
              onChange={(v) => onChange('initialLocation', v)}
              allowClear
              showSearch
              placeholder="绑定到地点节点"
              optionFilterProp="label"
              options={locationNodes.map((n: any) => ({
                value: n.id,
                label: `📍 ${n.label}`,
              }))}
            />
          </Form.Item>
          <Form.Item label={fieldLabel('描述', 'description')}>
            <TextArea
              autoSize={{ minRows: 2, maxRows: 8 }}
              value={node.data.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </Form.Item>
          {characterParams.length > 0 && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <div style={{ marginBottom: 8 }}>
                <Text strong style={{ fontSize: 12 }}>世界参数</Text>
                <Text type="secondary" style={{ fontSize: 11, marginLeft: 8 }}>
                  （由世界观设定）
                </Text>
              </div>
              {characterParams.map((param) => {
                const worldParams = node.data.worldParams || {};
                const currentValue = worldParams[param.name];
                return (
                  <Form.Item key={param.name} label={param.name}>
                    {param.paramType === 'category' ? (
                      <Select
                        value={currentValue || undefined}
                        onChange={(v) => onWorldParamChange?.(param.name, v)}
                        allowClear
                        placeholder={`选择${param.name}`}
                        options={param.categories.map((cat) => ({ value: cat, label: cat }))}
                      />
                    ) : (
                      <Slider
                        min={param.minValue}
                        max={param.maxValue}
                        step={1}
                        value={currentValue ?? Math.ceil((param.minValue + param.maxValue) / 2)}
                        onChange={(v) => onWorldParamChange?.(param.name, v)}
                        marks={{ [param.minValue]: String(param.minValue), [param.maxValue]: String(param.maxValue) }}
                        tooltip={{ formatter: (v) => `${param.name}: ${v}`, open: true }}
                      />
                    )}
                  </Form.Item>
                );
              })}
            </>
          )}
          {(mechanics.checks.length > 0 || mechanics.votes.length > 0) && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>功能绑定</Text>
              <div style={{ display: 'flex', gap: 8 }}>
                {mechanics.checks.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>绑定检定</Text>
                    <Select
                      size="small"
                      mode="multiple"
                      value={node.data.boundChecks || []}
                      onChange={(v) => onChange('boundChecks', v)}
                      allowClear
                      showSearch
                      placeholder="选择检定"
                      optionFilterProp="label"
                      options={mechanics.checks.map((c) => ({
                        value: c.id,
                        label: `⚡ ${c.name}`,
                      }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                {mechanics.votes.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>绑定投票</Text>
                    <Select
                      size="small"
                      mode="multiple"
                      value={node.data.boundVotes || []}
                      onChange={(v) => onChange('boundVotes', v)}
                      allowClear
                      showSearch
                      placeholder="选择投票"
                      optionFilterProp="label"
                      options={mechanics.votes.map((v) => ({
                        value: v.id,
                        label: `📋 ${v.name}`,
                      }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {pageType === 'location' && (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <div style={{ flex: 1 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>{fieldLabel('标签', 'label')}</Text>
              <Input size="small" value={node.label} onChange={(e) => onChange('label', e.target.value)} />
            </div>
            <div style={{ flex: 1 }}>
              <Text type="secondary" style={{ fontSize: 12 }}>地点类型</Text>
              <Select
                size="small"
                value={node.data.locationType || ''}
                onChange={(v) => onChange('locationType', v)}
                allowClear
                style={{ width: '100%' }}
                options={[
                  { value: '城市', label: '城市' },
                  { value: '野外', label: '野外' },
                  { value: '建筑', label: '建筑' },
                  { value: '自然', label: '自然' },
                  { value: '其他', label: '其他' },
                ]}
              />
            </div>
          </div>
          <Form.Item label={fieldLabel('地貌', 'terrain')}>
            <Input value={node.data.terrain || ''} onChange={(e) => onChange('terrain', e.target.value)} />
          </Form.Item>
          <Form.Item label={fieldLabel('描述', 'description')}>
            <TextArea
              autoSize={{ minRows: 2, maxRows: 8 }}
              value={node.data.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </Form.Item>
          {(mechanics.checks.length > 0 || mechanics.votes.length > 0) && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>功能绑定</Text>
              <div style={{ display: 'flex', gap: 8 }}>
                {mechanics.checks.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>绑定检定</Text>
                    <Select
                      size="small"
                      mode="multiple"
                      value={node.data.boundChecks || []}
                      onChange={(v) => onChange('boundChecks', v)}
                      allowClear
                      showSearch
                      placeholder="选择检定"
                      optionFilterProp="label"
                      options={mechanics.checks.map((c) => ({
                        value: c.id,
                        label: `⚡ ${c.name}`,
                      }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                {mechanics.votes.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>绑定投票</Text>
                    <Select
                      size="small"
                      mode="multiple"
                      value={node.data.boundVotes || []}
                      onChange={(v) => onChange('boundVotes', v)}
                      allowClear
                      showSearch
                      placeholder="选择投票"
                      optionFilterProp="label"
                      options={mechanics.votes.map((v) => ({
                        value: v.id,
                        label: `📋 ${v.name}`,
                      }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {pageType === 'item' && (
        <>
          <Form.Item label={fieldLabel('物品名称', 'label')}>
            <Input value={node.label} onChange={(e) => onChange('label', e.target.value)} />
          </Form.Item>
          <Form.Item label={fieldLabel('外观', 'appearance')}>
            <TextArea
              autoSize={{ minRows: 2, maxRows: 8 }}
              value={node.data.appearance || ''}
              onChange={(e) => onChange('appearance', e.target.value)}
            />
          </Form.Item>
          <Form.Item label={fieldLabel('功能', 'function')}>
            <TextArea
              autoSize={{ minRows: 2, maxRows: 8 }}
              value={node.data.function || ''}
              onChange={(e) => onChange('function', e.target.value)}
            />
          </Form.Item>
          <Form.Item label={fieldLabel('获得方式', 'acquisitionMethod')}>
            <TextArea
              autoSize={{ minRows: 2, maxRows: 8 }}
              value={node.data.acquisitionMethod || ''}
              onChange={(e) => onChange('acquisitionMethod', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="数量限制">
            <Select
              size="small"
              value={node.data.unique ? '唯一' : '不限个数'}
              onChange={(v) => onChange('unique', v === '唯一')}
              style={{ width: '100%' }}
              options={[
                { value: '不限个数', label: '不限个数' },
                { value: '唯一', label: '唯一' },
              ]}
            />
          </Form.Item>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ marginBottom: 8 }}>
            <Space>
              <Text strong style={{ fontSize: 12 }}>触发事件</Text>
              <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onCondAdd}>
                添加
              </Button>
            </Space>
          </div>
          {(node.data.conditions || []).map((evt: string, idx: number) => (
            <div key={idx} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <Input
                size="small"
                value={evt}
                onChange={(e) => onCondChange(idx, e.target.value)}
                placeholder="事件描述"
              />
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onCondDelete(idx)} />
            </div>
          ))}
          <Divider style={{ margin: '12px 0' }} />
          <Form.Item label="初始所在">
            <Select
              value={node.data.initialLocation || undefined}
              onChange={(v) => onChange('initialLocation', v)}
              allowClear
              showSearch
              placeholder="绑定到人物/地点/情节节点"
              optionFilterProp="label"
              options={[
                ...characterNodes.map((n: any) => ({
                  value: n.id,
                  label: `👤 ${n.label || n.data?.name}`,
                })),
                ...locationNodes.map((n: any) => ({
                  value: n.id,
                  label: `📍 ${n.label}`,
                })),
                ...(itemNodes.length > 0 ? [] : []),
              ]}
            />
          </Form.Item>
          {(mechanics.checks.length > 0 || mechanics.votes.length > 0) && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>功能绑定</Text>
              <div style={{ display: 'flex', gap: 8 }}>
                {mechanics.checks.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>绑定检定</Text>
                    <Select
                      size="small"
                      mode="multiple"
                      value={node.data.boundChecks || []}
                      onChange={(v) => onChange('boundChecks', v)}
                      allowClear
                      showSearch
                      placeholder="选择检定"
                      optionFilterProp="label"
                      options={mechanics.checks.map((c) => ({
                        value: c.id,
                        label: `⚡ ${c.name}`,
                      }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                {mechanics.votes.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>绑定投票</Text>
                    <Select
                      size="small"
                      mode="multiple"
                      value={node.data.boundVotes || []}
                      onChange={(v) => onChange('boundVotes', v)}
                      allowClear
                      showSearch
                      placeholder="选择投票"
                      optionFilterProp="label"
                      options={mechanics.votes.map((v) => ({
                        value: v.id,
                        label: `📋 ${v.name}`,
                      }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {pageType === 'plot' && (
        <>
          <Form.Item label={fieldLabel('情节名称', 'label')}>
            <Input value={node.label} onChange={(e) => onChange('label', e.target.value)} />
          </Form.Item>
          <div style={{ display: 'flex', gap: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12 }}>设为结局</Text>
              <Switch checked={isEnd} onChange={onToggleEnd} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Text style={{ fontSize: 12 }}>设为起始</Text>
              <Switch checked={isStart} onChange={onSetStart} />
            </div>
          </div>
          <Form.Item label={fieldLabel('告知玩家的信息', 'sceneDescription')}>
            <TextArea
              autoSize={{ minRows: 3, maxRows: 10 }}
              value={node.data.sceneDescription || ''}
              onChange={(e) => onChange('sceneDescription', e.target.value)}
            />
          </Form.Item>
          <Form.Item label={fieldLabel('不告知玩家的信息', 'description')}>
            <TextArea
              autoSize={{ minRows: 3, maxRows: 10 }}
              value={node.data.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </Form.Item>
          <Divider style={{ margin: '12px 0' }} />
          <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>事件绑定</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>触发条件</Text>
          <Select
            mode="multiple"
            value={node.data.triggerConditions || []}
            onChange={(v) => onChange('triggerConditions', v)}
            allowClear
            showSearch
            placeholder="选择触发该情节的人物、地点或物品"
            optionFilterProp="label"
            style={{ width: '100%' }}
            options={[
              { label: '人物', options: characterNodes.map((n: any) => ({ value: `character:${n.id}`, label: `👤 ${n.data?.name || n.label}` })) },
              { label: '地点', options: locationNodes.map((n: any) => ({ value: `location:${n.id}`, label: `📍 ${n.label}` })) },
              { label: '物品', options: itemNodes.map((n: any) => ({ value: `item:${n.id}`, label: `📦 ${n.label}` })) },
              { label: '功能', options: [
                ...mechanics.checks.map((c) => ({ value: `check:${c.id}`, label: `⚡ ${c.name}` })),
                ...mechanics.votes.map((v) => ({ value: `vote:${v.id}`, label: `📋 ${v.name}` })),
              ]},
            ]}
          />
          <div style={{ height: 12 }} />
          <Text type="secondary" style={{ fontSize: 12 }}>关联对象</Text>
          {(node.data.associatedObjects || []).map((obj: any, idx: number) => (
            <div key={`assoc-${idx}`} style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Select
                  size="small"
                  value={obj.id || undefined}
                  onChange={(v) => handleAssocChange(idx, v || '', obj.relationDescription)}
                  allowClear
                  showSearch
                  placeholder="选择对象"
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  options={[
                    { label: '人物', options: characterNodes.map((n: any) => ({ value: `character:${n.id}`, label: `👤 ${n.data?.name || n.label}` })) },
                    { label: '地点', options: locationNodes.map((n: any) => ({ value: `location:${n.id}`, label: `📍 ${n.label}` })) },
                    { label: '物品', options: itemNodes.map((n: any) => ({ value: `item:${n.id}`, label: `📦 ${n.label}` })) },
                    { label: '功能', options: [
                      ...mechanics.checks.map((c) => ({ value: `check:${c.id}`, label: `⚡ ${c.name}` })),
                      ...mechanics.votes.map((v) => ({ value: `vote:${v.id}`, label: `📋 ${v.name}` })),
                    ]},
                  ]}
                />
              </div>
              <div style={{ flex: 2 }}>
                <Input
                  size="small"
                  value={obj.relationDescription}
                  onChange={(e) => handleAssocChange(idx, obj.id, e.target.value)}
                  placeholder="关联原因/方式"
                />
              </div>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => handleAssocDelete(idx)} style={{ marginTop: 0 }} />
            </div>
          ))}
          {(!node.data.associatedObjects || node.data.associatedObjects.length === 0 || node.data.associatedObjects.every((o: any) => o.id && o.relationDescription)) && (
            <div style={{ display: 'flex', gap: 8, marginTop: 4, alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <Select
                  size="small"
                  value={newAssoc.id || undefined}
                  onChange={(v) => handleNewAssocUpdate(v || '', newAssoc.desc)}
                  allowClear
                  showSearch
                  placeholder="选择对象"
                  optionFilterProp="label"
                  style={{ width: '100%' }}
                  options={[
                    { label: '人物', options: characterNodes.map((n: any) => ({ value: `character:${n.id}`, label: `👤 ${n.data?.name || n.label}` })) },
                    { label: '地点', options: locationNodes.map((n: any) => ({ value: `location:${n.id}`, label: `📍 ${n.label}` })) },
                    { label: '物品', options: itemNodes.map((n: any) => ({ value: `item:${n.id}`, label: `📦 ${n.label}` })) },
                    { label: '功能', options: [
                      ...mechanics.checks.map((c) => ({ value: `check:${c.id}`, label: `⚡ ${c.name}` })),
                      ...mechanics.votes.map((v) => ({ value: `vote:${v.id}`, label: `📋 ${v.name}` })),
                    ]},
                  ]}
                />
              </div>
              <div style={{ flex: 2 }}>
                <Input
                  size="small"
                  value={newAssoc.desc}
                  onChange={(e) => handleNewAssocUpdate(newAssoc.id, e.target.value)}
                  placeholder="关联原因/方式"
                />
              </div>
              <div style={{ width: 32 }} />
            </div>
          )}
          {(mechanics.checks.length > 0 || mechanics.votes.length > 0) && (
            <>
              <Divider style={{ margin: '12px 0' }} />
              <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 8 }}>功能绑定</Text>
              <div style={{ display: 'flex', gap: 8 }}>
                {mechanics.checks.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>绑定检定</Text>
                    <Select
                      size="small"
                      mode="multiple"
                      value={node.data.boundChecks || []}
                      onChange={(v) => onChange('boundChecks', v)}
                      allowClear
                      showSearch
                      placeholder="选择检定"
                      optionFilterProp="label"
                      options={mechanics.checks.map((c) => ({
                        value: c.id,
                        label: `⚡ ${c.name}`,
                      }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
                {mechanics.votes.length > 0 && (
                  <div style={{ flex: 1 }}>
                    <Text type="secondary" style={{ fontSize: 12 }}>绑定投票</Text>
                    <Select
                      size="small"
                      mode="multiple"
                      value={node.data.boundVotes || []}
                      onChange={(v) => onChange('boundVotes', v)}
                      allowClear
                      showSearch
                      placeholder="选择投票"
                      optionFilterProp="label"
                      options={mechanics.votes.map((v) => ({
                        value: v.id,
                        label: `📋 ${v.name}`,
                      }))}
                      style={{ width: '100%' }}
                    />
                  </div>
                )}
              </div>
            </>
          )}
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ marginBottom: 8 }}>
            <Space>
              <Text strong style={{ fontSize: 12 }}>潜在行动</Text>
              <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onPotentialActionAdd}>
                添加
              </Button>
            </Space>
          </div>
          {Object.entries(node.data.potentialActions || {}).map(([key, value]: [string, any]) => (
            <div key={key} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <Input
                size="small"
                style={{ flex: 1 }}
                value={key}
                onChange={(e) => onPotentialActionChange(key, e.target.value, value)}
                placeholder="行动名"
              />
              <Input
                size="small"
                style={{ flex: 2 }}
                value={typeof value === 'string' ? value : JSON.stringify(value)}
                onChange={(e) => onPotentialActionChange(key, key, e.target.value)}
                placeholder="行动描述"
              />
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onPotentialActionDelete(key)} />
            </div>
          ))}
        </>
      )}

      {pageType !== 'plot' && (
        <>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ marginBottom: 8 }}>
            <Space>
              <Text strong style={{ fontSize: 12 }}>自定义属性</Text>
              <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onAttrAdd}>
                添加
              </Button>
            </Space>
          </div>
          {Object.entries(node.data.attributes || {}).map(([key, value]: [string, any]) => (
            <div key={key} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <Input
                size="small"
                style={{ flex: 1 }}
                value={key}
                onChange={(e) => onAttrChange(key, e.target.value, value)}
                placeholder="键"
              />
              <Input
                size="small"
                style={{ flex: 2 }}
                value={typeof value === 'string' ? value : JSON.stringify(value)}
                onChange={(e) => onAttrChange(key, key, e.target.value)}
                placeholder="值"
              />
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onAttrDelete(key)} />
            </div>
          ))}
        </>
      )}
    </Form>
  );
};

interface EdgeEditFormProps {
  pageType: PageType;
  edge: any;
  onChange: (field: string, value: any) => void;
  onAIFill?: (fieldName: string, existingContent: string) => void;
  aiLoadingFields?: Set<string>;
}

const EdgeEditForm: React.FC<EdgeEditFormProps> = ({ pageType, edge, onChange, onAIFill, aiLoadingFields = new Set() }) => {
  const fieldLabel = (text: string, fieldName: string) => (
    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span>{text}</span>
      <Button
        size="small"
        type="text"
        icon={aiLoadingFields.has(fieldName) ? <LoadingOutlined spin /> : <RobotOutlined />}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const existing = String(edge.data?.[fieldName] || '');
          onAIFill?.(fieldName, existing);
        }}
        style={{ padding: 0, fontSize: 12, color: '#8c8c8c', height: 18, minWidth: 18, lineHeight: 1 }}
      />
    </span>
  );

  return (
    <Form layout="vertical" size="small">
      {pageType === 'item' && (
        <Form.Item label={fieldLabel('关联标签', 'label')}>
          <Input value={edge.label || ''} onChange={(e) => onChange('label', e.target.value)} />
        </Form.Item>
      )}

      {pageType === 'character' && (
        <Form.Item label="关系类型">
          <Select
            value={edge.data?.relationType || ''}
            onChange={(v) => onChange('relationType', v)}
            allowClear
            options={[
              { value: '亲人', label: '亲人' },
              { value: '朋友', label: '朋友' },
              { value: '敌对', label: '敌对' },
              { value: '恋人', label: '恋人' },
              { value: '同事', label: '同事' },
              { value: '从属', label: '从属' },
              { value: '其他', label: '其他' },
            ]}
          />
        </Form.Item>
      )}

      {pageType === 'location' && (
        <Form.Item label="通行方式">
          <Input value="通行方式" disabled style={{ color: '#999' }} />
        </Form.Item>
      )}

      {pageType === 'plot' && (
        <Form.Item label={fieldLabel('转化名称', 'label')}>
          <Input value={edge.label || ''} onChange={(e) => onChange('label', e.target.value)} />
        </Form.Item>
      )}

      {pageType === 'plot' && (
        <>
          <Form.Item label={fieldLabel('触发条件', 'conditionLogic')}>
            <TextArea
              autoSize={{ minRows: 2, maxRows: 8 }}
              value={edge.data?.conditionLogic || ''}
              onChange={(e) => onChange('conditionLogic', e.target.value)}
              placeholder='例如：has_item("地图") && completed("任务1")'
            />
          </Form.Item>
          <Form.Item label={fieldLabel('备注', 'description')}>
            <TextArea
              autoSize={{ minRows: 2, maxRows: 8 }}
              value={edge.data?.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </Form.Item>
        </>
      )}

      {pageType !== 'plot' && (
        <Form.Item label={fieldLabel('描述', 'description')}>
          <TextArea
            autoSize={{ minRows: 2, maxRows: 8 }}
            value={edge.data?.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
          />
        </Form.Item>
      )}
    </Form>
  );
};

export default DetailPanel;
