import React from 'react';
import { useGameStore } from '../../store/useGameStore';

const DiceAnimation: React.FC = () => {
  const diceResults = useGameStore((s) => s.diceResults);
  const showDice = useGameStore((s) => s.showDice);

  if (!showDice || diceResults.length === 0) return null;

  const lastResult = diceResults[diceResults.length - 1];

  return (
    <div className="group relative bg-slate-800/80 border border-amber-500/20 rounded-lg p-3 animate-dice-appear">
      {/* Tooltip — shown on hover */}
      <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block z-50">
        <div className="bg-slate-900 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-slate-300 leading-relaxed shadow-xl whitespace-nowrap">
          <span className="text-amber-400 font-semibold">🎲 什么是检定？</span>
          <br />
          检定 = <span className="text-amber-300">生成一个0-鉴定对象属性之间的随机整数</span> 对照 <span className="text-amber-300">难度值</span>
          <br />
          骰子点数 ≥ 难度 → <span className="text-emerald-400">成功</span>，否则 <span className="text-red-400">失败</span>
        </div>
        {/* Arrow */}
        <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-slate-900" />
      </div>

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
