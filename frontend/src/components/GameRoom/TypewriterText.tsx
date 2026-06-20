import React, { useEffect, useRef, useState, useCallback } from 'react';

interface TypewriterTextProps {
  text: string;
  speed?: number; // ms per character
  onComplete?: () => void;
  className?: string;
}

const TypewriterText: React.FC<TypewriterTextProps> = ({
  text,
  speed = 30,
  onComplete,
  className = '',
}) => {
  const [displayed, setDisplayed] = useState('');
  const [isTyping, setIsTyping] = useState(true);
  const indexRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completedRef = useRef(false);

  const finishTyping = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDisplayed(text);
    setIsTyping(false);
    onComplete?.();
  }, [text, onComplete]);

  useEffect(() => {
    // Reset when text changes
    indexRef.current = 0;
    completedRef.current = false;
    setDisplayed('');
    setIsTyping(true);

    if (!text) {
      setIsTyping(false);
      return;
    }

    timerRef.current = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= text.length) {
        finishTyping();
      } else {
        setDisplayed(text.slice(0, indexRef.current));
      }
    }, speed);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [text, speed, finishTyping]);

  return (
    <span
      className={className}
      onClick={finishTyping}
      style={{ cursor: isTyping ? 'pointer' : 'default' }}
    >
      {displayed}
      {isTyping && (
        <span className="inline-block w-1.5 h-4 bg-amber-400 align-middle ml-0.5 animate-pulse" />
      )}
    </span>
  );
};

export default TypewriterText;
