import React, { useEffect, useState, useCallback } from 'react';
import { Spin, message } from 'antd';
import { ThunderboltOutlined } from '@ant-design/icons';
import { useProjectStore } from '../store/useProjectStore';
import { useGameStore } from '../store/useGameStore';
import { listScripts, createGameRoom } from '../api';
import { getStoredUser } from '../api';
import type { ScriptCardData } from '../types';
import ScriptCard from '../components/Plaza/ScriptCard';
import ScriptFilter, { type SortType } from '../components/Plaza/ScriptFilter';
import ParticleBackground from '../components/Effects/ParticleBackground';

const PlazaPage: React.FC = () => {
  const setCurrentPage = useProjectStore((s) => s.setCurrentPage);
  const { joinRoom, connectAndJoin, setShowNicknameModal } = useGameStore() as any;
  const [scripts, setScripts] = useState<ScriptCardData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [tag, setTag] = useState<string | undefined>();
  const [sort, setSort] = useState<SortType>('hot');
  const [keyword, setKeyword] = useState('');
  const [joiningScriptId, setJoiningScriptId] = useState<string | null>(null);

  const fetchScripts = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const res = await listScripts({ page: p, pageSize: 12, tag, sort, keyword: keyword || undefined });
      const data = res?.data || res || {};
      const list = data.list || [];
      if (p === 1) {
        setScripts(list);
      } else {
        setScripts((prev) => [...prev, ...list]);
      }
      setTotal(data.total || 0);
      setHasMore(data.hasMore ?? false);
    } catch (e) {
      message.error('加载剧本列表失败');
    } finally {
      setLoading(false);
    }
  }, [tag, sort, keyword]);

  useEffect(() => {
    setPage(1);
    fetchScripts(1);
  }, [fetchScripts]);

  const loadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchScripts(next);
  };

  const handleQuickStart = () => {
    setCurrentPage('lobby');
  };

  const handleScriptClick = async (scriptId: string) => {
    setJoiningScriptId(scriptId);
    setLoading(true);
    try {
      const res = await createGameRoom({
        mode: 'script',
        scriptId,
        totalRounds: 15,
      });
      if (res.success) {
        setCurrentPage('game');
        const storedUser = getStoredUser();
        connectAndJoin(
          res.data.roomId || '',
          storedUser?.displayName || '游客',
          true,
          {
            ...res.data,
            scriptId,
            totalRounds: 15,
          },
        );
      }
    } catch (e: any) {
      message.error(e?.response?.data?.detail || e?.message || '创建房间失败');
    } finally {
      setLoading(false);
      setJoiningScriptId(null);
    }
  };

  return (
    <div className="game-mode flex flex-col min-h-screen relative">
      <ParticleBackground />
      {/* Hero Banner */}
      <header className="relative z-10 flex-shrink-0 px-6 py-12 border-b border-slate-700/50 text-center">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-500 bg-clip-text text-transparent mb-3">
          捕梦剧本广场
        </h1>
        <p className="text-slate-400 text-sm mb-6">
          发现精彩剧本，开启沉浸式角色扮演冒险
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={handleQuickStart}
            className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg transition-all flex items-center gap-2"
          >
            <ThunderboltOutlined /> 快速开局
          </button>
          <button
            onClick={() => setCurrentPage('character')}
            className="px-6 py-2.5 bg-slate-700 hover:bg-slate-600 text-white font-bold rounded-lg transition-all"
          >
            创作剧本
          </button>
        </div>
      </header>

      {/* Filters */}
      <ScriptFilter
        keyword={keyword}
        onKeywordChange={setKeyword}
        tag={tag}
        onTagChange={setTag}
        sort={sort}
        onSortChange={setSort}
      />

      {/* Script Cards Grid */}
      <div className="relative z-10 flex-1 overflow-y-auto p-6 game-scrollbar">
        <Spin spinning={loading}>
          {scripts.length === 0 && !loading ? (
            <div className="text-center text-slate-500 mt-20">
              <div className="text-5xl mb-4">📚</div>
              <p>暂无剧本</p>
              <p className="text-xs mt-1">去创作一个剧本并发布吧！</p>
            </div>
          ) : (
            <>
              <p className="text-xs text-slate-600 mb-4">共 {total} 个剧本</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {scripts.map((s) => (
                  <ScriptCard key={s.id} script={s} onClick={handleScriptClick} />
                ))}
              </div>

              {hasMore && (
                <div className="text-center mt-6">
                  <button
                    onClick={loadMore}
                    className="px-6 py-2 text-sm text-slate-400 hover:text-white border border-slate-700 rounded-lg transition-colors"
                  >
                    加载更多
                  </button>
                </div>
              )}
            </>
          )}
        </Spin>
      </div>
    </div>
  );
};

export default PlazaPage;
