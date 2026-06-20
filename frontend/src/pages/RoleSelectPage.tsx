import React, { useState } from 'react';
import { Button, message, Spin } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';
import { useGameStore } from '../store/useGameStore';
import type { RoleDetail } from '../types';

const RoleSelectPage: React.FC = () => {
  const setCurrentPage = useProjectStore((s) => s.setCurrentPage);
  const { roomInfo, roleDetails, availableRoles, selectRole, submitCharacterSheet, playerReady, players, assignedRoles, playerId } = useGameStore();
  const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
  const [customAttrs, setCustomAttrs] = useState<Record<string, string>>({});

  // Build character list from store roleDetails (populated by role_update socket event)
  const characters: any[] = (roleDetails || [])
    .filter((r) => !availableRoles || availableRoles.length === 0 || availableRoles.includes(r.id))
    .map((r) => ({
      id: r.id,
      name: r.name,
      description: r.description,
      personality: r.personality,
      identity: r.identity,
      appearance: r.appearance,
      attributes: r.attributes,
      customizableAttributes: r.customizableAttributes,
      numericAttributeCap: r.numericAttributeCap,
    }));

  const selectedChar = characters.find((c) => c.id === selectedCharId);
  const hasCustomFields = (selectedChar?.customizableAttributes?.length ?? 0) > 0;

  // Calculate total of numeric attributes for validation
  const cap = selectedChar?.numericAttributeCap ?? null;
  const numericFields = (selectedChar?.customizableAttributes || []).filter(
    (f: any) => f.type === 'number'
  );
  const totalAttrSum = numericFields.reduce(
    (sum: number, f: any) => sum + parseInt(customAttrs[f.path] || '10', 10),
    0
  );
  const capExceeded = cap != null && totalAttrSum > cap;

  const handleSelectRole = (characterId: string) => {
    setSelectedCharId(characterId);
    selectRole(characterId);
    message.success('角色已选择');
    // Reset custom attrs for the newly selected role
    const char = (roleDetails as RoleDetail[])?.find((r) => r.id === characterId);
    if (char?.customizableAttributes) {
      const init: Record<string, string> = {};
      char.customizableAttributes.forEach((f) => {
        if (f.type === 'text') {
          const val = char.attributes?.[f.displayName];
          init[f.path] = typeof val === 'string' ? val : '';
        } else {
          const val = char.attributes?.[f.displayName] ?? 5;
          init[f.path] = String(val);
        }
      });
      setCustomAttrs(init);
    } else {
      setCustomAttrs({});
    }
  };

  const handleSubmitSheet = () => {
    if (!selectedCharId || capExceeded) return;
    const attrs: Record<string, any> = {};
    Object.entries(customAttrs).forEach(([k, v]) => {
      const num = Number(v);
      attrs[k] = isNaN(num) ? v : num;
    });
    submitCharacterSheet(selectedCharId, attrs);
    message.success('角色卡已提交');
  };

  const handleReady = () => {
    playerReady();
    message.success('已准备就绪！');
  };

  if (!roomInfo) {
    return (
      <div className="game-mode flex items-center justify-center">
        <Spin tip="加载房间信息..." />
      </div>
    );
  }

  return (
    <div className="game-mode flex flex-col min-h-screen">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-slate-700/50 flex items-center justify-between bg-slate-900/90">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage('lobby')}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            ← 返回大厅
          </button>
          <h1 className="text-lg font-bold text-white">🎭 角色选择</h1>
          <span className="text-xs text-slate-500">
            房间 {roomInfo.roomId}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">
            {Object.keys(players).length} 人在线
          </span>
          <Button
            onClick={handleReady}
            disabled={!selectedCharId}
            className="!bg-green-600 !border-green-600 hover:!bg-green-500 !text-white !font-semibold"
            size="small"
          >
            准备就绪
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 game-scrollbar bg-slate-900">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-slate-300 mb-6">
            选择你要扮演的角色
          </h2>

          {characters.length === 0 ? (
            <div className="text-center text-slate-400 mt-20">
              <div className="text-4xl mb-4">🎭</div>
              <p>暂无预设角色</p>
              <p className="text-xs mt-1">
                {roomInfo.mode === 'sandbox'
                  ? 'AI 将在游戏开始后为你分配角色'
                  : '等待房主开始游戏'}
              </p>
              {roomInfo.mode === 'sandbox' && (
                <Button
                  onClick={handleReady}
                  type="primary"
                  className="mt-4 !bg-amber-500 !border-amber-500 !text-white"
                  icon={<ThunderboltOutlined />}
                >
                  我准备好了，开始吧！
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {characters.map((char: any) => {
                const isTaken = Object.values(assignedRoles).includes(char.id) && assignedRoles[char.id] !== playerId;
                const isMine = assignedRoles[char.id] === playerId;
                return (
                  <button
                    key={char.id}
                    onClick={() => !isTaken && handleSelectRole(char.id)}
                    disabled={isTaken}
                    className={`game-panel p-4 text-left transition-all cursor-pointer
                      ${isTaken ? 'opacity-40 cursor-not-allowed' :
                        isMine ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50' :
                        'hover:border-amber-500/40'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-white">{char.name}</h4>
                      {isTaken && <span className="text-xs text-red-400">已选</span>}
                      {isMine && <span className="text-xs text-amber-400">✓ 我的</span>}
                    </div>
                    {char.identity && (
                      <p className="text-xs text-amber-400/70 mb-1">{char.identity}</p>
                    )}
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {char.personality || char.description || '暂无描述'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Character sheet editor */}
          {selectedCharId && hasCustomFields && selectedChar && (
            <div className="game-panel mt-6 p-4">
              <h3 className="text-amber-400 font-bold mb-3">
                📋 {selectedChar.name} — 自定义属性
              </h3>
              {cap != null && numericFields.length > 0 && (
                <div className={`text-sm font-semibold mb-3 flex items-center gap-2 flex-wrap
                  ${capExceeded ? 'text-red-400' : 'text-slate-400'}`}>
                  <span>属性上限：{cap}</span>
                  <span className={`text-xs px-2 py-0.5 rounded
                    ${capExceeded ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                    当前总计：{totalAttrSum}
                  </span>
                  {capExceeded && (
                    <span className="text-xs text-red-400 animate-pulse">⚠ 超出上限</span>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {(selectedChar.customizableAttributes || []).map((field: any) => {
                  if (field.type === 'text') {
                    // Text field: render as text input
                    return (
                      <div key={field.path} className="flex items-center gap-3">
                        <label className="text-sm text-slate-300 w-20 flex-shrink-0">
                          {field.displayName}
                        </label>
                        <input
                          type="text"
                          value={customAttrs[field.path] || ''}
                          onChange={(e) =>
                            setCustomAttrs((p) => ({ ...p, [field.path]: e.target.value }))
                          }
                          placeholder={`输入${field.displayName}`}
                          className="flex-1 bg-slate-700 border border-slate-600 rounded px-3 py-1.5
                            text-sm text-white placeholder-slate-500
                            focus:outline-none focus:border-amber-500/60 transition-colors"
                        />
                      </div>
                    );
                  }
                  // Number field: render as slider
                  const fieldCap = cap || 99;
                  const currentVal = parseInt(customAttrs[field.path] || '5', 10);
                  return (
                    <div key={field.path} className="flex items-center gap-3">
                      <label className="text-sm text-slate-300 w-20 flex-shrink-0">
                        {field.displayName}
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={fieldCap}
                        value={currentVal}
                        onChange={(e) =>
                          setCustomAttrs((p) => ({ ...p, [field.path]: e.target.value }))
                        }
                        className="flex-1 accent-amber-500"
                      />
                      <span className={`font-mono text-sm w-8 text-right
                        ${capExceeded ? 'text-red-400' : 'text-amber-400'}`}>
                        {currentVal}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Button
                onClick={handleSubmitSheet}
                disabled={capExceeded}
                className={`mt-4 !border-amber-500 !text-white !font-semibold
                  ${capExceeded
                    ? '!bg-slate-600 !border-slate-600 !opacity-40 !cursor-not-allowed hover:!bg-slate-600'
                    : '!bg-amber-500 hover:!bg-amber-400'}`}
                block
              >
                确认角色卡
              </Button>
              {capExceeded && (
                <p className="text-xs text-red-400 text-center mt-2">
                  属性总和 ({totalAttrSum}) 不能超过上限 ({cap})，请调整后再确认
                </p>
              )}
            </div>
          )}

          {/* Fallback for non-customizable roles */}
          {selectedCharId && !hasCustomFields && selectedChar && (
            <div className="game-panel mt-6 p-4">
              <h3 className="text-amber-400 font-bold mb-3">📋 {selectedChar.name}</h3>
              {selectedChar.attributes && (
                <div className="space-y-2 mb-3">
                  {Object.entries(selectedChar.attributes).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="text-sm text-slate-300 w-20">{key}</span>
                      <span className="text-amber-400 font-mono text-sm">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
              <Button
                onClick={handleSubmitSheet}
                className="mt-4 !bg-amber-500 !border-amber-500 hover:!bg-amber-400 !text-white !font-semibold"
                block
              >
                确认角色卡
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoleSelectPage;
