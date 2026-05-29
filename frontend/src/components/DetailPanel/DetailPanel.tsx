import React, { useMemo, useCallback } from 'react';
import {
  Form,
  Input,
  Select,
  Button,
  Divider,
  Empty,
  Space,
  Tag,
  Card,
  Typography,
  Switch,
} from 'antd';
import { PlusOutlined, DeleteOutlined, RobotOutlined } from '@ant-design/icons';
import { useProjectStore } from '../../store/useProjectStore';
import type { PageType } from '../../types';

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
  } = useProjectStore();

  // Subscribe to graph data reactively via Zustand selector
  const data = useProjectStore((state) => {
    if (!state.project) return { nodes: [], edges: [] };
    const key = pageType === 'character' ? 'characters' as const
      : pageType === 'location' ? 'locations' as const
      : 'plot' as const;
    if (key === 'plot') return state.project.plot.graph;
    return state.project[key];
  });

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

  const handleOpenAI = useCallback(() => {
    setShowAI(true);
  }, [setShowAI]);

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
          isEnd={(() => {
            const p = useProjectStore.getState().project;
            return p ? (p.plot.endCheckpoints || []).includes(selectedNode.id) : false;
          })()}
          onToggleEnd={() => selectedElementId && toggleEndCheckpoint(selectedElementId)}
          onChange={handleFieldChange}
          onAttrAdd={handleAttributeAdd}
          onAttrChange={handleAttributeChange}
          onAttrDelete={handleAttributeDelete}
          onCondAdd={handleConditionAdd}
          onCondChange={handleConditionChange}
          onCondDelete={handleConditionDelete}
        />
      )}

      {selectedElementType === 'edge' && selectedEdge && (
        <EdgeEditForm
          pageType={pageType}
          edge={selectedEdge}
          onChange={handleFieldChange}
        />
      )}
    </div>
  );
};

// --- Sub components ---

interface NodeEditFormProps {
  pageType: PageType;
  node: any;
  isEnd?: boolean;
  onToggleEnd?: () => void;
  onChange: (field: string, value: any) => void;
  onAttrAdd: () => void;
  onAttrChange: (oldKey: string, newKey: string, newValue: any) => void;
  onAttrDelete: (key: string) => void;
  onCondAdd: () => void;
  onCondChange: (index: number, value: string) => void;
  onCondDelete: (index: number) => void;
}

const NodeEditForm: React.FC<NodeEditFormProps> = ({
  pageType,
  node,
  isEnd,
  onToggleEnd,
  onChange,
  onAttrAdd,
  onAttrChange,
  onAttrDelete,
  onCondAdd,
  onCondChange,
  onCondDelete,
}) => {
  return (
    <Form layout="vertical" size="small">
      {pageType === 'character' && (
        <>
          <Form.Item label="姓名">
            <Input value={node.data.name || ''} onChange={(e) => onChange('name', e.target.value)} />
          </Form.Item>
          <Form.Item label="性别">
            <Select
              value={node.data.gender || ''}
              onChange={(v) => onChange('gender', v)}
              allowClear
              options={[
                { value: '男', label: '男' },
                { value: '女', label: '女' },
                { value: '其他', label: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item label="外貌">
            <TextArea rows={2} value={node.data.appearance || ''} onChange={(e) => onChange('appearance', e.target.value)} />
          </Form.Item>
          <Form.Item label="性格">
            <TextArea rows={2} value={node.data.personality || ''} onChange={(e) => onChange('personality', e.target.value)} />
          </Form.Item>
          <Form.Item label="描述">
            <TextArea
              rows={2}
              value={node.data.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </Form.Item>
        </>
      )}

      {pageType === 'location' && (
        <>
          <Form.Item label="标签">
            <Input value={node.label} onChange={(e) => onChange('label', e.target.value)} />
          </Form.Item>
          <Form.Item label="地点类型">
            <Select
              value={node.data.locationType || ''}
              onChange={(v) => onChange('locationType', v)}
              allowClear
              options={[
                { value: '城市', label: '城市' },
                { value: '野外', label: '野外' },
                { value: '建筑', label: '建筑' },
                { value: '自然', label: '自然' },
                { value: '其他', label: '其他' },
              ]}
            />
          </Form.Item>
          <Form.Item label="地貌">
            <Input value={node.data.terrain || ''} onChange={(e) => onChange('terrain', e.target.value)} />
          </Form.Item>
          <Form.Item label="描述">
            <TextArea
              rows={2}
              value={node.data.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </Form.Item>
        </>
      )}

      {pageType === 'plot' && (
        <>
          <Form.Item label="情节名称">
            <Input value={node.label} onChange={(e) => onChange('label', e.target.value)} />
          </Form.Item>
          <Form.Item label="设为结局">
            <Switch checked={isEnd} onChange={onToggleEnd} />
          </Form.Item>
          <Form.Item label="告知玩家的信息">
            <TextArea
              rows={3}
              value={node.data.sceneDescription || ''}
              onChange={(e) => onChange('sceneDescription', e.target.value)}
            />
          </Form.Item>
          <Form.Item label="不告知玩家的信息">
            <TextArea
              rows={3}
              value={node.data.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </Form.Item>
          <Divider style={{ margin: '12px 0' }} />
          <div style={{ marginBottom: 8 }}>
            <Space>
              <Text strong style={{ fontSize: 12 }}>潜在行动</Text>
              <Button size="small" type="dashed" icon={<PlusOutlined />} onClick={onCondAdd}>
                添加
              </Button>
            </Space>
          </div>
          {(node.data.conditions || []).map((cond: string, idx: number) => (
            <div key={idx} style={{ display: 'flex', gap: 4, marginBottom: 4 }}>
              <Input
                size="small"
                value={cond}
                onChange={(e) => onCondChange(idx, e.target.value)}
                placeholder="行动描述"
              />
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => onCondDelete(idx)} />
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
}

const EdgeEditForm: React.FC<EdgeEditFormProps> = ({ pageType, edge, onChange }) => {
  return (
    <Form layout="vertical" size="small">
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
        <Form.Item label="转化名称">
          <Input value={edge.label || ''} onChange={(e) => onChange('label', e.target.value)} />
        </Form.Item>
      )}

      {pageType === 'plot' && (
        <>
          <Form.Item label="触发条件">
            <TextArea
              rows={2}
              value={edge.data?.conditionLogic || ''}
              onChange={(e) => onChange('conditionLogic', e.target.value)}
              placeholder='例如：has_item("地图") && completed("任务1")'
            />
          </Form.Item>
          <Form.Item label="备注">
            <TextArea
              rows={2}
              value={edge.data?.description || ''}
              onChange={(e) => onChange('description', e.target.value)}
            />
          </Form.Item>
        </>
      )}

      {pageType !== 'plot' && (
        <Form.Item label="描述">
          <TextArea
            rows={2}
            value={edge.data?.description || ''}
            onChange={(e) => onChange('description', e.target.value)}
          />
        </Form.Item>
      )}
    </Form>
  );
};

export default DetailPanel;
