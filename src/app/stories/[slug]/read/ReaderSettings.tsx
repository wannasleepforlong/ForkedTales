"use client";

import { useState } from "react";
import type { ReaderPrefs } from "@/lib/reader/prefs";

export function ReaderSettings({
  prefs,
  onChange,
}: {
  prefs: ReaderPrefs;
  onChange: (next: ReaderPrefs) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Reader settings"
        className="rounded-full border border-white/10 bg-ink/60 p-2 text-parchment/70 hover:text-accent"
      >
        ⚙
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-30 w-72 space-y-4 rounded-xl border border-white/10 bg-ink/95 p-4 shadow-glow backdrop-blur">
          <div>
            <label className="flex items-center justify-between text-sm">
              <span>Typewriter</span>
              <input
                type="checkbox"
                checked={prefs.typewriter}
                onChange={(e) => onChange({ ...prefs, typewriter: e.target.checked })}
              />
            </label>
            <input
              type="range"
              min={15}
              max={140}
              value={prefs.charsPerSecond}
              onChange={(e) => onChange({ ...prefs, charsPerSecond: Number(e.target.value) })}
              className="mt-2 w-full accent-accent"
              disabled={!prefs.typewriter}
            />
            <p className="text-xs text-parchment/50">{prefs.charsPerSecond} chars/sec</p>
          </div>
          <div>
            <label className="flex items-center justify-between text-sm">
              <span>Auto-advance</span>
              <input
                type="checkbox"
                checked={prefs.autoAdvance}
                onChange={(e) => onChange({ ...prefs, autoAdvance: e.target.checked })}
              />
            </label>
            <input
              type="range"
              min={400}
              max={4000}
              step={100}
              value={prefs.autoAdvanceMs}
              onChange={(e) => onChange({ ...prefs, autoAdvanceMs: Number(e.target.value) })}
              className="mt-2 w-full accent-accent"
              disabled={!prefs.autoAdvance}
            />
            <p className="text-xs text-parchment/50">{prefs.autoAdvanceMs} ms delay</p>
          </div>
          <div>
            <label className="block text-sm">Text size</label>
            <input
              type="range"
              min={0.85}
              max={1.5}
              step={0.05}
              value={prefs.textScale}
              onChange={(e) => onChange({ ...prefs, textScale: Number(e.target.value) })}
              className="mt-2 w-full accent-accent"
            />
            <p className="text-xs text-parchment/50">×{prefs.textScale.toFixed(2)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
