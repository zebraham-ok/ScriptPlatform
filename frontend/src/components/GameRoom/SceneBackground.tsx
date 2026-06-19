import React from 'react';
import { useGameStore } from '../../store/useGameStore';

const SceneBackground: React.FC = () => {
  const scene = useGameStore((s) => s.scene);

  if (!scene) {
    return (
      <div className="scene-background h-40 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        <p className="text-slate-600 text-sm">等待场景载入...</p>
      </div>
    );
  }

  return (
    <div
      className="scene-background h-40 transition-all duration-500"
      style={scene.imageUrl ? { backgroundImage: `url(${scene.imageUrl})` } : {
        background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)',
      }}
    >
      <div className="scene-description">
        <h4 className="text-amber-400 text-sm font-bold mb-1">{scene.location}</h4>
        <p className="text-slate-300 text-xs leading-relaxed line-clamp-2">{scene.description}</p>
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
  );
};

export default SceneBackground;
