import React from 'react';
import { useGameStore } from '../../store/useGameStore';

const DMPrivateMessage: React.FC = () => {
  const messages = useGameStore((s) => s.messages);
  const playerId = useGameStore((s) => s.playerId);

  const privateMessages = messages.filter(
    (m) => m.type === 'private' && m.targetPlayerId === playerId
  );

  if (privateMessages.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-30 max-w-sm">
      {privateMessages.slice(-3).map((msg) => (
        <div
          key={msg.id}
          className="dm-message border-l-purple-500 bg-slate-800/95 backdrop-blur shadow-xl mb-2 animate-fadeSlideUp"
        >
          <div className="dm-label text-purple-400 flex items-center gap-2">
            🔒 DM 私信
            <span className="text-xs text-slate-500 font-normal">
              {new Date(msg.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div className="text-slate-300 text-sm leading-relaxed">{msg.content}</div>
        </div>
      ))}
    </div>
  );
};

export default DMPrivateMessage;
