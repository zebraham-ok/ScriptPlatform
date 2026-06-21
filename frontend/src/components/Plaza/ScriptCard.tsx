import React, { useEffect, useState } from 'react';
import type { ScriptCardData } from '../../types';
import { getScriptCover } from '../../api';

interface ScriptCardProps {
  script: ScriptCardData;
  onClick: (scriptId: string) => void;
}

const ScriptCard: React.FC<ScriptCardProps> = ({ script, onClick }) => {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getScriptCover(script.id)
      .then((res) => {
        if (!cancelled) {
          const url = res?.data?.coverUrl || null;
          setCoverUrl(url);
        }
      })
      .catch(() => {
        if (!cancelled) setCoverUrl(null);
      });
    return () => { cancelled = true; };
  }, [script.id]);

  return (
    <button
      key={script.id}
      onClick={() => onClick(script.id)}
      className="game-panel p-5 text-left transition-all hover:border-purple-500/30 hover:translate-y-[-2px] cursor-pointer group"
    >
      {/* Cover */}
      <div className="w-full h-32 rounded-lg mb-3 bg-gradient-to-br from-purple-900/20 to-purple-800/10 flex items-center justify-center group-hover:from-purple-900/30 group-hover:to-purple-800/20 transition-colors overflow-hidden">
        {coverUrl ? (
          <img
            src={coverUrl}
            alt={script.title}
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <span className="text-3xl opacity-30">🎭</span>
        )}
      </div>

      <h3 className="font-bold text-white/90 text-sm group-hover:text-purple-300 transition-colors mb-1 line-clamp-2">
        {script.title}
      </h3>
      <p className="text-xs text-white/50 mb-2">作者：{script.author}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {(script.tags || []).slice(0, 3).map((t: string) => (
          <span key={t} className="text-xs bg-white/10 text-white/60 px-2 py-0.5 rounded">
            {t}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-white/50">
        <span className="flex items-center gap-1">
          <span className="text-purple-400">⭐</span> {script.rating}
        </span>
        <span>{script.playerCount}</span>
        <span>{script.duration}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-white/40 mt-2">
        <span>{script.playCount} 次游玩</span>
        {script.isOfficial && (
          <span className="text-purple-400/60 bg-purple-500/10 px-1.5 py-0.5 rounded">官方</span>
        )}
      </div>
    </button>
  );
};

export default ScriptCard;
