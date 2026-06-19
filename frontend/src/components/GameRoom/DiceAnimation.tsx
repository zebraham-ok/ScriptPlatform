import React from 'react';
import { useGameStore } from '../../store/useGameStore';

const DiceAnimation: React.FC = () => {
  const diceResults = useGameStore((s) => s.diceResults);
  const showDice = useGameStore((s) => s.showDice);

  if (!showDice || diceResults.length === 0) return null;

  const lastResult = diceResults[diceResults.length - 1];

  return (
    <div className="dice-container">
      <div className="text-center">
        <div className="text-6xl mb-4 dice-result">
          {lastResult.result === 'success' ? '🎉' : '💥'}
        </div>
        <div className="dice-result text-5xl">{lastResult.dice}</div>
        <div className="mt-3 text-lg text-amber-400/80 font-semibold">
          {lastResult.target}
        </div>
        <div className="mt-1 text-sm text-slate-400">
          难度 {lastResult.difficulty} · {lastResult.result === 'success' ? '成功！' : '失败...'}
        </div>
        <div className="mt-1 text-xs text-slate-500">
          {lastResult.playerName} 掷骰
        </div>
      </div>
    </div>
  );
};

export default DiceAnimation;
