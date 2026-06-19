import React, { useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';
import type { ChatMessage } from '../../types';

const ChatPanel: React.FC = () => {
  const messages = useGameStore((s) => s.messages);
  const dmThinking = useGameStore((s) => s.dmThinking);
  const playerId = useGameStore((s) => s.playerId);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, dmThinking]);

  const renderMessage = (msg: ChatMessage) => {
    const isOwn = msg.senderId === playerId;
    const isDM = msg.type === 'dm';
    const isSystem = msg.type === 'system';
    const isNarration = msg.type === 'narration';
    const isPrivate = msg.type === 'private';
    const isDice = msg.type === 'dice';

    if (isSystem) {
      return (
        <div key={msg.id} className="text-center py-2">
          <span className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
            {msg.content}
          </span>
        </div>
      );
    }

    if (isNarration) {
      return (
        <div key={msg.id} className="dm-message">
          <div className="dm-label">📖 剧情叙述</div>
          <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </div>
        </div>
      );
    }

    if (isDice) {
      return (
        <div key={msg.id} className="text-center py-2">
          <span className="text-amber-400 text-sm bg-amber-500/10 px-4 py-1.5 rounded-full border border-amber-500/20">
            {msg.content}
          </span>
        </div>
      );
    }

    if (isPrivate) {
      return (
        <div key={msg.id} className="dm-message border-l-purple-500">
          <div className="dm-label text-purple-400">🔒 DM 私信</div>
          <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </div>
          {msg.narration && (
            <div className="mt-2 text-sm text-slate-400 italic border-t border-slate-700 pt-2">
              📖 {msg.narration}
            </div>
          )}
        </div>
      );
    }

    if (isDM) {
      return (
        <div key={msg.id} className="dm-message">
          <div className="dm-label">🎭 {msg.senderName}</div>
          <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">
            {msg.content}
          </div>
          {msg.narration && (
            <div className="mt-2 text-sm text-slate-400 italic border-t border-slate-700 pt-2">
              📖 {msg.narration}
            </div>
          )}
          {msg.dmOptions && msg.dmOptions.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {msg.dmOptions.map((opt: string, i: number) => (
                <button
                  key={i}
                  className="dm-option-btn"
                  onClick={() => useGameStore.getState().selectDMOption(i)}
                >
                  {opt}
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    // Player message
    return (
      <div key={msg.id} className={`flex gap-3 py-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
        <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold
          ${isOwn ? 'bg-amber-500/20 text-amber-400' : 'bg-slate-600 text-slate-300'}`}>
          {msg.senderName[0]}
        </div>
        <div className={`max-w-[70%] ${isOwn ? 'text-right' : ''}`}>
          <div className="text-xs text-slate-400 mb-0.5">{msg.senderName}</div>
          <div className={`px-3 py-2 rounded-lg text-sm leading-relaxed whitespace-pre-wrap
            ${isOwn
              ? 'bg-amber-500/10 border border-amber-500/20 text-amber-100'
              : 'bg-slate-700/50 text-slate-300'}`}>
            {msg.content}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full bg-slate-900">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/50">
        <h3 className="text-sm font-semibold text-slate-300">📜 游戏剧情</h3>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-3 space-y-1 game-scrollbar"
      >
        {messages.length === 0 && !dmThinking && (
          <div className="text-center text-slate-500 mt-20">
            <div className="text-4xl mb-3">🎭</div>
            <p>等待游戏开始...</p>
            <p className="text-xs mt-1">DM 将在这里叙述剧情</p>
          </div>
        )}
        {messages.map(renderMessage)}

        {/* DM thinking indicator */}
        {dmThinking && (
          <div className="flex items-center gap-3 py-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center animate-pulse">
              <span className="text-sm">🎭</span>
            </div>
            <div className="flex gap-1.5">
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-amber-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
            <span className="text-xs text-slate-500">主持人正在思考中...</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;
