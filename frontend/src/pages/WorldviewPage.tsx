import React, { useCallback } from 'react';
import { Button, Input, Space, Card, Typography, Empty, Popconfirm } from 'antd';
import { PlusOutlined, DeleteOutlined, RobotOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';

const { Text } = Typography;
const { TextArea } = Input;

const WorldviewPage: React.FC = () => {
  const {
    project,
    addWorldBlock,
    updateWorldBlock,
    deleteWorldBlock,
    setShowAI,
  } = useProjectStore();

  // Access worldSetting from project directly since the store doesn't expose it separately
  const blocks = project?.worldSetting || [];

  const handleAdd = useCallback(() => {
    addWorldBlock();
  }, [addWorldBlock]);

  const handleDelete = useCallback(
    (id: string) => {
      deleteWorldBlock(id);
    },
    [deleteWorldBlock]
  );

  const handleTitleChange = useCallback(
    (id: string, value: string) => {
      updateWorldBlock(id, { title: value });
    },
    [updateWorldBlock]
  );

  const handleContentChange = useCallback(
    (id: string, value: string) => {
      updateWorldBlock(id, { content: value });
    },
    [updateWorldBlock]
  );

  return (
    <div style={{ height: 'calc(100vh - 56px)', overflow: 'auto', padding: 16 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Text strong style={{ fontSize: 16 }}>
          世界观设定
        </Text>
        <Space>
          <Button icon={<RobotOutlined />} onClick={() => setShowAI(true)}>
            AI 助手
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
            添加模块
          </Button>
        </Space>
      </div>

      {blocks.length === 0 ? (
        <Empty description={'暂无世界观设定，点击「添加模块」开始创作'} style={{ marginTop: 120 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {blocks.map((block) => (
            <Card
              key={block.id}
              size="small"
              extra={
                <Popconfirm title="确认删除?" onConfirm={() => handleDelete(block.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />} type="text" />
                </Popconfirm>
              }
              title={
                <Input
                  variant="borderless"
                  value={block.title}
                  onChange={(e) => handleTitleChange(block.id, e.target.value)}
                  placeholder="模块标题（如：历史背景）"
                  style={{ fontWeight: 600, padding: 0 }}
                />
              }
            >
              <TextArea
                rows={8}
                value={block.content}
                onChange={(e) => handleContentChange(block.id, e.target.value)}
                placeholder="在此撰写世界观内容，支持 Markdown 格式..."
                style={{ border: 'none', resize: 'vertical', background: 'transparent' }}
              />
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorldviewPage;
