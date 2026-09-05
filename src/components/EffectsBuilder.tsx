"use client";

import type { Effect } from "@/lib/types";

export function EffectsBuilder({
  value,
  onChange,
  chapters,
}: {
  value: Effect[];
  onChange: (next: Effect[]) => void;
  chapters: { id: string; title: string }[];
}) {
  const cn =
    "rounded border border-parchment/20 bg-transparent px-2 py-1 text-xs text-parchment";

  function patch(i: number, next: Effect) {
    onChange(value.map((e, idx) => (idx === i ? next : e)));
  }
  function remove(i: number) {
    onChange(value.filter((_, idx) => idx !== i));
  }

  return (
    <div className="space-y-2 rounded-lg border border-parchment/10 bg-black/20 p-3">
      {value.length === 0 && (
        <p className="text-xs text-parchment/50">No effects.</p>
      )}
      {value.map((eff, i) => (
        <div key={i} className="flex flex-wrap items-center gap-2">
          <select
            className={cn}
            value={eff.op}
            onChange={(e) => {
              const op = e.target.value as Effect["op"];
              if (op === "setFlag") patch(i, { op, key: "", value: true });
              else if (op === "incFlag") patch(i, { op, key: "", by: 1 });
              else if (op === "unlockEnding")
                patch(i, { op, chapterId: chapters[0]?.id ?? "" });
            }}
          >
            <option value="setFlag">set flag</option>
            <option value="incFlag">inc flag</option>
            <option value="unlockEnding">unlock ending</option>
          </select>

          {eff.op === "setFlag" && (
            <>
              <input
                className={cn + " min-w-[8rem]"}
                placeholder="flag key"
                value={eff.key}
                onChange={(e) => patch(i, { ...eff, key: e.target.value })}
              />
              <input
                className={cn + " min-w-[6rem]"}
                placeholder="value"
                value={String(eff.value)}
                onChange={(e) => patch(i, { ...eff, value: coerce(e.target.value) })}
              />
            </>
          )}

          {eff.op === "incFlag" && (
            <>
              <input
                className={cn + " min-w-[8rem]"}
                placeholder="flag key"
                value={eff.key}
                onChange={(e) => patch(i, { ...eff, key: e.target.value })}
              />
              <input
                className={cn + " w-20"}
                type="number"
                value={eff.by}
                onChange={(e) => patch(i, { ...eff, by: Number(e.target.value) })}
              />
            </>
          )}

          {eff.op === "unlockEnding" && (
            <select
              className={cn}
              value={eff.chapterId}
              onChange={(e) => patch(i, { ...eff, chapterId: e.target.value })}
            >
              <option value="">—</option>
              {chapters
                .filter(() => true)
                .map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
            </select>
          )}

          <button
            type="button"
            className="ml-auto rounded border border-red-400/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10"
            onClick={() => remove(i)}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="rounded border border-parchment/20 px-2 py-1 text-xs hover:border-accent hover:text-accent"
        onClick={() => onChange([...value, { op: "setFlag", key: "", value: true }])}
      >
        + effect
      </button>
    </div>
  );
}

function coerce(s: string): string | number | boolean {
  if (s === "true") return true;
  if (s === "false") return false;
  const n = Number(s);
  if (s.trim() !== "" && Number.isFinite(n)) return n;
  return s;
}
