import React from 'react';
import { useGameStore } from '../../store/useGameStore';

const DiceAnimation: React.FC = () => {
  const diceResults = useGameStore((s) => s.diceResults);
  const showDice = useGameStore((s) => s.showDice);

  if (!showDice || diceResults.length === 0) return null;

  const lastResult = diceResults[diceResults.length - 1];

  return (
    <div className="bg-slate-800/80 border border-amber-500/20 rounded-lg p-3 animate-dice-appear">
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs text-amber-400/70 font-semibold uppercase tracking-wider">🎲 检定结果</span>
        <span className="text-xs text-slate-500">{lastResult.playerName}</span>
      </div>
      {lastResult.description && (
        <div className="text-xs text-slate-400 mb-2 leading-relaxed">{lastResult.description}</div>
      )}
      <div className="flex items-center gap-4">
        <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
          <span className="text-2xl font-bold text-amber-400">{lastResult.dice}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-slate-300 font-semibold truncate">{lastResult.target}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            难度 {lastResult.difficulty}
          </div>
        </div>
        <div className={`flex-shrink-0 text-xs font-bold px-2 py-1 rounded ${lastResult.result === 'success' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
          {lastResult.result === 'success' ? '✓ 成功' : '✗ 失败'}
        </div>
      </div>
    </div>
  );
};

export default DiceAnimation;
