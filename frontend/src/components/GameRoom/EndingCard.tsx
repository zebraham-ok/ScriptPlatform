import React from 'react';
import { useGameStore } from '../../store/useGameStore';
import { useProjectStore } from '../../store/useProjectStore';

const EndingCard: React.FC = () => {
  const ending = useGameStore((s) => s.ending);
  const stage = useGameStore((s) => s.stage);
  const leaveRoom = useGameStore((s) => s.leaveRoom);
  const setCurrentPage = useProjectStore((s) => s.setCurrentPage);

  if (stage !== 'ENDING' || !ending) return null;

  const handleBackToPlaza = () => {
    leaveRoom();
    setCurrentPage('plaza');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="ending-card w-full max-w-lg">
        <div className="mb-6">
          <div className="text-6xl mb-4">🏆</div>
          <h1 className="ending-title">{ending.title}</h1>
        </div>

        <p className="text-slate-300 leading-relaxed mb-6 whitespace-pre-wrap">
          {ending.description}
        </p>

        {ending.epilogue && (
          <div className="bg-slate-700/50 rounded-lg p-4 mb-6 text-left">
            <h4 className="text-amber-400 text-sm font-bold mb-2">📖 尾声</h4>
            <p className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap">
              {ending.epilogue}
            </p>
          </div>
        )}

        {ending.characterFates.length > 0 && (
          <div className="space-y-2 mb-6 text-left">
            <h4 className="text-amber-400 text-sm font-bold mb-2">🎭 角色结局</h4>
            {ending.characterFates.map((cf, i) => (
              <div key={i} className="bg-slate-700/30 rounded p-3">
                <span className="text-amber-400 text-sm font-semibold">{cf.characterName}</span>
                <p className="text-slate-400 text-xs mt-1">{cf.fate}</p>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={handleBackToPlaza}
          className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg transition-colors"
        >
          返回广场
        </button>
      </div>
    </div>
  );
};

export default EndingCard;
