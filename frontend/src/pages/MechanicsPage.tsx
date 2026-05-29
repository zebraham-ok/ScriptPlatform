import React, { useCallback, useState } from 'react';
import { Button, Input, Space, Card, Typography, Empty, Popconfirm, InputNumber, Tag, Select, message } from 'antd';
import { PlusOutlined, DeleteOutlined, RobotOutlined, ThunderboltOutlined, TableOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';
import { aiFillField } from '../api';
import { v4 as uuidv4 } from 'uuid';
import type { CheckDefinition, VoteDefinition } from '../types';

const { Text } = Typography;
const { TextArea } = Input;

const MechanicsPage: React.FC = () => {
  const { project, updateMechanics } = useProjectStore();
  const mechanics = project?.mechanics || { checks: [], votes: [] };
  const checks = mechanics.checks || [];
  const votes = mechanics.votes || [];

  // Get numeric character params from worldview for checkTarget dropdown
  const characterParams = project?.characterParams || [];
  const numericParamOptions = characterParams
    .filter((p) => p.paramType === 'number')
    .map((p) => ({ value: p.name, label: `${p.name} (${p.minValue}~${p.maxValue})` }));

  // AI fill state
  const [fillingId, setFillingId] = useState<string | null>(null);

  // --- Check handlers ---
  const handleAddCheck = useCallback(() => {
    const newCheck: CheckDefinition = {
      id: uuidv4(),
      name: '新检定',
      triggerCondition: '',
      difficulty: 5,
      checkTarget: '',
      description: 'randint(0, 检定对象)>=难度 则成功',
      successEffect: '',
      failureEffect: '',
    };
    updateMechanics({ ...mechanics, checks: [...checks, newCheck] });
  }, [checks, mechanics, updateMechanics]);

  const handleUpdateCheck = useCallback(
    (id: string, updates: Partial<CheckDefinition>) => {
      updateMechanics({
        ...mechanics,
        checks: checks.map((c) => (c.id === id ? { ...c, ...updates } : c)),
      });
    },
    [checks, mechanics, updateMechanics]
  );

  const handleDeleteCheck = useCallback(
    (id: string) => {
      updateMechanics({
        ...mechanics,
        checks: checks.filter((c) => c.id !== id),
      });
    },
    [checks, mechanics, updateMechanics]
  );

  const handleAIFillCheck = useCallback(
    async (check: CheckDefinition) => {
      if (!project) return;
      setFillingId(check.id);
      try {
        const result = await aiFillField({
          project_id: project.projectId,
          field_name: `检定-${check.name || '未命名'}`,
          existing_content: JSON.stringify({
            triggerCondition: check.triggerCondition,
            difficulty: check.difficulty,
            checkTarget: check.checkTarget,
            description: check.description,
            successEffect: check.successEffect,
            failureEffect: check.failureEffect,
          }),
          node_type: 'mechanics_check',
        });
        // Try to parse AI response as JSON to fill fields
        try {
          const parsed = JSON.parse(result.content);
          handleUpdateCheck(check.id, {
            triggerCondition: parsed.triggerCondition || check.triggerCondition,
            difficulty: parsed.difficulty ?? check.difficulty,
            checkTarget: parsed.checkTarget || check.checkTarget,
            description: parsed.description || check.description,
            successEffect: parsed.successEffect || check.successEffect,
            failureEffect: parsed.failureEffect || check.failureEffect,
          });
        } catch {
          // If not JSON, fill description with raw content
          handleUpdateCheck(check.id, { description: result.content });
        }
        message.success('AI 填充完成');
      } catch (e: any) {
        message.error(`AI 填充失败: ${e?.message || e}`);
      } finally {
        setFillingId(null);
      }
    },
    [project, handleUpdateCheck]
  );

  // --- Vote handlers ---
  const [voteOptionInputs, setVoteOptionInputs] = useState<Record<string, string>>({});

  const handleAddVote = useCallback(() => {
    const newVote: VoteDefinition = {
      id: uuidv4(),
      name: '新投票',
      options: [],
      participationCondition: '',
    };
    updateMechanics({ ...mechanics, votes: [...votes, newVote] });
  }, [votes, mechanics, updateMechanics]);

  const handleUpdateVote = useCallback(
    (id: string, updates: Partial<VoteDefinition>) => {
      updateMechanics({
        ...mechanics,
        votes: votes.map((v) => (v.id === id ? { ...v, ...updates } : v)),
      });
    },
    [votes, mechanics, updateMechanics]
  );

  const handleDeleteVote = useCallback(
    (id: string) => {
      updateMechanics({
        ...mechanics,
        votes: votes.filter((v) => v.id !== id),
      });
    },
    [votes, mechanics, updateMechanics]
  );

  const handleAddVoteOption = useCallback(
    (id: string, option: string) => {
      const vote = votes.find((v) => v.id === id);
      if (!vote || !option.trim() || vote.options.includes(option.trim())) return;
      handleUpdateVote(id, { options: [...vote.options, option.trim()] });
    },
    [votes, handleUpdateVote]
  );

  const handleRemoveVoteOption = useCallback(
    (id: string, option: string) => {
      const vote = votes.find((v) => v.id === id);
      if (!vote) return;
      handleUpdateVote(id, { options: vote.options.filter((o) => o !== option) });
    },
    [votes, handleUpdateVote]
  );

  const commitVoteOption = useCallback(
    (id: string, raw: string) => {
      const val = raw.trim();
      if (!val) return;
      handleAddVoteOption(id, val);
      setVoteOptionInputs((prev) => ({ ...prev, [id]: '' }));
    },
    [handleAddVoteOption]
  );

  const handleAIFillVote = useCallback(
    async (vote: VoteDefinition) => {
      if (!project) return;
      setFillingId(vote.id);
      try {
        const result = await aiFillField({
          project_id: project.projectId,
          field_name: `投票-${vote.name || '未命名'}`,
          existing_content: JSON.stringify({
            options: vote.options,
            participationCondition: vote.participationCondition,
          }),
          node_type: 'mechanics_vote',
        });
        try {
          const parsed = JSON.parse(result.content);
          handleUpdateVote(vote.id, {
            options: parsed.options || vote.options,
            participationCondition: parsed.participationCondition || vote.participationCondition,
          });
        } catch {
          handleUpdateVote(vote.id, { participationCondition: result.content });
        }
        message.success('AI 填充完成');
      } catch (e: any) {
        message.error(`AI 填充失败: ${e?.message || e}`);
      } finally {
        setFillingId(null);
      }
    },
    [project, handleUpdateVote]
  );

  return (
    <div style={{ height: 'calc(100vh - 56px)', padding: 16, display: 'flex', gap: 16 }}>
      {/* --- Left Column: Checks --- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Text strong style={{ fontSize: 16 }}>
            <ThunderboltOutlined style={{ marginRight: 8 }} />
            检定
          </Text>
          <Space>
            <Button icon={<RobotOutlined />} onClick={() => useProjectStore.getState().setShowAI(true)}>
              AI 助手
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAddCheck}>
              添加检定
            </Button>
          </Space>
        </div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          定义项目中的检定规则。人物、情节事件或物品可通过下拉框绑定这些检定。
        </Text>

        <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
          {checks.length === 0 ? (
            <Empty description="暂无检定，点击「添加检定」开始设置" style={{ marginTop: 40 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {checks.map((check) => (
                <Card
                  key={check.id}
                  size="small"
                  extra={
                    <Space size={0}>
                      <Button
                        size="small"
                        icon={<RobotOutlined />}
                        type="text"
                        loading={fillingId === check.id}
                        onClick={() => handleAIFillCheck(check)}
                        title="AI 辅助填充此检定"
                      />
                      <Popconfirm title="确认删除此检定?" onConfirm={() => handleDeleteCheck(check.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} type="text" />
                      </Popconfirm>
                    </Space>
                  }
                  title={
                    <Input
                      variant="borderless"
                      value={check.name}
                      onChange={(e) => handleUpdateCheck(check.id, { name: e.target.value })}
                      placeholder="检定名称"
                      style={{ fontWeight: 600, padding: 0, width: 180 }}
                    />
                  }
                  style={{ background: '#fafafa' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 48 }}>
                        触发条件
                      </Text>
                      <Input
                        size="small"
                        value={check.triggerCondition}
                        onChange={(e) => handleUpdateCheck(check.id, { triggerCondition: e.target.value })}
                        placeholder="如：角色试图打开锁着的门"
                        style={{ flex: 1 }}
                      />
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 28 }}>
                        难度
                      </Text>
                      <InputNumber
                        size="small"
                        min={1}
                        max={20}
                        value={check.difficulty}
                        onChange={(v) => handleUpdateCheck(check.id, { difficulty: v ?? 5 })}
                        style={{ width: 56 }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 48 }}>
                        检定对象
                      </Text>
                      <Select
                        size="small"
                        allowClear
                        value={check.checkTarget || undefined}
                        onChange={(v) => handleUpdateCheck(check.id, { checkTarget: v || '' })}
                        placeholder="选择世界观中设定的数值参数..."
                        style={{ flex: 1 }}
                        options={numericParamOptions}
                        notFoundContent="暂无数值参数，请先在世界观页面添加"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 48 }}>
                        说明
                      </Text>
                      <TextArea
                        size="small"
                        rows={2}
                        value={check.description}
                        onChange={(e) => handleUpdateCheck(check.id, { description: e.target.value })}
                        placeholder="如：randint(0, 力量)>=5 则成功"
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 48, color: '#52c41a' }}>
                        成功影响
                      </Text>
                      <TextArea
                        size="small"
                        rows={2}
                        value={check.successEffect}
                        onChange={(e) => handleUpdateCheck(check.id, { successEffect: e.target.value })}
                        placeholder="检定成功后的效果..."
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 48, color: '#ff4d4f' }}>
                        失败影响
                      </Text>
                      <TextArea
                        size="small"
                        rows={2}
                        value={check.failureEffect}
                        onChange={(e) => handleUpdateCheck(check.id, { failureEffect: e.target.value })}
                        placeholder="检定失败后的效果..."
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* --- Right Column: Votes --- */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, overflow: 'hidden' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}
        >
          <Text strong style={{ fontSize: 16 }}>
            <TableOutlined style={{ marginRight: 8 }} />
            投票
          </Text>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleAddVote}>
            添加投票
          </Button>
        </div>
        <Text type="secondary" style={{ fontSize: 12, display: 'block', marginBottom: 12 }}>
          定义项目中的投票机制。人物、情节事件或物品可通过下拉框绑定这些投票。
        </Text>

        <div style={{ flex: 1, overflow: 'auto', paddingRight: 4 }}>
          {votes.length === 0 ? (
            <Empty description="暂无投票，点击「添加投票」开始设置" style={{ marginTop: 40 }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {votes.map((vote) => (
                <Card
                  key={vote.id}
                  size="small"
                  extra={
                    <Space size={0}>
                      <Button
                        size="small"
                        icon={<RobotOutlined />}
                        type="text"
                        loading={fillingId === vote.id}
                        onClick={() => handleAIFillVote(vote)}
                        title="AI 辅助填充此投票"
                      />
                      <Popconfirm title="确认删除此投票?" onConfirm={() => handleDeleteVote(vote.id)}>
                        <Button size="small" danger icon={<DeleteOutlined />} type="text" />
                      </Popconfirm>
                    </Space>
                  }
                  title={
                    <Input
                      variant="borderless"
                      value={vote.name}
                      onChange={(e) => handleUpdateVote(vote.id, { name: e.target.value })}
                      placeholder="投票名称"
                      style={{ fontWeight: 600, padding: 0, width: 180 }}
                    />
                  }
                  style={{ background: '#fafafa' }}
                >
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 48, lineHeight: '30px' }}>
                        选项
                      </Text>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                        {vote.options.map((opt) => (
                          <Tag
                            key={opt}
                            closable
                            onClose={() => handleRemoveVoteOption(vote.id, opt)}
                            color="blue"
                          >
                            {opt}
                          </Tag>
                        ))}
                        <Input
                          size="small"
                          placeholder="添加选项..."
                          style={{ width: 120 }}
                          value={voteOptionInputs[vote.id] || ''}
                          onChange={(e) =>
                            setVoteOptionInputs((prev) => ({ ...prev, [vote.id]: e.target.value }))
                          }
                          onPressEnter={(e) => commitVoteOption(vote.id, (e.target as HTMLInputElement).value)}
                          onBlur={(e) => commitVoteOption(vote.id, e.target.value)}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <Text type="secondary" style={{ fontSize: 12, whiteSpace: 'nowrap', minWidth: 48 }}>
                        参与条件
                      </Text>
                      <TextArea
                        size="small"
                        rows={2}
                        value={vote.participationCondition}
                        onChange={(e) => handleUpdateVote(vote.id, { participationCondition: e.target.value })}
                        placeholder="如：所有存活角色均可投票"
                      />
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MechanicsPage;
