import React from 'react';
import { useGameStore } from '../../store/useGameStore';

const SceneBackground: React.FC = () => {
  const scene = useGameStore((s) => s.scene);

  return (
    <>
      {/* 场景图片背景层（全屏，适度透明度） */}
      <div
        className="absolute inset-0 z-0 transition-all duration-1000"
        style={{
          backgroundImage: scene?.imageUrl ? `url(${scene.imageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: scene?.imageUrl ? 0.65 : 0,
        }}
      />
      {/* 深色渐变遮罩层（上下深、中间浅，确保文字可读） */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#0a0a1a]/80 via-[#0a0a1a]/15 to-[#0a0a1a]/80 pointer-events-none" />

      {/* 场景信息叠加层 */}
      {scene && (
        <div className="absolute top-3 left-4 right-4 z-[2] flex items-start gap-3 pointer-events-none">
          <div
            className="scene-description pointer-events-auto"
            style={scene.imageUrl ? undefined : {
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)',
            }}
          >
            <h4 className="text-amber-400 text-sm font-bold mb-1">{scene.location || '等待场景载入...'}</h4>
            {scene.description && (
              <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">{scene.description}</p>
            )}
            {scene.characters.length > 0 && (
              <div className="flex gap-1.5 mt-1.5">
                {scene.characters.map((c) => (
                  <span key={c} className="text-xs bg-slate-700/60 text-slate-300 px-2 py-0.5 rounded">
                    {c}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default SceneBackground;
