"use client";

import { useState, useTransition } from "react";
import { ConditionBuilder } from "@/components/ConditionBuilder";
import { EffectsBuilder } from "@/components/EffectsBuilder";
import type { ConditionNode, Effect } from "@/lib/types";
import { saveChoicesAction } from "../choicesActions";

type EditableChoice = {
  label: string;
  targetChapterId: string | null;
  order: number;
  showCondition: ConditionNode | null;
  effects: Effect[];
};

export function ChoicesEditor({
  chapterId,
  storyId,
  siblingChapters,
  flagKeys,
  initial,
}: {
  chapterId: string;
  storyId: string;
  siblingChapters: { id: string; title: string }[];
  flagKeys: string[];
  initial: EditableChoice[];
}) {
  const [choices, setChoices] = useState<EditableChoice[]>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function patch(i: number, next: Partial<EditableChoice>) {
    setChoices((prev) => prev.map((c, idx) => (idx === i ? { ...c, ...next } : c)));
  }
  function remove(i: number) {
    setChoices((prev) => prev.filter((_, idx) => idx !== i));
  }
  function add() {
    setChoices((prev) => [
      ...prev,
      {
        label: "",
        targetChapterId: null,
        order: prev.length,
        showCondition: null,
        effects: [],
      },
    ]);
  }
  function move(i: number, dir: -1 | 1) {
    setChoices((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next.map((c, idx) => ({ ...c, order: idx }));
    });
  }
  function save() {
    setMessage(null);
    const fd = new FormData();
    fd.set("chapterId", chapterId);
    fd.set("storyId", storyId);
    fd.set(
      "choicesJson",
      JSON.stringify(
        choices.map((c, i) => ({ ...c, order: i })),
      ),
    );
    startTransition(async () => {
      const result = await saveChoicesAction(fd);
      if (result?.error) setMessage(result.error);
      else setMessage("Saved.");
    });
  }

  return (
    <div className="mt-4 space-y-4">
      {choices.length === 0 && (
        <p className="text-sm text-parchment/60">
          No choices yet. Add one to branch out of this chapter.
        </p>
      )}

      {choices.map((c, i) => (
        <div
          key={i}
          className="rounded-lg border border-parchment/10 bg-parchment/[0.02] p-4"
        >
          <div className="flex items-center justify-between text-xs text-parchment/60">
            <span>Choice {i + 1}</span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => move(i, -1)}
                className="rounded border border-parchment/20 px-2 hover:border-accent"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                className="rounded border border-parchment/20 px-2 hover:border-accent"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="rounded border border-red-400/40 px-2 text-red-300 hover:bg-red-500/10"
              >
                ✕
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-3 sm:grid-cols-[2fr_1fr]">
            <label className="text-sm">
              <span className="text-parchment/80">Label</span>
              <input
                value={c.label}
                onChange={(e) => patch(i, { label: e.target.value })}
                placeholder="Trust her"
                className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
              />
            </label>
            <label className="text-sm">
              <span className="text-parchment/80">Target chapter</span>
              <select
                value={c.targetChapterId ?? ""}
                onChange={(e) =>
                  patch(i, { targetChapterId: e.target.value || null })
                }
                className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
              >
                <option value="">— (dead end)</option>
                {siblingChapters.map((ch) => (
                  <option key={ch.id} value={ch.id}>
                    {ch.title}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-parchment/60">
                Show condition
              </p>
              <ConditionBuilder
                value={c.showCondition}
                onChange={(next) => patch(i, { showCondition: next })}
                chapters={siblingChapters}
                choices={[]}
                flagKeys={flagKeys}
              />
            </div>
            <div>
              <p className="mb-1 text-xs uppercase tracking-wider text-parchment/60">
                Effects on pick
              </p>
              <EffectsBuilder
                value={c.effects}
                onChange={(next) => patch(i, { effects: next })}
                chapters={siblingChapters}
              />
            </div>
          </div>
        </div>
      ))}

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={add}
          className="rounded border border-parchment/20 px-3 py-1 text-sm hover:border-accent hover:text-accent"
        >
          + choice
        </button>
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save choices"}
        </button>
        {message && <span className="text-sm text-parchment/70">{message}</span>}
      </div>
    </div>
  );
}
