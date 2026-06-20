import React from 'react';
import { useGameStore } from '../../store/useGameStore';

const VotePanel: React.FC = () => {
  const pendingVote = useGameStore((s) => s.pendingVote);

  if (!pendingVote) return null;

  const { name, options, results, winner, complete } = pendingVote;
  const totalVotes = Object.values(results).reduce((sum, c) => sum + c, 0);

  const handleVote = (option: string) => {
    // Vote submission goes through send_message with a vote action
    const { roomInfo, sendMessage } = useGameStore.getState() as any;
    if (roomInfo) {
      sendMessage(`投票：${option}`);
    }
  };

  return (
    <div className="bg-slate-800/80 border border-purple-500/20 rounded-lg p-3 animate-dice-appear">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-purple-400/70 font-semibold uppercase tracking-wider">🗳️ 投票</span>
        <span className="text-sm text-slate-300 font-medium">{name}</span>
      </div>

      {complete && winner ? (
        <div className="text-center py-2">
          <div className="text-sm text-emerald-400 font-semibold mb-1">投票结束</div>
          <div className="text-xs text-slate-400">
            获胜选项：<span className="text-amber-400 font-bold">{winner}</span>
          </div>
          <div className="text-xs text-slate-500 mt-1">共 {totalVotes} 票</div>
        </div>
      ) : (
        <div className="space-y-2">
          {options.map((opt, idx) => {
            const count = results[opt] || 0;
            const pct = totalVotes > 0 ? (count / totalVotes) * 100 : 0;
            return (
              <button
                key={idx}
                onClick={() => handleVote(opt)}
                className="w-full text-left px-3 py-2 rounded-lg border border-slate-600/50
                           bg-slate-800/50 hover:border-purple-500/40 hover:bg-purple-500/5
                           transition-colors cursor-pointer group"
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-300 group-hover:text-white">{opt}</span>
                  <span className="text-xs text-slate-500">{count} 票</span>
                </div>
                {totalVotes > 0 && (
                  <div className="mt-1.5 h-1 rounded-full bg-slate-700 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500/50 transition-all duration-300"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                )}
              </button>
            );
          })}
          <div className="text-xs text-slate-600 text-center mt-1">点击选项进行投票</div>
        </div>
      )}
    </div>
  );
};

export default VotePanel;
