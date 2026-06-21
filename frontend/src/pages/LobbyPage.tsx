import React, { useState, useEffect } from 'react';
import { Button, message } from 'antd';
import { ThunderboltOutlined, BookOutlined, UploadOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';
import { useGameStore } from '../store/useGameStore';
import { createGameRoom, importRoom } from '../api';
import ParticleBackground from '../components/Effects/ParticleBackground';

const MODE_OPTIONS = [
  {
    key: 'sandbox' as const,
    icon: <ThunderboltOutlined />,
    title: 'AI 沙盒模式',
    desc: '输入世界观偏好，AI 为你实时生成剧本。无预设剧情，完全即兴冒险。',
  },
  {
    key: 'script' as const,
    icon: <BookOutlined />,
    title: '预设剧本模式',
    desc: '从广场选择一个已发布的剧本，体验精心编排的剧情。',
  },
];

const LobbyPage: React.FC = () => {
  const setCurrentPage = useProjectStore((s) => s.setCurrentPage);
  const { createRoom: createSocketRoom } = useGameStore();
  const [mode, setMode] = useState<'sandbox' | 'script' | null>(null);
  const [worldview, setWorldview] = useState('');
  const [rolePrefs, setRolePrefs] = useState('');
  const [totalRounds, setTotalRounds] = useState(15);
  const [loading, setLoading] = useState(false);
  const [selectedScriptId, setSelectedScriptId] = useState<string | null>(null);
  const [scripts, setScripts] = useState<any[]>([]);

  // Load scripts for script mode
  useEffect(() => {
    if (mode === 'script') {
      import('../api').then(({ listScripts }) => {
        listScripts({ pageSize: 50 }).then((res) => {
          setScripts(res?.data?.list || res?.list || []);
        }).catch(() => {});
      });
    }
  }, [mode]);

  const handleCreate = async () => {
    if (mode === 'sandbox' && !worldview.trim()) {
      message.warning('请输入世界观偏好');
      return;
    }
    if (mode === 'script' && !selectedScriptId) {
      message.warning('请选择一个剧本');
      return;
    }

    setLoading(true);
    try {
      // For sandbox mode, create room via REST first
      if (mode === 'sandbox') {
        const res = await createGameRoom({
          mode: 'sandbox',
          worldview,
          rolePrefs,
          totalRounds,
        });
        if (res.success) {
          setCurrentPage('game');
          createSocketRoom({
            ...res.data,
            worldview,
            rolePrefs,
            totalRounds,
          });
        }
      } else if (mode === 'script' && selectedScriptId) {
        const res = await createGameRoom({
          mode: 'script',
          scriptId: selectedScriptId,
          totalRounds,
        });
        if (res.success) {
          setCurrentPage('game');
          createSocketRoom({
            ...res.data,
            scriptId: selectedScriptId,  // ensure scriptId survives to socket
            totalRounds,
          });
        }
      }
      // Don't set page yet - will change on room_created event
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || '创建房间失败');
    } finally {
      setLoading(false);
    }
  };

  const handleImport = async () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = async (e: any) => {
      const file = e.target?.files?.[0];
      if (!file) return;
      setLoading(true);
      try {
        const res = await importRoom(file);
        if (res.success) {
          createSocketRoom(res.data);
        }
      } catch (e: any) {
        message.error(e?.response?.data?.detail || '导入失败');
      } finally {
        setLoading(false);
      }
    };
    input.click();
  };

  return (
    <div className="game-mode flex flex-col relative">
      <ParticleBackground />
      {/* Header */}
      <header className="relative z-10 flex-shrink-0 px-6 py-4 border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => setCurrentPage('plaza')}
            className="text-slate-400 hover:text-white transition-colors text-sm"
          >
            ← 返回广场
          </button>
          <h1 className="text-lg font-bold bg-gradient-to-r from-amber-400 to-yellow-300 bg-clip-text text-transparent">
            🎮 创建房间
          </h1>
        </div>
      </header>

      {/* Content */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 game-scrollbar">
        <div className="max-w-2xl mx-auto">
          {/* Mode selection */}
          {!mode ? (
            <div className="space-y-4">
              <h2 className="text-xl font-bold text-center mb-6">选择开局方式</h2>
              {MODE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setMode(opt.key)}
                  className="w-full game-panel p-5 text-left hover:border-amber-500/40 transition-all group cursor-pointer"
                >
                  <div className="flex items-start gap-4">
                    <div className="text-2xl text-amber-400 mt-0.5">{opt.icon}</div>
                    <div>
                      <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors">
                        {opt.title}
                      </h3>
                      <p className="text-slate-400 text-sm mt-1">{opt.desc}</p>
                    </div>
                  </div>
                </button>
              ))}

              {/* Import button */}
              <button
                onClick={handleImport}
                className="w-full game-panel p-5 text-left hover:border-amber-500/40 transition-all group cursor-pointer"
              >
                <div className="flex items-start gap-4">
                  <div className="text-2xl text-amber-400 mt-0.5"><UploadOutlined /></div>
                  <div>
                    <h3 className="font-bold text-white group-hover:text-amber-400 transition-colors">
                      快速导入 JSON
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">直接选择文件，跳过配置，立即开始</p>
                  </div>
                </div>
              </button>
            </div>
          ) : (
            <div className="space-y-6">
              <button
                onClick={() => setMode(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ← 返回选择
              </button>

              {/* Sandbox config */}
              {mode === 'sandbox' && (
                <>
                  <h2 className="text-lg font-bold">🎲 AI 沙盒模式</h2>
                  <div className="game-panel p-4 space-y-4">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">世界观偏好（可选）</label>
                      <textarea
                        value={worldview}
                        onChange={(e) => setWorldview(e.target.value)}
                        placeholder="例如：古代仙侠世界，灵气复苏背景下，各门派争夺修仙资源..."
                        rows={4}
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                                   placeholder:text-slate-500 resize-none focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">角色偏好（可选）</label>
                      <input
                        value={rolePrefs}
                        onChange={(e) => setRolePrefs(e.target.value)}
                        placeholder="例如：男主角是剑客，女主角是医者..."
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                                   placeholder:text-slate-500 focus:outline-none focus:border-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">总回合数</label>
                      <input
                        type="range"
                        min={5}
                        max={30}
                        value={totalRounds}
                        onChange={(e) => setTotalRounds(Number(e.target.value))}
                        className="w-full accent-amber-500"
                      />
                      <span className="text-amber-400 text-sm font-mono">{totalRounds} 回合</span>
                    </div>
                  </div>
                </>
              )}

              {/* Script selection */}
              {mode === 'script' && (
                <>
                  <h2 className="text-lg font-bold">📚 选择剧本</h2>
                  {scripts.length === 0 ? (
                    <p className="text-slate-500 text-sm">加载中...</p>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      {scripts.map((s: any) => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedScriptId(s.id)}
                          className={`game-panel p-4 text-left transition-all cursor-pointer
                            ${selectedScriptId === s.id ? 'border-amber-500 bg-amber-500/5' : 'hover:border-amber-500/40'}`}
                        >
                          <h4 className="font-bold text-white text-sm">{s.title}</h4>
                          <p className="text-xs text-slate-500 mt-1">作者：{s.author}</p>
                          <div className="flex gap-1 mt-2">
                            {s.tags?.slice(0, 3).map((t: string) => (
                              <span key={t} className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                          <div className="flex gap-3 mt-2 text-xs text-slate-500">
                            <span>⭐ {s.rating}</span>
                            <span>{s.playerCount}</span>
                            <span>{s.duration}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}

              {/* Create button */}
              <Button
                type="primary"
                size="large"
                loading={loading}
                onClick={handleCreate}
                className="w-full !h-12 !text-base !font-bold !bg-amber-500 !border-amber-500 hover:!bg-amber-400"
              >
                {mode === 'sandbox' ? '🎲 开始 AI 冒险' :
                 mode === 'script' ? '📚 开始游戏' :
                 '🎮 创建房间'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LobbyPage;
