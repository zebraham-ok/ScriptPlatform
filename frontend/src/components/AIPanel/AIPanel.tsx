import React, { useState } from 'react';
import { Drawer, Input, Button, Select, Space, Typography, Spin, message } from 'antd';
import { RobotOutlined, SendOutlined } from '@ant-design/icons';
import { useProjectStore } from '../../store/useProjectStore';
import { aiGenerate } from '../../api';
import type { PageType } from '../../types';

const { Text } = Typography;
const { TextArea } = Input;

interface AIPanelProps {}

const pageLabelMap: Record<PageType, string> = {
  character: '人物生成',
  location: '地点描写',
  item: '物品生成',
  worldview: '世界观构建',
  plot: '情节建议',
};

const AIPanel: React.FC<AIPanelProps> = () => {
  const { showAI, setShowAI, currentPage, project, selectedElementId, getGraphData } = useProjectStore();
  const [instruction, setInstruction] = useState('');
  const [template, setTemplate] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);

  const graphData = getGraphData();

  const handleGenerate = async () => {
    if (!instruction.trim()) {
      message.warning('请输入生成指令');
      return;
    }
    if (!project) return;

    setLoading(true);
    setResult('');

    const context: any = {
      current_page: currentPage,
      selected_element_id: selectedElementId || '',
    };

    // Build nearby elements context
    if (currentPage === 'character' || currentPage === 'location' || currentPage === 'plot') {
      const selectedNode = graphData.nodes.find((n) => n.id === selectedElementId);
      if (selectedNode && selectedElementId) {
        const connectedEdges = graphData.edges.filter(
          (e) => e.source === selectedElementId || e.target === selectedElementId
        );
        const nearbyIds = new Set<string>();
        connectedEdges.forEach((e) => {
          nearbyIds.add(e.source);
          nearbyIds.add(e.target);
        });
        nearbyIds.delete(selectedElementId);
        const nearbyNodes = graphData.nodes.filter((n) => nearbyIds.has(n.id));
        context.nearby_elements = [
          { role: 'selected', ...selectedNode },
          ...nearbyNodes,
        ];
      }
    }

    try {
      const res = await aiGenerate(project.projectId, context, instruction, template || undefined);
      setResult(res.generated_text);
    } catch (e: any) {
      setResult('生成失败：' + (e?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  const onClose = () => {
    setShowAI(false);
    setResult('');
  };

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined />
          <span>AI 创作助手 - {pageLabelMap[currentPage]}</span>
        </Space>
      }
      placement="right"
      width={420}
      open={showAI}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
        <div>
          <Text strong style={{ fontSize: 13 }}>生成指令</Text>
          <Input.TextArea
            rows={3}
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="例如：请为这个角色创作一个背景故事"
            style={{ marginTop: 4 }}
          />
        </div>

        <div>
          <Text strong style={{ fontSize: 13 }}>自定义提示词模板（可选）</Text>
          <Input.TextArea
            rows={4}
            value={template}
            onChange={(e) => setTemplate(e.target.value)}
            placeholder="留空使用默认模板。可使用 {context_text} 和 {instruction} 占位符"
            style={{ marginTop: 4 }}
          />
        </div>

        <Button
          type="primary"
          icon={<SendOutlined />}
          onClick={handleGenerate}
          loading={loading}
          block
        >
          生成
        </Button>

        {result && (
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              background: '#f9f9f9',
              padding: 12,
              borderRadius: 6,
              border: '1px solid #eee',
              whiteSpace: 'pre-wrap',
              fontSize: 13,
              lineHeight: 1.6,
            }}
          >
            {result}
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: 40 }}>
            <Spin tip="AI 正在创作中...">
              <div style={{ height: 80 }} />
            </Spin>
          </div>
        )}
      </div>
    </Drawer>
  );
};

export default AIPanel;
