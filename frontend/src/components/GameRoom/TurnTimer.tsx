import React from 'react';
import { useGameStore } from '../../store/useGameStore';

const TurnTimer: React.FC = () => {
  const currentTurn = useGameStore((s) => s.currentTurn);
  const stage = useGameStore((s) => s.stage);

  if (stage !== 'PLAYING' || !currentTurn) return null;

  const isUrgent = currentTurn.timeRemaining <= 30;

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded-full border border-slate-700">
      <span className="text-xs text-slate-500">⏱</span>
      <span className={`turn-timer ${isUrgent ? 'urgent' : 'normal'}`}>
        {Math.floor(currentTurn.timeRemaining / 60)}:
        {String(currentTurn.timeRemaining % 60).padStart(2, '0')}
      </span>
      <span className="text-xs text-slate-600 ml-1">
        第{currentTurn.round}轮
      </span>
    </div>
  );
};

export default TurnTimer;
