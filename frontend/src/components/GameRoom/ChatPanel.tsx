import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';
import type { ChatMessage } from '../../types';
import TypewriterText from './TypewriterText';
import { useTTSPlayer } from '../../hooks/useTTSPlayer';

const ChatPanel: React.FC = () => {
  const messages = useGameStore((s) => s.messages);
  const dmThinking = useGameStore((s) => s.dmThinking);
  const stage = useGameStore((s) => s.stage);
  const playerId = useGameStore((s) => s.playerId);
  const ttsEnabled = useGameStore((s) => s.ttsEnabled);
  const toggleTTS = useGameStore((s) => s.toggleTTS);
  const ttsPlaying = useGameStore((s) => s.ttsPlaying);
  const scrollRef = useRef<HTMLDivElement>(null);
  // 跟踪每个消息ID的打字完成状态
  const [completedMessages, setCompletedMessages] = useState<Set<string>>(new Set());

  // Initialize TTS player (handles queue auto-playback)
  const { stop: stopTTS } = useTTSPlayer();

  // Identify the latest DM message for typewriter effect
  const lastDMIndex = (() => {
    for (let i = messages.length - 1; i >= 0; i--) {
      const m = messages[i];
      if (m.type === 'dm' || m.type === 'dm_narration' || m.type === 'narration') {
        return i;
      }
    }
    return -1;
  })();

  const handleTypingComplete = useCallback((msgId: string) => {
    setCompletedMessages(prev => {
      const newSet = new Set(prev);
      newSet.add(msgId);
      return newSet;
    });
  }, []);

  // Auto-scroll during typing and on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, dmThinking]);

  // 检查是否有任何消息正在打字
  const hasActiveTyping = lastDMIndex >= 0 && !completedMessages.has(messages[lastDMIndex]?.id);
  
  // Also auto-scroll during typing (more frequent)
  useEffect(() => {
    if (hasActiveTyping) {
      const interval = setInterval(() => {
        if (scrollRef.current) {
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [hasActiveTyping, lastDMIndex]);

  const renderMessage = (msg: ChatMessage, idx: number) => {
    const isOwn = msg.senderId === playerId;
    const isDM = msg.type === 'dm' || msg.type === 'dm_narration';
    const isSystem = msg.type === 'system';
    const isNarration = msg.type === 'narration';
    const isPrivate = msg.type === 'private';
    const isDice = msg.type === 'dice';
    // 只有最新的DM消息，并且还没完成打字，才使用打字机效果
    const isLatestDM = idx === lastDMIndex && !completedMessages.has(msg.id);

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
            {isLatestDM ? (
              <TypewriterText
                text={msg.content}
                speed={80}
                onComplete={() => handleTypingComplete(msg.id)}
              />
            ) : (
              msg.content
            )}
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
            {isLatestDM ? (
              <TypewriterText
                text={msg.content}
                speed={80}
                onComplete={() => handleTypingComplete(msg.id)}
              />
            ) : (
              msg.content
            )}
          </div>
          {msg.narration && (
            <div className="mt-2 text-sm text-slate-400 italic border-t border-slate-700 pt-2">
              📖 {msg.narration}
            </div>
          )}
          {msg.dmOptions && msg.dmOptions.length > 0 && (isLatestDM ? completedMessages.has(msg.id) : true) && !useGameStore.getState().dmThinking && (
            <div className="mt-3 flex flex-wrap gap-2 animate-fade-slide-up">
              {msg.dmOptions.map((opt: string, i: number) => (
                <button
                  key={i}
                  className="px-3 py-1.5 text-sm rounded-full border border-amber-500/40 text-amber-300 bg-amber-500/5 hover:bg-amber-500/15 hover:border-amber-400 hover:text-amber-200 transition-colors cursor-pointer"
                  onClick={() => {
                    // Fill the input box with this option text (user can edit before sending)
                    useGameStore.getState().setInputPreset(opt);
                  }}
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
    <div className="flex flex-col h-full bg-slate-900/60 backdrop-blur-sm">
      {/* Header */}
      <div className="flex-shrink-0 px-4 py-3 border-b border-slate-700/30 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-200">📜 游戏剧情</h3>
        <button
          onClick={toggleTTS}
          title={ttsEnabled ? '关闭语音播报' : '开启语音播报'}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors ${
            ttsEnabled
              ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20'
              : 'bg-slate-700/30 text-slate-500 border border-slate-600/30 hover:bg-slate-700/50'
          }`}
        >
          {ttsPlaying ? (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
          ) : (
            <span>{ttsEnabled ? '🔊' : '🔇'}</span>
          )}
          <span>{ttsEnabled ? '语音' : '静音'}</span>
        </button>
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
        {messages.map((msg, idx) => renderMessage(msg, idx))}

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
            <span className="text-xs text-amber-400/80">
              {stage === 'ROLE_SELECT'
                ? '主持人正在翻剧本...'
                : useGameStore.getState().diceResults.length > 0
                  ? '主持人正在处理检定结果...'
                  : '主持人正在思考中...'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPanel;