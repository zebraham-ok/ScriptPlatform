import React from 'react';
import { useGameStore } from '../../store/useGameStore';

const EndingCard: React.FC = () => {
  const ending = useGameStore((s) => s.ending);
  const stage = useGameStore((s) => s.stage);
  const dismissEnding = useGameStore((s) => s.dismissEnding);

  if (stage !== 'ENDING' || !ending) return null;

  const handleConfirm = () => {
    dismissEnding();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-6">
      <div className="bg-slate-800 border border-amber-500/40 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        <div className="text-5xl mb-4">🏆</div>
        <h2 className="text-amber-400 text-lg font-bold mb-2">故事结束</h2>
        <p className="text-xl text-white font-semibold mb-1">
          {ending.endingLabel || '故事结局'}
        </p>
        <p className="text-slate-400 text-sm mb-6">
          《{ending.title}》
        </p>
        <button
          onClick={handleConfirm}
          className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg transition-colors text-sm"
        >
          确定
        </button>
      </div>
    </div>
  );
};

export default EndingCard;
