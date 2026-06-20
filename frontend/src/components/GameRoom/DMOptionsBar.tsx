import React, { useCallback } from 'react';
import { useGameStore } from '../../store/useGameStore';

/**
 * DMOptionsBar — 主持人选项按钮栏
 * 显示在聊天框上方，供玩家快速选择 DM 提供的行动方向。
 * 参考 BUMENGweb-main App.jsx 的 latestDmOptions 渲染逻辑。
 */
const DMOptionsBar: React.FC = () => {
  const dmOptions = useGameStore((s) => s.dmOptions);
  const stage = useGameStore((s) => s.stage);
  const dmThinking = useGameStore((s) => s.dmThinking);

  const handleSelect = useCallback((optionText: string) => {
    useGameStore.getState().selectDMOptionByText(optionText);
  }, []);

  // Hide options during DM thinking (e.g., processing check results)
  if (stage !== 'PLAYING' || !dmOptions || dmOptions.length === 0 || dmThinking) return null;

  return (
    <div className="flex-shrink-0 relative z-[3]">
      <div className="px-4 py-2 flex flex-wrap justify-center gap-2">
        {dmOptions.map((opt, i) => (
          <button
            key={`dmopt-${i}`}
            onClick={() => handleSelect(opt)}
            className="px-4 py-2 text-sm rounded-xl border border-amber-600/30 bg-black/30 backdrop-blur-md text-amber-200/85 hover:bg-amber-900/30 hover:border-amber-500/50 hover:text-amber-100 transition-all duration-200 cursor-pointer text-left"
            style={{
              animation: `optionSlideIn 0.3s ease-out ${i * 0.08}s both`,
            }}
          >
            <span className="text-amber-500/70 mr-1.5 text-xs">▸</span>
            {opt}
          </button>
        ))}
      </div>
    </div>
  );
};

export default DMOptionsBar;
