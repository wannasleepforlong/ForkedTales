"use client";

import { useRef } from "react";

/**
 * A textarea with a small formatting toolbar. Wraps the current
 * selection with the chosen markers (**bold**, *italic*). Kept as
 * markdown-ish source so the same content parses identically in the
 * author preview and the reader runtime.
 */
export function RichTextArea({
  value,
  onChange,
  rows = 3,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  rows?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);

  function wrap(marker: string) {
    const el = ref.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const selected = value.slice(start, end) || (marker === "**" ? "bold" : "italic");
    const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
    onChange(next);
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = start + marker.length;
      el.selectionEnd = start + marker.length + selected.length;
    });
  }

  return (
    <div>
      <div className="mb-1 flex items-center gap-1 text-xs">
        <button
          type="button"
          onClick={() => wrap("**")}
          className="rounded border border-white/15 px-2 py-0.5 font-bold hover:border-accent hover:text-accent"
          title="Bold (**text**)"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => wrap("*")}
          className="rounded border border-white/15 px-2 py-0.5 italic hover:border-accent hover:text-accent"
          title="Italic (*text*)"
        >
          I
        </button>
        <span className="ml-2 text-parchment/40">
          Markdown: **bold**, *italic*
        </span>
      </div>
      <textarea
        ref={ref}
        rows={rows}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      />
    </div>
  );
}
