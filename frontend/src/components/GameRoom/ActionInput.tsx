import React, { useState, useEffect, useRef } from 'react';
import { useGameStore } from '../../store/useGameStore';

const ActionInput: React.FC = () => {
  const [input, setInput] = useState('');
  const sendMessage = useGameStore((s) => s.sendMessage);
  const skipTurn = useGameStore((s) => s.skipTurn);
  const stage = useGameStore((s) => s.stage);
  const roomInfo = useGameStore((s) => s.roomInfo);
  const inputPreset = useGameStore((s) => s.inputPreset);
  const setInputPreset = useGameStore((s) => s.setInputPreset);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // When a DM option is clicked, fill it into the input box and focus
  useEffect(() => {
    if (inputPreset) {
      setInput(inputPreset);
      setInputPreset(null); // consume the preset
      // Auto-focus the input so player can immediately press Enter or type
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 0);
    }
  }, [inputPreset, setInputPreset]);

  if (stage !== 'PLAYING') return null;

  const handleSend = () => {
    if (!input.trim()) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="action-input-area">
      <div className="flex gap-2">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="描述你的行动或对话..."
          rows={2}
          maxLength={2000}
          className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white
                     placeholder:text-slate-500 resize-none focus:outline-none focus:border-amber-500
                     transition-colors"
        />
        <div className="flex flex-col gap-1.5">
          <button
            onClick={handleSend}
            disabled={!input.trim()}
            className="flex-1 px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:bg-slate-600
                       disabled:text-slate-400 text-slate-900 text-sm font-bold rounded-lg
                       transition-colors min-w-[72px]"
          >
            发送
          </button>
          <button
            onClick={skipTurn}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-400 text-xs
                       rounded-lg transition-colors border border-slate-600"
          >
            跳过
          </button>
        </div>
      </div>
      {roomInfo && (
        <div className="flex justify-between items-center mt-2 px-1">
          <span className="text-xs text-slate-500">
            房间 {roomInfo.roomId} · {roomInfo.scriptTitle || '沙盒模式'}
          </span>
          <span className="text-xs text-slate-600">{input.length}/2000</span>
        </div>
      )}
    </div>
  );
};

export default ActionInput;
