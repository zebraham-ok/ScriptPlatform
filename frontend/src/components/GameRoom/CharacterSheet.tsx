import React from 'react';
import { useGameStore } from '../../store/useGameStore';

/** Strip "worldParams." / "WorldParams." prefix for display */
const cleanAttrKey = (key: string): string => {
  const lowerKey = key.toLowerCase();
  if (lowerKey.startsWith('worldparams.')) return key.substring('worldparams.'.length);
  return key;
};

const CharacterSheet: React.FC = () => {
  const players = useGameStore((s) => s.players);
  const playerId = useGameStore((s) => s.playerId);
  const assignedRoles = useGameStore((s) => s.assignedRoles);

  // Find current player - try direct lookup by playerId, then search by field
  let currentPlayer = playerId ? players[playerId] : null;
  if (!currentPlayer && playerId) {
    // Fallback: search all players for matching playerId field
    for (const [, p] of Object.entries(players)) {
      if ((p as any).playerId === playerId) {
        currentPlayer = p;
        break;
      }
    }
  }

  const myCharacterId = currentPlayer?.characterId;

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300">🎭 角色卡</h3>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 game-scrollbar">
        {!myCharacterId ? (
          <div className="text-center text-slate-500 mt-10">
            <div className="text-3xl mb-2">🎭</div>
            <p className="text-sm">尚未选择角色</p>
            <p className="text-xs mt-1">在大厅中选择一个角色开始游戏</p>
          </div>
        ) : (
          <>
            {/* My character card */}
            <div className="character-sheet border-amber-500/40">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">我的角色</span>
              </div>
              <div className="text-amber-400 text-lg font-bold mb-2">
                {currentPlayer?.characterName || currentPlayer?.characterId || '未知角色'}
              </div>
              {/* Attributes */}
              {currentPlayer?.attributes && Object.keys(currentPlayer.attributes).length > 0 && (
                <div className="space-y-2 mt-3">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">属性</div>
                  {Object.entries(currentPlayer.attributes).map(([key, value]) => (
                    <div key={key} className="flex justify-between items-center">
                      <span className="text-slate-300 text-sm">{cleanAttrKey(key)}</span>
                      <span className="text-white font-mono">{String(value)}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Inventory / Items */}
              {currentPlayer?.inventory && currentPlayer.inventory.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50">
                  <div className="text-xs text-slate-400 font-semibold uppercase tracking-wider mb-2">道具</div>
                  {currentPlayer.inventory.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 py-1">
                      <span className="text-xs text-amber-400/70">📦</span>
                      <span className="text-sm text-slate-300">{item.name || item}</span>
                      {item.quantity > 1 && (
                        <span className="text-xs text-slate-400 ml-auto">x{item.quantity}</span>
                      )}
                      {item.description && (
                        <span className="text-xs text-slate-400 ml-1">— {item.description}</span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Other players */}
            {Object.entries(players)
              .filter(([pid]) => {
                const p = players[pid];
                return p?.playerId !== playerId && pid !== playerId;
              })
              .map(([pid, p]) => {
                // Skip duplicate entries (sid-indexed entries that have _sid pointing elsewhere)
                if ((p as any)._sid) return null;
                return (
                <div key={pid} className="character-sheet opacity-80">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                      {p.nickname}
                    </span>
                  </div>
                  <div className="text-slate-300 text-sm font-semibold">
                    {p.characterName || p.characterId || '未选择角色'}
                  </div>
                  {p.attributes && Object.keys(p.attributes).length > 0 && (
                    <div className="space-y-1.5 mt-2">
                      {Object.entries(p.attributes).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center text-xs">
                          <span className="text-slate-400">{cleanAttrKey(key)}</span>
                          <span className="text-slate-300 font-mono">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {p.inventory && p.inventory.length > 0 && (
                    <div className="mt-2 pt-2 border-t border-slate-700/50">
                      <div className="text-xs text-slate-400 mb-1">道具</div>
                      {p.inventory.map((item: any, idx: number) => (
                        <div key={idx} className="text-xs text-slate-400">📦 {item.name || item}</div>
                      ))}
                    </div>
                  )}
                </div>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
};

export default CharacterSheet;
