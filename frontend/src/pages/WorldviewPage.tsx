import React, { useCallback, useState } from 'react';
import { Button, Input, Space, Card, Typography, Empty, Popconfirm, Select, InputNumber, Tag, Divider } from 'antd';
import { PlusOutlined, DeleteOutlined, RobotOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';
import type { CharacterParamDefinition } from '../types';

const { Text } = Typography;
const { TextArea } = Input;

const WorldviewPage: React.FC = () => {
  const {
    project,
    addWorldBlock,
    updateWorldBlock,
    deleteWorldBlock,
    updateCharacterParams,
    setShowAI,
  } = useProjectStore();

  // Access worldSetting from project directly since the store doesn't expose it separately
  const blocks = project?.worldSetting || [];
  const characterParams = project?.characterParams || [];

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

  // --- Character Params handlers ---
  const handleAddParam = useCallback(() => {
    const newParam: CharacterParamDefinition = {
      name: '新参数',
      paramType: 'number',
      categories: [],
      minValue: 0,
      maxValue: 10,
    };
    updateCharacterParams([...characterParams, newParam]);
  }, [characterParams, updateCharacterParams]);

  const handleUpdateParam = useCallback(
    (index: number, updates: Partial<CharacterParamDefinition>) => {
      const updated = characterParams.map((p, i) =>
        i === index ? { ...p, ...updates } : p
      );
      updateCharacterParams(updated);
    },
    [characterParams, updateCharacterParams]
  );

  const handleDeleteParam = useCallback(
    (index: number) => {
      updateCharacterParams(characterParams.filter((_, i) => i !== index));
    },
    [characterParams, updateCharacterParams]
  );

  const handleAddCategory = useCallback(
    (index: number, category: string) => {
      const param = characterParams[index];
      if (!category.trim() || param.categories.includes(category.trim())) return;
      const updated = characterParams.map((p, i) =>
        i === index ? { ...p, categories: [...p.categories, category.trim()] } : p
      );
      updateCharacterParams(updated);
    },
    [characterParams, updateCharacterParams]
  );

  const handleRemoveCategory = useCallback(
    (index: number, cat: string) => {
      const updated = characterParams.map((p, i) =>
        i === index ? { ...p, categories: p.categories.filter((c) => c !== cat) } : p
      );
      updateCharacterParams(updated);
    },
    [characterParams, updateCharacterParams]
  );

  // Controlled input state for category entry (per param index)
  const [categoryInputs, setCategoryInputs] = useState<Record<number, string>>({});

  const commitCategory = useCallback(
    (index: number, raw: string) => {
      const val = raw.trim();
      if (!val) return;
      handleAddCategory(index, val);
      setCategoryInputs((prev) => ({ ...prev, [index]: '' }));
    },
    [handleAddCategory]
  );

  return (
    <div style={{ height: 'calc(100vh - 56px)', overflow: 'auto', padding: 16 }}>
      {/* --- Worldview Blocks --- */}
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

      {/* --- Character Params Settings --- */}
      <Divider style={{ margin: '32px 0 16px' }} />
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Text strong style={{ fontSize: 16 }}>
          人物参数设定
        </Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAddParam}>
          添加参数
        </Button>
      </div>
      <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 16 }}>
        设置此世界观中所有人物至少应拥有的属性。完成后，在人物详情页的「自定义属性」中即可看到这些待设置的字段。
      </Text>

      {characterParams.length === 0 ? (
        <Empty description="暂未设定人物参数，点击「添加参数」开始设置" style={{ marginTop: 60 }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {characterParams.map((param, index) => (
            <Card
              key={index}
              size="small"
              extra={
                <Popconfirm title="确认删除此参数?" onConfirm={() => handleDeleteParam(index)}>
                  <Button size="small" danger icon={<DeleteOutlined />} type="text" />
                </Popconfirm>
              }
              style={{ background: '#fafafa' }}
            >
              <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <Input
                  placeholder="参数名称（如：力量、阵营、年龄层）"
                  value={param.name}
                  onChange={(e) => handleUpdateParam(index, { name: e.target.value })}
                  style={{ width: 200 }}
                />
                <Select
                  value={param.paramType}
                  onChange={(v) => handleUpdateParam(index, { paramType: v })}
                  style={{ width: 100 }}
                  options={[
                    { value: 'category', label: '分类' },
                    { value: 'number', label: '数值' },
                  ]}
                />
                {param.paramType === 'category' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                    {param.categories.map((cat) => (
                      <Tag
                        key={cat}
                        closable
                        onClose={() => handleRemoveCategory(index, cat)}
                        color="blue"
                      >
                        {cat}
                      </Tag>
                    ))}
                    <Input
                      size="small"
                      placeholder="添加类别..."
                      style={{ width: 120 }}
                      value={categoryInputs[index] || ''}
                      onChange={(e) =>
                        setCategoryInputs((prev) => ({ ...prev, [index]: e.target.value }))
                      }
                      onPressEnter={(e) => commitCategory(index, (e.target as HTMLInputElement).value)}
                      onBlur={(e) => commitCategory(index, e.target.value)}
                    />
                  </div>
                )}
                {param.paramType === 'number' && (
                  <Space size={4} align="center">
                    <InputNumber
                      size="small"
                      placeholder="最小值"
                      value={param.minValue}
                      onChange={(v) => handleUpdateParam(index, { minValue: v ?? 0 })}
                      style={{ width: 80 }}
                    />
                    <span>~</span>
                    <InputNumber
                      size="small"
                      placeholder="最大值"
                      value={param.maxValue}
                      onChange={(v) => handleUpdateParam(index, { maxValue: v ?? 10 })}
                      style={{ width: 80 }}
                    />
                  </Space>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorldviewPage;
