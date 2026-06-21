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
  // Use refs for callbacks to avoid resetting the effect on parent re-renders
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;
  const prevTextRef = useRef(text);

  const finishTyping = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    const safeText = typeof text === 'string' ? text : String(text || '');
    setDisplayed(safeText);
    setIsTyping(false);
    onCompleteRef.current?.();
  }, [text]);

  useEffect(() => {
    // Ensure text is always a string
    const safeText = typeof text === 'string' ? text : String(text || '');

    // Only reset when text value actually changes (not on parent re-renders)
    const textChanged = prevTextRef.current !== safeText;
    prevTextRef.current = safeText;

    if (textChanged) {
      indexRef.current = 0;
      completedRef.current = false;
      setDisplayed('');
      setIsTyping(true);
    }

    if (!safeText) {
      setIsTyping(false);
      return;
    }

    // If text didn't change and we're already typing, don't restart
    if (!textChanged && indexRef.current > 0) {
      return;
    }

    timerRef.current = setInterval(() => {
      indexRef.current += 1;
      if (indexRef.current >= safeText.length) {
        finishTyping();
      } else {
        setDisplayed(safeText.slice(0, indexRef.current));
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
