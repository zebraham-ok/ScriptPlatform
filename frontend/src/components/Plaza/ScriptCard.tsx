import React from 'react';
import type { ScriptCardData } from '../../types';

interface ScriptCardProps {
  script: ScriptCardData;
  onClick: (scriptId: string) => void;
}

const ScriptCard: React.FC<ScriptCardProps> = ({ script, onClick }) => {
  return (
    <button
      key={script.id}
      onClick={() => onClick(script.id)}
      className="game-panel p-5 text-left transition-all hover:border-amber-500/40 hover:translate-y-[-2px] cursor-pointer group"
    >
      {/* Cover placeholder */}
      <div className="w-full h-32 rounded-lg mb-3 bg-gradient-to-br from-slate-700 to-slate-800 flex items-center justify-center group-hover:from-slate-600 group-hover:to-slate-700 transition-colors">
        {script.coverPath ? (
          <img
            src={script.coverPath}
            alt={script.title}
            className="w-full h-full object-cover rounded-lg"
          />
        ) : (
          <span className="text-3xl opacity-30">🎭</span>
        )}
      </div>

      <h3 className="font-bold text-white text-sm group-hover:text-amber-400 transition-colors mb-1 line-clamp-2">
        {script.title}
      </h3>
      <p className="text-xs text-slate-500 mb-2">作者：{script.author}</p>

      <div className="flex flex-wrap gap-1 mb-3">
        {(script.tags || []).slice(0, 3).map((t: string) => (
          <span key={t} className="text-xs bg-slate-700 text-slate-400 px-2 py-0.5 rounded">
            {t}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        <span className="flex items-center gap-1">
          <span className="text-amber-400">⭐</span> {script.rating}
        </span>
        <span>{script.playerCount}</span>
        <span>{script.duration}</span>
      </div>
      <div className="flex items-center justify-between text-xs text-slate-600 mt-2">
        <span>{script.playCount} 次游玩</span>
        {script.isOfficial && (
          <span className="text-amber-400/60 bg-amber-500/10 px-1.5 py-0.5 rounded">官方</span>
        )}
      </div>
    </button>
  );
};

export default ScriptCard;
