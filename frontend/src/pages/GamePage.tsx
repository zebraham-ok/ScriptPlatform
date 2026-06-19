import React, { useEffect, useState } from 'react';
import { Button, Input, Modal, message } from 'antd';
import { ThunderboltOutlined, UserOutlined, CopyOutlined, LinkOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';
import { useGameStore } from '../store/useGameStore';
import type { RoleDetail } from '../types';
import ChatPanel from '../components/GameRoom/ChatPanel';
import CharacterSheet from '../components/GameRoom/CharacterSheet';
import SceneBackground from '../components/GameRoom/SceneBackground';
import DiceAnimation from '../components/GameRoom/DiceAnimation';
import RoundBanner from '../components/GameRoom/RoundBanner';
import EndingCard from '../components/GameRoom/EndingCard';
import ActionInput from '../components/GameRoom/ActionInput';
import DMPrivateMessage from '../components/GameRoom/DMPrivateMessage';
import TurnTimer from '../components/GameRoom/TurnTimer';
import { getRoomStatus } from '../api';
import { getToken, getStoredUser } from '../api';

const GamePage: React.FC = () => {
  const setCurrentPage = useProjectStore((s) => s.setCurrentPage);
  const roomIdFromUrl = new URLSearchParams(window.location.search).get('roomId');

  const {
    roomInfo, stage, loading, error, playerId,
    players, socketConnected, showNicknameModal, isCreator,
    connectAndJoin, disconnect, leaveRoom,
    setShowNicknameModal, requestStartGame,
    availableRoles, roleDetails, assignedRoles,
    selectRole, submitCharacterSheet, playerReady,
  } = useGameStore() as any;

  const [nicknameInput, setNicknameInput] = useState('');
  const [joinLoading, setJoinLoading] = useState(false);
  const [showShareCopied, setShowShareCopied] = useState(false);
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [customAttrs, setCustomAttrs] = useState<Record<string, string>>({});

  // Auto-join via URL link
  useEffect(() => {
    if (roomIdFromUrl && !roomInfo) {
      const storedUser = getStoredUser();
      if (storedUser) {
        setNicknameInput(storedUser.displayName);
      }
      setShowNicknameModal(true);
    }
  }, [roomIdFromUrl]);

  const handleJoinViaLink = () => {
    const name = nicknameInput.trim() || storedUser?.displayName || '游客';
    if (!name) {
      message.warning('请输入昵称');
      return;
    }
    setJoinLoading(true);
    connectAndJoin(roomIdFromUrl || '', name, false);
    setShowNicknameModal(false);
    // TODO: listen for room_joined event to set joinLoading false
    setTimeout(() => setJoinLoading(false), 3000);
  };

  const handleCopyShareLink = () => {
    if (roomInfo) {
      const url = `${window.location.origin}/game?roomId=${roomInfo.roomId}`;
      navigator.clipboard.writeText(url).then(() => {
        setShowShareCopied(true);
        message.success('分享链接已复制！');
        setTimeout(() => setShowShareCopied(false), 2000);
      });
    }
  };

  const handleLeave = () => {
    leaveRoom();
    setCurrentPage('plaza');
  };

  const handleStartGame = () => {
    useGameStore.getState().startGame();
  };

  const handleSelectRole = (charId: string) => {
    setSelectedRoleId(charId);
    selectRole(charId);
    message.success('角色已选择');
    // Reset custom attrs for the newly selected role
    const role = (roleDetails as RoleDetail[])?.find((r) => r.id === charId);
    if (role) {
      const init: Record<string, string> = {};
      (role.customizableAttributes || []).forEach((f) => {
        // Default from existing attributes
        const val = role.attributes?.[f.displayName] ?? 5;
        init[f.path] = String(val);
      });
      setCustomAttrs(init);
    }
  };

  const handleSubmitCharacterSheet = () => {
    if (!selectedRoleId) return;
    const attrs: Record<string, any> = {};
    Object.entries(customAttrs).forEach(([k, v]) => {
      const num = Number(v);
      attrs[k] = isNaN(num) ? v : num;
    });
    submitCharacterSheet(selectedRoleId, attrs);
    message.success('角色卡已提交');
  };

  const handlePlayerReady = () => {
    playerReady();
    message.success('已准备就绪！');
  };

  // ---- Role Selection Modal (overlays the game UI) ----
  const renderRoleSelectionModal = () => {
    const roles = (roleDetails as RoleDetail[]) || [];
    console.log('[GamePage] renderRoleSelectionModal: roleDetails length=', roles.length,
      'roleDetails=', roles, 'availableRoles=', availableRoles);
    const currentPlayerId = playerId;

    const myAssignedRoleId = Object.entries(assignedRoles as Record<string, string> || {})
      .find(([, pid]) => pid === currentPlayerId)?.[0];

    const selectedRole = roles.find((r) => r.id === myAssignedRoleId);
    const hasCustomFields = (selectedRole?.customizableAttributes?.length ?? 0) > 0;

    return (
      <Modal
        title={null}
        open={true}
        closable={false}
        footer={null}
        maskClosable={false}
        width={720}
        className="game-mode role-select-modal"
        styles={{ body: { padding: 0, maxHeight: '80vh', overflowY: 'auto' } }}
      >
        <div className="p-6 game-scrollbar" style={{ maxHeight: '80vh' }}>
          {/* Header */}
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🎭</div>
            <h2 className="text-2xl font-bold text-white mb-1">选择你的角色</h2>
            <p className="text-slate-400 text-sm">
              {roomInfo?.scriptTitle || '游戏'} — 请选择你要扮演的角色
            </p>
          </div>

          {/* Role cards */}
          {roles.length === 0 ? (
            <div className="text-center text-slate-500 py-8">
              <div className="text-4xl mb-3">⏳</div>
              <p>角色正在生成中，请稍候...</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {roles.map((role: RoleDetail) => {
                const takenBy = Object.entries(assignedRoles as Record<string, string> || {})
                  .find(([cid, pid]) => cid === role.id && pid !== currentPlayerId);
                const isTaken = !!takenBy;
                const isMine = myAssignedRoleId === role.id;

                return (
                  <button
                    key={role.id}
                    onClick={() => !isTaken && handleSelectRole(role.id)}
                    disabled={isTaken}
                    className={`game-panel p-4 text-left transition-all cursor-pointer
                      ${isTaken ? 'opacity-40 cursor-not-allowed' :
                        isMine ? 'border-amber-500 bg-amber-500/10 ring-1 ring-amber-500/50' :
                        'hover:border-amber-500/50 hover:bg-amber-500/5'}`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-bold text-base text-white">{role.name}</h4>
                      {isTaken && <span className="text-xs text-red-400 font-semibold">已被选</span>}
                      {isMine && <CheckCircleOutlined className="text-amber-400" />}
                    </div>
                    {role.identity && (
                      <p className="text-xs text-amber-400/70 mb-1">{role.identity}</p>
                    )}
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {role.description || '暂无详细描述'}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Customizable attributes form */}
          {selectedRole && hasCustomFields && (
            <div className="game-panel mt-4 p-4">
              <h3 className="text-amber-400 font-bold mb-3 text-base">
                📋 {selectedRole.name} — 自定义属性
              </h3>
              {selectedRole.numericAttributeCap != null && (
                <p className="text-xs text-slate-500 mb-3">
                  属性上限：{selectedRole.numericAttributeCap}
                </p>
              )}
              <div className="space-y-3">
                {(selectedRole.customizableAttributes || []).map((field) => {
                  const cap = selectedRole.numericAttributeCap || 99;
                  const currentVal = parseInt(customAttrs[field.path] || '5', 10);
                  return (
                    <div key={field.path} className="flex items-center gap-3">
                      <label className="text-sm text-slate-400 w-20 flex-shrink-0">
                        {field.displayName}
                      </label>
                      <input
                        type="range"
                        min={0}
                        max={cap}
                        value={currentVal}
                        onChange={(e) =>
                          setCustomAttrs((p) => ({ ...p, [field.path]: e.target.value }))
                        }
                        className="flex-1 accent-amber-500"
                      />
                      <span className="text-amber-400 font-mono text-sm w-8 text-right">
                        {currentVal}
                      </span>
                    </div>
                  );
                })}
              </div>
              <Button
                onClick={handleSubmitCharacterSheet}
                className="mt-4 !bg-amber-500 !border-amber-500 hover:!bg-amber-400"
                block
                size="large"
              >
                确认角色卡
              </Button>
            </div>
          )}

          {/* Status info + Ready button */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-500 mb-3">
              {myAssignedRoleId
                ? (hasCustomFields
                    ? '✅ 已选择角色，请完善角色卡属性后确认提交'
                    : '✅ 已选择角色，等待其他玩家就绪...')
                : '👆 请点击上方角色卡片进行选择'}
            </p>
            {myAssignedRoleId && (
              <Button
                onClick={handlePlayerReady}
                size="large"
                className="!bg-green-600 !border-green-600 hover:!bg-green-500 !text-white !font-bold"
              >
                ✅ 准备就绪
              </Button>
            )}
          </div>
        </div>
      </Modal>
    );
  };

  // ---- Nickname modal for guest join ----
  const renderNicknameModal = () => (
    <Modal
      title="加入游戏房间"
      open={showNicknameModal}
      closable={false}
      footer={null}
      maskClosable={false}
      width={380}
      className="game-mode"
    >
      <div className="py-4">
        <div className="text-center mb-6">
          <div className="text-4xl mb-3">🎮</div>
          <h3 className="text-white text-lg font-bold">输入昵称加入游戏</h3>
          <p className="text-slate-400 text-sm mt-1">房间 {roomIdFromUrl}</p>
        </div>
        <Input
          prefix={<UserOutlined className="text-slate-400" />}
          value={nicknameInput}
          onChange={(e) => setNicknameInput(e.target.value)}
          placeholder="你的昵称（其他玩家可见）"
          size="large"
          onPressEnter={handleJoinViaLink}
          className="!bg-slate-700 !border-slate-600 !text-white"
        />
        <Button
          type="primary"
          block
          size="large"
          loading={joinLoading}
          onClick={handleJoinViaLink}
          className="mt-4 !bg-amber-500 !border-amber-500 !h-11 !font-bold"
        >
          加入游戏
        </Button>
      </div>
    </Modal>
  );

  // ---- Waiting for connection ----
  if (!roomInfo && !error) {
    return (
      <div className="game-mode flex items-center justify-center">
        <div className="text-center">
          {showNicknameModal ? (
            renderNicknameModal()
          ) : (
            <>
              <div className="text-5xl mb-4 animate-bounce">🎮</div>
              <p className="text-slate-400">正在加载游戏...</p>
            </>
          )}
        </div>
      </div>
    );
  }

  // ---- Main game interface ----
  return (
    <div className="game-mode flex flex-col h-screen">
      {/* Header */}
      <header className="flex-shrink-0 px-4 py-2 border-b border-slate-700/50 flex items-center justify-between bg-slate-900/90 backdrop-blur z-10">
        <div className="flex items-center gap-3">
          <button
            onClick={handleLeave}
            className="text-slate-400 hover:text-white text-sm"
          >
            ← 离开
          </button>
          <h1 className="text-sm font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
            {roomInfo?.scriptTitle || roomInfo?.roomName || '游戏房间'}
          </h1>
          <span className="text-xs text-slate-600">#{roomInfo?.roomId}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${socketConnected ? 'bg-green-500' : 'bg-red-500'}`} />
          <span className="text-xs text-slate-500">
            {Object.keys(players).length} 人在线
          </span>
          <TurnTimer />
          <button
            onClick={handleCopyShareLink}
            className="text-xs text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1"
          >
            <LinkOutlined /> 分享
          </button>
        </div>
      </header>

      {/* Body: 3-column layout (always visible behind modals) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left: Character Sheet */}
        <aside className="w-64 flex-shrink-0 border-r border-slate-700/50">
          <CharacterSheet />
        </aside>

        {/* Center: Chat + Scene */}
        <main className="flex-1 flex flex-col min-w-0">
          <SceneBackground />
          <div className="flex-1 overflow-hidden">
            <ChatPanel />
          </div>
          <ActionInput />
        </main>

        {/* Right: Room Info (optional) */}
        <aside className="w-48 flex-shrink-0 border-l border-slate-700/50 p-3 hidden lg:block">
          <div className="space-y-3">
            <div>
              <h4 className="text-xs text-slate-500 font-semibold mb-2">玩家列表</h4>
              {Object.values(players).map((p: any) => (
                <div key={p.playerId || p.sid || Math.random()} className="flex items-center gap-2 py-1.5">
                  <div className={`w-2 h-2 rounded-full ${p.characterId ? 'bg-green-500' : 'bg-slate-600'}`} />
                  <span className="text-xs text-slate-400">{p.nickname}</span>
                  {p.characterName && (
                    <span className="text-xs text-amber-400/60 ml-auto">{p.characterName}</span>
                  )}
                </div>
              ))}
            </div>

            {stage === 'LOBBY' && isCreator && (
              <Button
                type="primary"
                block
                onClick={handleStartGame}
                className="!bg-amber-500 !border-amber-500"
                icon={<ThunderboltOutlined />}
              >
                开始游戏
              </Button>
            )}

            <div className="text-xs text-slate-600">
              <p>模式：{roomInfo?.mode === 'sandbox' ? 'AI 沙盒' :
                        roomInfo?.mode === 'script' ? '预设剧本' : '导入'}</p>
              <p>阶段：{stage || 'LOBBY'}</p>
            </div>
          </div>
        </aside>
      </div>

      {/* Overlays */}
      <DiceAnimation />
      <RoundBanner />
      <EndingCard />
      <DMPrivateMessage />
      {stage === 'ROLE_SELECT' && renderRoleSelectionModal()}
      {renderNicknameModal()}
    </div>
  );
};

export default GamePage;
