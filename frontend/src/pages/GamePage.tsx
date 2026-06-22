import React, { useEffect, useRef, useState } from 'react';
import { Button, Input, Modal, Slider, message } from 'antd';
import { ThunderboltOutlined, UserOutlined, CopyOutlined, LinkOutlined, CheckCircleOutlined, SoundOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';
import { useGameStore } from '../store/useGameStore';
import type { RoleDetail } from '../types';
import ChatPanel from '../components/GameRoom/ChatPanel';
import CharacterSheet from '../components/GameRoom/CharacterSheet';
import SceneBackground from '../components/GameRoom/SceneBackground';
import DiceAnimation from '../components/GameRoom/DiceAnimation';
import VotePanel from '../components/GameRoom/VotePanel';
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

  const store = useGameStore() as any;
  const {
    roomInfo, stage, loading, error, playerId,
    players, socketConnected, showNicknameModal, isCreator,
    connectAndJoin, disconnect, leaveRoom,
    setShowNicknameModal, requestStartGame,
    availableRoles, roleDetails, assignedRoles,
    selectRole, submitCharacterSheet, playerReady,
  } = store;

  const currentBgm: string | null = store.currentBgm;
  const bgmEnabled: boolean = store.bgmEnabled;
  const bgmVolume: number = store.bgmVolume;
  const setBgmVolume: (v: number) => void = store.setBgmVolume;

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
    const storedUser = getStoredUser();
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
        if (f.type === 'text') {
          // Text field: use existing attribute value or empty string
          const val = role.attributes?.[f.displayName];
          init[f.path] = typeof val === 'string' ? val : '';
        } else {
          // Number field: default to existing value or 5
          const val = role.attributes?.[f.displayName] ?? 5;
          init[f.path] = String(val);
        }
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

  // ---- BGM Audio ----
  const bgmAudioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // console.log('[BGM] useEffect triggered', {
    //   currentBgm,
    //   bgmEnabled,
    //   hasAudioRef: !!bgmAudioRef.current,
    // });

    // Create audio element once
    if (!bgmAudioRef.current) {
      const audio = new Audio();
      audio.loop = true;
      audio.volume = bgmVolume;
      bgmAudioRef.current = audio;
      // console.log(`[BGM] Audio element created, loop=true, volume=${bgmVolume}`);
    }

    const audio = bgmAudioRef.current;
    const bgmUrl = currentBgm ? `/resource/music/${encodeURIComponent(currentBgm)}` : null;
    // console.log('[BGM] Constructed URL:', bgmUrl);

    if (bgmEnabled && bgmUrl) {
      const currentSrc = audio.src;
      // console.log('[BGM] bgmEnabled=true, currentSrc:', currentSrc);
      // Only set new src if it changed
      if (!currentSrc.endsWith(bgmUrl)) {
        // console.log('[BGM] Setting new src:', bgmUrl);
        audio.src = bgmUrl;
        audio.play()
          .then(() => {/* console.log('[BGM] play() succeeded') */})
          .catch((err) => {/* console.warn('[BGM] play() failed:', err) */});
      } else if (audio.paused) {
        // console.log('[BGM] Same src, resuming paused audio');
        audio.play()
          .then(() => {/* console.log('[BGM] resume play() succeeded') */})
          .catch((err) => {/* console.warn('[BGM] resume play() failed:', err) */});
      } // else: already playing, no change needed
    } else {
      // console.log('[BGM] Disabled or no URL — pausing', { bgmEnabled, bgmUrl });
      audio.pause();
      if (audio.src) {
        audio.src = '';
      }
    }

    // Listen for errors on the audio element
    const onError = (e: Event) => {
      const el = e.target as HTMLAudioElement;
      // console.error('[BGM] Audio error:', {
      //   src: el.src,
      //   error: el.error?.message,
      //   code: el.error?.code,
      //   networkState: el.networkState,
      //   readyState: el.readyState,
      // });
    };
    const onCanPlay = () => {/* console.log('[BGM] canplay event') */};
    const onLoadedData = () => {/* console.log('[BGM] loadeddata event') */};
    audio.addEventListener('error', onError);
    audio.addEventListener('canplay', onCanPlay);
    audio.addEventListener('loadeddata', onLoadedData);

    return () => {
      // console.log('[BGM] useEffect cleanup');
      audio.removeEventListener('error', onError);
      audio.removeEventListener('canplay', onCanPlay);
      audio.removeEventListener('loadeddata', onLoadedData);
    };
  }, [currentBgm, bgmEnabled]);

  // ---- BGM Volume Sync ----
  useEffect(() => {
    const audio = bgmAudioRef.current;
    if (audio) {
      audio.volume = bgmVolume;
    }
  }, [bgmVolume]);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      bgmAudioRef.current?.pause();
      bgmAudioRef.current = null;
    };
  }, []);

  // ---- Role Selection Modal (overlays the game UI) ----
  const renderRoleSelectionModal = () => {
    const roles = (roleDetails as RoleDetail[]) || [];
    // console.log('[GamePage] renderRoleSelectionModal: roleDetails length=', roles.length,
    //   'roleDetails=', roles, 'availableRoles=', availableRoles);
    const currentPlayerId = playerId;

    const myAssignedRoleId = Object.entries(assignedRoles as Record<string, string> || {})
      .find(([, pid]) => pid === currentPlayerId)?.[0];

    const selectedRole = roles.find((r) => r.id === myAssignedRoleId);
    const hasCustomFields = (selectedRole?.customizableAttributes?.length ?? 0) > 0;

    // Calculate total of numeric custom attributes for validation (exclude text fields)
    const cap = selectedRole?.numericAttributeCap ?? null;
    const numericFields = (selectedRole?.customizableAttributes || []).filter(
      (f) => f.type !== 'text'
    );
    const totalAttrSum = numericFields.reduce(
      (sum, f) => sum + parseInt(customAttrs[f.path] || '5', 10),
      0
    );
    const capExceeded = cap != null && totalAttrSum > cap;

    return (
      <Modal
        title={null}
        open={true}
        closable={false}
        footer={null}
        maskClosable={false}
        width={720}
        className="game-mode role-select-modal"
        styles={{
          body: { padding: 0, maxHeight: '80vh', overflowY: 'auto', background: '#0f172a' },
          content: { background: '#0f172a', border: '1px solid #334155' },
        }}
      >
        <div className="p-6 game-scrollbar" style={{ maxHeight: '80vh', background: '#0f172a' }}>
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
            <div className="text-center text-slate-400 py-8">
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
              {cap != null && (
                <div className={`text-sm font-semibold mb-3 flex items-center gap-2
                  ${capExceeded ? 'text-red-400' : 'text-slate-400'}`}>
                  <span>属性上限：{cap}</span>
                  <span className="text-xs px-2 py-0.5 rounded
                    ${capExceeded ? 'bg-red-500/20 text-red-400' : 'bg-slate-700 text-slate-400'}">
                    当前总计：{totalAttrSum}
                  </span>
                  {capExceeded && (
                    <span className="text-xs text-red-400 animate-pulse">⚠ 超出上限</span>
                  )}
                </div>
              )}
              <div className="space-y-3">
                {(selectedRole.customizableAttributes || []).map((field: any) => {
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
                onClick={handleSubmitCharacterSheet}
                disabled={capExceeded}
                className={`mt-4 !bg-amber-500 !border-amber-500 hover:!bg-amber-400 !text-white
                  ${capExceeded ? '!opacity-40 !cursor-not-allowed !bg-slate-600 !border-slate-600 hover:!bg-slate-600' : ''}`}
                block
                size="large"
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

          {/* Status info + Ready button */}
          <div className="mt-6 text-center">
            <p className="text-sm text-slate-400 mb-3">
              {myAssignedRoleId
                ? (hasCustomFields
                    ? (capExceeded
                        ? '⚠ 属性总和超出上限，请调整后再提交'
                        : '✅ 已选择角色，请完善角色卡属性后确认提交')
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
    <div className="game-mode flex flex-col h-screen bg-slate-900 text-slate-200">
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
          {/* BGM Volume Control */}
          <div className="flex items-center gap-1.5 ml-1">
            <SoundOutlined
              onClick={() => store.toggleBGM()}
              className={`text-sm cursor-pointer transition-colors ${
                bgmEnabled && bgmVolume > 0 ? 'text-amber-400 hover:text-amber-300' : 'text-slate-600 hover:text-slate-400'
              }`}
            />
            <Slider
              min={0}
              max={1}
              step={0.05}
              value={bgmVolume}
              onChange={(v) => setBgmVolume(v as number)}
              tooltip={{ formatter: (v) => `${Math.round((v || 0) * 100)}%` }}
              className="w-20"
              styles={{
                track: { backgroundColor: bgmEnabled && bgmVolume > 0 ? '#f59e0b' : '#475569' },
                handle: { borderColor: bgmEnabled && bgmVolume > 0 ? '#f59e0b' : '#475569' },
              }}
            />
          </div>
          <TurnTimer />
          <button
            onClick={handleCopyShareLink}
            className="text-xs text-slate-500 hover:text-amber-400 transition-colors flex items-center gap-1"
          >
            <LinkOutlined /> 分享
          </button>
        </div>
      </header>

      {/* Body: 2-column layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Character Sheet + Player List + Dice/Vote (30%) */}
        <aside className="w-[30%] flex-shrink-0 border-r border-slate-700/50 flex flex-col bg-slate-900">
          <div className="flex-1 overflow-hidden">
            <CharacterSheet />
          </div>
          {/* Lobby controls */}
          {stage === 'LOBBY' && isCreator && (
            <div className="flex-shrink-0 px-4 pb-3">
              <Button
                type="primary"
                block
                onClick={handleStartGame}
                className="!bg-amber-500 !border-amber-500 !text-white !font-semibold"
                icon={<ThunderboltOutlined />}
              >
                开始游戏
              </Button>
            </div>
          )}
          <div className="flex-shrink-0 px-4 pb-1">
            <div className="text-xs text-slate-500 pt-2 border-t border-slate-700/50">
              <span>{roomInfo?.mode === 'sandbox' ? 'AI 沙盒' :
                        roomInfo?.mode === 'script' ? '预设剧本' : '导入'}</span>
              <span className="mx-2">·</span>
              <span>{stage || 'LOBBY'}</span>
            </div>
          </div>
          {/* Dice & Vote panels at bottom — persist until next one activates */}
          <div className="flex-shrink-0 border-t border-slate-700/50 p-3 space-y-2">
            <DiceAnimation />
            <VotePanel />
          </div>
        </aside>

        {/* Center: Chat + Scene Background + Action (70%) */}
        <main className="w-[70%] flex flex-col min-w-0 relative">
          <SceneBackground />
          <div className="flex-1 overflow-hidden relative z-[2]">
            <ChatPanel />
          </div>
          <div className="relative z-[2]">
            <ActionInput />
          </div>
        </main>
      </div>

      {/* Overlays */}
      <RoundBanner />
      <EndingCard />
      <DMPrivateMessage />
      {stage === 'ROLE_SELECT' && renderRoleSelectionModal()}
      {renderNicknameModal()}
    </div>
  );
};

export default GamePage;
