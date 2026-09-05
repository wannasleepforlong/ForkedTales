"use client";

import { useEffect, useRef, useState } from "react";

export function Typewriter({
  text,
  cps,
  enabled,
  onDone,
}: {
  text: string;
  cps: number;
  enabled: boolean;
  onDone?: () => void;
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

  return (
    <span
      onClick={() => {
        if (len < text.length) setLen(text.length);
      }}
    >
      {text.slice(0, len)}
      {len < text.length && <span className="ml-0.5 animate-pulse text-accent">▎</span>}
    </span>
  );
}
