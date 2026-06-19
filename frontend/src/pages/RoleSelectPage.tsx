import React, { useState } from 'react';
import { Button, message, Spin } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';
import { useGameStore } from '../store/useGameStore';

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
    }));

  const handleSelectRole = (characterId: string) => {
    setSelectedCharId(characterId);
    selectRole(characterId);
    message.success('角色已选择');
  };

  const handleSubmitSheet = () => {
    if (!selectedCharId) return;
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
    <div className="game-mode flex flex-col">
      {/* Header */}
      <header className="flex-shrink-0 px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
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
          <span className="text-xs text-slate-500">
            {Object.keys(players).length} 人在线
          </span>
          <Button
            onClick={handleReady}
            disabled={!selectedCharId}
            className="!bg-green-600 !border-green-600 hover:!bg-green-500 !text-white"
            size="small"
          >
            准备就绪
          </Button>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 game-scrollbar">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-center text-slate-400 mb-6">
            选择你要扮演的角色
          </h2>

          {characters.length === 0 ? (
            <div className="text-center text-slate-500 mt-20">
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
                  className="mt-4 !bg-amber-500 !border-amber-500"
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
                      ${isTaken ? 'opacity-50 cursor-not-allowed' :
                        isMine ? 'border-amber-500 bg-amber-500/10' :
                        'hover:border-amber-500/40'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-white">{char.name}</h4>
                      {isTaken && <span className="text-xs text-red-400">已选</span>}
                    </div>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {char.personality || char.description || '暂无描述'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Character sheet editor */}
          {selectedCharId && (
            <div className="game-panel mt-6 p-4">
              <h3 className="text-amber-400 font-bold mb-3">📋 角色属性</h3>
              <div className="space-y-3">
                {['力量', '敏捷', '智力', '魅力'].map((attr) => (
                  <div key={attr} className="flex items-center gap-3">
                    <label className="text-sm text-slate-400 w-16">{attr}</label>
                    <input
                      type="range"
                      min={1}
                      max={20}
                      value={customAttrs[attr] || '10'}
                      onChange={(e) => setCustomAttrs((p) => ({ ...p, [attr]: e.target.value }))}
                      className="flex-1 accent-amber-500"
                    />
                    <span className="text-amber-400 font-mono text-sm w-8 text-right">
                      {customAttrs[attr] || '10'}
                    </span>
                  </div>
                ))}
              </div>
              <Button
                onClick={handleSubmitSheet}
                className="mt-4 !bg-amber-500 !border-amber-500 hover:!bg-amber-400"
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
