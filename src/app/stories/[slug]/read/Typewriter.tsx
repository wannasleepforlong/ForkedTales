"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Reveal `text` one character at a time. When `rich` is provided (a
 * pre-rendered rich-text tree), the tree is laid out at full opacity
 * for correct wrap widths and revealed via a CSS clip that grows in
 * step with the plain-text char count. Click the wrapper to skip.
 */
export function Typewriter({
  text,
  cps,
  enabled,
  onDone,
  rich,
}: {
  text: string;
  cps: number;
  enabled: boolean;
  onDone?: () => void;
  rich?: ReactNode;
}) {
  const [len, setLen] = useState(enabled ? 0 : text.length);
  const doneRef = useRef(false);

  useEffect(() => {
    doneRef.current = false;
    if (!enabled) {
      setLen(text.length);
      onDone?.();
      return;
    }
    setLen(0);
    const start = performance.now();
    const total = text.length;
    let raf = 0;
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      const n = Math.min(total, Math.floor(elapsed * cps));
      setLen(n);
      if (n < total) raf = requestAnimationFrame(tick);
      else if (!doneRef.current) {
        doneRef.current = true;
        onDone?.();
      }
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, cps, enabled]);

  const progress = text.length === 0 ? 1 : len / text.length;

  const skip = () => {
    if (len < text.length) setLen(text.length);
  };

  // Rich-text mode: render the tree but clip horizontally to `progress`.
  if (rich) {
    return (
      <span onClick={skip} className="relative inline">
        <span
          style={{
            clipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
            WebkitClipPath: `inset(0 ${(1 - progress) * 100}% 0 0)`,
            display: "inline",
          }}
        >
          {rich}
        </span>
        {progress < 1 && <span className="ml-0.5 animate-pulse text-accent">▎</span>}
      </span>
    );
  }

  return (
    <span onClick={skip}>
      {text.slice(0, len)}
      {progress < 1 && <span className="ml-0.5 animate-pulse text-accent">▎</span>}
    </span>
  );
}
