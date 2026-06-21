import React, { useState, useEffect, useCallback } from 'react';
import { Drawer, Input, Button, Space, Typography, Spin, message, Tooltip } from 'antd';
import { RobotOutlined, SendOutlined, LeftOutlined, RightOutlined } from '@ant-design/icons';
import { useProjectStore } from '../../store/useProjectStore';
import { aiGenerate, getAIHistory } from '../../api';
import type { PageType } from '../../types';

const { Text } = Typography;

interface AIChatRecord {
  id: string;
  timestamp: string;
  page: string;
  instruction: string;
  template: string;
  response: string;
  model: string;
}

interface AIPanelProps {}

const pageLabelMap: Record<PageType, string> = {
  home: '',
  character: '人物生成',
  location: '地点描写',
  item: '物品生成',
  worldview: '世界观构建',
  plot: '情节建议',
  mechanics: '功能建议',
  plaza: '',
  game: '',
  lobby: '',
  role_select: '',
};

const AIPanel: React.FC<AIPanelProps> = () => {
  const { showAI, setShowAI, currentPage, project, selectedElementId, getGraphData } = useProjectStore();
  const [instruction, setInstruction] = useState('');
  const [template, setTemplate] = useState('');
  const [loading, setLoading] = useState(false);
  // History state
  const [history, setHistory] = useState<AIChatRecord[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1); // -1 means "new" (input mode)

  const graphData = getGraphData();

  const buildContext = (): any => {
    const context: any = {
      current_page: currentPage,
      selected_element_id: selectedElementId || '',
    };
    if (project) {
      context.project_data = project;
    }
    if (graphData.nodes && selectedElementId) {
      const selectedNode = graphData.nodes.find((n) => n.id === selectedElementId);
      if (selectedNode) {
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
    return context;
  };

  // Load history when panel opens or project changes
  const loadHistory = useCallback(async () => {
    if (!project) return;
    try {
      const data = await getAIHistory(project.projectId);
      setHistory(data.records || []);
    } catch {
      setHistory([]);
    }
  }, [project]);

  useEffect(() => {
    if (showAI) {
      loadHistory();
      setHistoryIndex(-1);
      setInstruction('');
      setTemplate('');
    }
  }, [showAI, loadHistory]);

  const currentRecord = historyIndex >= 0 && historyIndex < history.length ? history[historyIndex] : null;

  const handleGenerate = async () => {
    if (!instruction.trim()) {
      message.warning('请输入生成指令');
      return;
    }
    if (!project) return;

    setLoading(true);
    const context = buildContext();

    try {
      await aiGenerate(project.projectId, context, instruction, template || undefined);
      await loadHistory();
      setHistoryIndex(-1);
    } catch (e: any) {
      message.error('生成失败：' + (e?.message || '未知错误'));
    } finally {
      setLoading(false);
    }
  };

  // After history loads, point to newest
  useEffect(() => {
    if (history.length > 0 && historyIndex === -1 && !loading) {
      setHistoryIndex(history.length - 1);
    }
  }, [history.length]);

  const goToPrev = () => {
    if (historyIndex < 0 && history.length > 0) {
      // At "new" page, jump to the latest history record
      setHistoryIndex(history.length - 1);
    } else if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
    }
  };

  const goToNext = () => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
    }
  };

  const goToNew = () => {
    setHistoryIndex(-1);
    setInstruction('');
    setTemplate('');
  };

  const onClose = () => {
    setShowAI(false);
  };

  // Derive display content
  const displayContent = currentRecord ? currentRecord.response : '';

  return (
    <Drawer
      title={
        <Space>
          <RobotOutlined />
          <span>AI 创作助手 - {pageLabelMap[currentPage]}</span>
        </Space>
      }
      placement="right"
      width={480}
      open={showAI}
      onClose={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 12 }}>
        {/* --- Input Area (shown when no history selected) --- */}
        {!currentRecord && (
          <>
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
                placeholder="留空使用默认模板"
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
          </>
        )}

        {/* --- Pagination / Info bar --- */}
        {history.length > 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: '6px 0',
              borderBottom: currentRecord ? '1px solid #f0f0f0' : undefined,
              borderTop: !currentRecord ? '1px solid #f0f0f0' : undefined,
            }}
          >
            <Tooltip title="上一条">
              <Button
                size="small"
                icon={<LeftOutlined />}
                disabled={history.length === 0 || historyIndex === 0}
                onClick={goToPrev}
              />
            </Tooltip>

            <Text style={{ fontSize: 13, minWidth: 80, textAlign: 'center' }}>
              {currentRecord
                ? `第 ${historyIndex + 1}/${history.length} 条`
                : (
                  <Button type="link" size="small" onClick={goToNew} style={{ padding: 0 }}>
                    新建对话
                  </Button>
                )}
            </Text>

            <Tooltip title="下一条">
              <Button
                size="small"
                icon={<RightOutlined />}
                disabled={historyIndex >= history.length - 1 || historyIndex < 0}
                onClick={goToNext}
              />
            </Tooltip>

            {currentRecord && (
              <>
                <div style={{ width: 1, height: 20, background: '#e8e8e8' }} />
                <Tooltip title="返回新建">
                  <Button size="small" type="dashed" onClick={goToNew}>
                    新建
                  </Button>
                </Tooltip>
              </>
            )}
          </div>
        )}

        {/* --- History record meta --- */}
        {currentRecord && (
          <div style={{ fontSize: 12, color: '#888', lineHeight: 1.6 }}>
            <div>
              <Text type="secondary">页面：</Text>
              {pageLabelMap[currentRecord.page as PageType] || currentRecord.page}
            </div>
            <div>
              <Text type="secondary">指令：</Text>
              {currentRecord.instruction}
            </div>
            <div>
              <Text type="secondary">时间：</Text>
              {new Date(currentRecord.timestamp).toLocaleString()}
            </div>
            <div>
              <Text type="secondary">模型：</Text>
              {currentRecord.model}
            </div>
          </div>
        )}

        {/* --- Result display --- */}
        {currentRecord && displayContent && (
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
            {displayContent}
          </div>
        )}

        {/* --- Loading --- */}
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
