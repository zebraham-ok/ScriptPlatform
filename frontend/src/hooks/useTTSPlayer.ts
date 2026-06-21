/**
 * useTTSPlayer — TTS audio playback hook with queue management.
 * Handles base64 MP3 → HTML5 Audio playback, sequential queuing,
 * and integration with typewriter effect.
 */
import { useEffect, useRef, useCallback } from 'react';
import { useGameStore } from '../store/useGameStore';
import type { TTSAudioPayload } from '../types';

let _audioContextUnlocked = false;

function unlockAudioContext() {
  if (_audioContextUnlocked) return;
  _audioContextUnlocked = true;
  try {
    // Unlock Web Audio API
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }
    // Unlock HTML5 Audio
    const silentAudio = new Audio(
      'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA'
    );
    silentAudio.volume = 0;
    silentAudio.play().then(() => {
      silentAudio.pause();
      silentAudio.remove();
    }).catch(() => {});
  } catch {
    // Silent ignore
  }
}

/**
 * Play base64-encoded MP3 audio using HTML5 Audio element.
 * Returns a promise that resolves when playback ends.
 */
function playAudioBase64(b64: string, playbackRate: number = 1.0): Promise<void> {
  return new Promise((resolve) => {
    try {
      const audio = new Audio(`data:audio/mp3;base64,${b64}`);
      audio.volume = 0.8;
      audio.playbackRate = playbackRate;

      const cleanup = () => {
        audio.removeEventListener('ended', onEnd);
        audio.removeEventListener('error', onEnd);
        audio.remove();
      };

      const onEnd = () => {
        cleanup();
        resolve();
      };

      audio.addEventListener('ended', onEnd);
      audio.addEventListener('error', onEnd);

      audio.play().catch(() => {
        cleanup();
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

/**
 * Hook: watch TTS audio queue and play automatically.
 * 
 * Usage: call useTTSPlayer() in the GameRoom component.
 * It will automatically play TTS audio from the store's queue
 * when TTS is enabled.
 * 
 * Also exposes playNow() for immediate playback (sync with typewriter).
 */
export function useTTSPlayer() {
  const ttsEnabled = useGameStore((s) => s.ttsEnabled);
  const ttsPlaying = useGameStore((s) => s.ttsPlaying);
  const audioQueue = useGameStore((s) => s.audioQueue);

  const playingRef = useRef(false);
  const stopRequestedRef = useRef(false);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);

  // Stop any currently playing audio
  const stop = useCallback(() => {
    stopRequestedRef.current = true;
    if (currentAudioRef.current) {
      try {
        currentAudioRef.current.pause();
        currentAudioRef.current.remove();
      } catch {}
      currentAudioRef.current = null;
    }
    playingRef.current = false;
    useGameStore.getState()._setTTSPlaying(false);
  }, []);

  // Play a single audio payload
  const playNow = useCallback(async (payload: TTSAudioPayload): Promise<void> => {
    if (!ttsEnabled) return;
    useGameStore.getState()._setCurrentTTSAudio(payload);
    useGameStore.getState()._setTTSPlaying(true);
    playingRef.current = true;
    stopRequestedRef.current = false;

    try {
      await playAudioBase64(payload.audio, 1.15);
    } catch {
      // ignore
    }

    if (!stopRequestedRef.current) {
      useGameStore.getState()._setTTSPlaying(false);
      useGameStore.getState()._setCurrentTTSAudio(null);
    }
    playingRef.current = false;
  }, [ttsEnabled]);

  // Auto-play from queue
  useEffect(() => {
    if (!ttsEnabled) return;
    if (audioQueue.length === 0) return;
    if (playingRef.current) return;

    const next = audioQueue[0];

    // Play and dequeue
    (async () => {
      const store = useGameStore.getState();
      store._dequeueTTSAudio();
      await playNow(next);
      // After finishing, check if more queued
      const newQueue = useGameStore.getState().audioQueue;
      if (newQueue.length > 0 && !playingRef.current) {
        // Will be picked up on next render
      }
    })();
  }, [audioQueue, ttsEnabled, playNow]);

  // Unlock audio on first user interaction
  useEffect(() => {
    const handler = () => {
      unlockAudioContext();
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
    document.addEventListener('click', handler);
    document.addEventListener('keydown', handler);
    return () => {
      document.removeEventListener('click', handler);
      document.removeEventListener('keydown', handler);
    };
  }, []);

  return {
    isPlaying: ttsPlaying,
    stop,
    playNow,
  };
}

export default useTTSPlayer;
