import React, { useRef, useEffect, useState } from 'react';
import { useGameStore } from '../../store/useGameStore';

const SceneBackground: React.FC = () => {
  const scene = useGameStore((s) => s.scene);

  // ---- Smooth scene transition (follows BUMENGweb-main pattern) ----
  const [prevImageUrl, setPrevImageUrl] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);
  const [transitioning, setTransitioning] = useState(false);
  const prevSceneKeyRef = useRef<string>('');

  useEffect(() => {
    const newKey = scene?.location || '';
    const newImage = scene?.imageUrl || null;

    // Only trigger transition when the scene name actually changes
    if (newKey && newKey !== prevSceneKeyRef.current) {
      console.log('[SceneBackground] 🏞️ 场景名变更:', prevSceneKeyRef.current || '(空)', '→', newKey,
        '| 新图:', newImage ? '有' : '无', '| 当前图:', currentImageUrl ? '有' : '无');
      prevSceneKeyRef.current = newKey;

      if (newImage && currentImageUrl && currentImageUrl !== newImage) {
        // Scene changed with new image: crossfade
        console.log('[SceneBackground] 🔄 交叉淡入淡出 (已缓存命中)');
        setPrevImageUrl(currentImageUrl);
        setTransitioning(true);
        setCurrentImageUrl(newImage);

        // Clear prev image after transition completes
        const timer = setTimeout(() => {
          setPrevImageUrl(null);
          setTransitioning(false);
        }, 1200);
        return () => clearTimeout(timer);
      } else if (newImage !== currentImageUrl) {
        // First scene or no previous image: direct set
        if (newImage) {
          console.log('[SceneBackground] 🖼️ 首次设置图片');
        } else {
          console.log('[SceneBackground] ⏳ 场景已切换，等待异步图片生成...');
        }
        setCurrentImageUrl(newImage);
      }
    } else if (newImage && newImage !== currentImageUrl) {
      // Image updated for same scene (async generation completed): fade in
      console.log('[SceneBackground] ✨ 异步图片到达，更新显示');
      setCurrentImageUrl(newImage);
    } else if (newKey) {
      // Debug: no change detected
      // console.log('[SceneBackground] 无变化: key=' + newKey + ' img=' + (newImage ? '有' : '无') + ' curImg=' + (currentImageUrl ? '有' : '无'));
    }
  }, [scene?.location, scene?.imageUrl]);

  // Reset transition state when scene is cleared
  useEffect(() => {
    if (!scene) {
      setCurrentImageUrl(null);
      setPrevImageUrl(null);
      setTransitioning(false);
      prevSceneKeyRef.current = '';
    }
  }, [scene]);

  return (
    <>
      {/* 旧场景图淡出层（crossfade） */}
      {prevImageUrl && (
        <div
          className="absolute inset-0 z-0"
          style={{
            backgroundImage: `url(${prevImageUrl})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
            opacity: transitioning ? 0 : 0.9,
            transition: 'opacity 1.2s ease-in-out',
          }}
        />
      )}

      {/* 当前场景图片背景层（全屏，适度透明度） */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: currentImageUrl ? `url(${currentImageUrl})` : undefined,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          opacity: transitioning ? 0.9 : (currentImageUrl ? 0.9 : 0),
          transition: 'opacity 1.2s ease-in-out',
        }}
      />

      {/* 深色渐变遮罩层（上下深、中间浅，确保文字可读） */}
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-[#0a0a1a]/55 via-[#0a0a1a]/5 to-[#0a0a1a]/55 pointer-events-none" />

      {/* 场景信息叠加层 — 带 fadeSlideUp 动效 */}
      <div
        key={scene?.location || 'no-scene'}
        className="absolute top-3 left-4 right-4 z-[2] flex items-start gap-3 pointer-events-none animate-fade-slide-up"
      >
        {scene && (
          <div
            className="scene-description pointer-events-auto"
            style={currentImageUrl ? undefined : {
              background: 'linear-gradient(135deg, #1e293b 0%, #334155 50%, #1e293b 100%)',
            }}
          >
            <h4 className="text-amber-400 text-sm font-bold mb-1">
              {scene.location || '等待场景载入...'}
            </h4>
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
        )}
      </div>
    </>
  );
};

export default SceneBackground;
