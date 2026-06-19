import React, { useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';

const RoundBanner: React.FC = () => {
  const currentTurn = useGameStore((s) => s.currentTurn);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (currentTurn) {
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 3000);
      return () => clearTimeout(t);
    }
  }, [currentTurn?.round]);

  if (!visible || !currentTurn) return null;

  return (
    <div className="round-banner">
      <div className="text-lg font-bold tracking-wider">
        第 {currentTurn.round} 回合
      </div>
      <div className="text-sm opacity-80">
        {currentTurn.phase === 'action' ? '行动阶段' :
         currentTurn.phase === 'discussion' ? '讨论阶段' :
         currentTurn.phase === 'vote' ? '投票阶段' : currentTurn.phase}
      </div>
    </div>
  );
};

export default RoundBanner;
