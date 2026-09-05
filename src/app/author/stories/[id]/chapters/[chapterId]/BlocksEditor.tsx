"use client";

import { useState, useTransition } from "react";
import { saveBlocksAction } from "../actions";

type EditableBlock = {
  type: string;
  data: Record<string, unknown>;
};

const BLOCK_LIBRARY: {
  type: string;
  label: string;
  make: () => EditableBlock;
}[] = [
  { type: "narration", label: "Narration", make: () => ({ type: "narration", data: { text: "" } }) },
  { type: "dialogue", label: "Dialogue", make: () => ({ type: "dialogue", data: { speaker: "", text: "" } }) },
  { type: "background", label: "Background", make: () => ({ type: "background", data: { image: "", transition: "fade" } }) },
  { type: "sprite", label: "Sprite", make: () => ({ type: "sprite", data: { image: "", side: "center", action: "show" } }) },
  { type: "sfx", label: "SFX", make: () => ({ type: "sfx", data: { url: "" } }) },
  { type: "bgm.play", label: "BGM — play", make: () => ({ type: "bgm.play", data: { track: "", loop: true, fadeMs: 800, volume: 0.7 } }) },
  { type: "bgm.change", label: "BGM — change", make: () => ({ type: "bgm.change", data: { track: "", fadeMs: 800, volume: 0.7 } }) },
  { type: "bgm.stop", label: "BGM — stop", make: () => ({ type: "bgm.stop", data: { fadeMs: 800 } }) },
  { type: "wait", label: "Wait", make: () => ({ type: "wait", data: { ms: 800 } }) },
];

export function BlocksEditor({
  chapterId,
  storyId,
  initialBlocks,
}: {
  chapterId: string;
  storyId: string;
  initialBlocks: EditableBlock[];
}) {
  const [blocks, setBlocks] = useState<EditableBlock[]>(initialBlocks);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function add(type: string) {
    const spec = BLOCK_LIBRARY.find((b) => b.type === type);
    if (!spec) return;
    setBlocks((prev) => [...prev, spec.make()]);
  }

  function remove(i: number) {
    setBlocks((prev) => prev.filter((_, idx) => idx !== i));
  }

  function move(i: number, dir: -1 | 1) {
    setBlocks((prev) => {
      const j = i + dir;
      if (j < 0 || j >= prev.length) return prev;
      const next = prev.slice();
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });
  }

  function patch(i: number, key: string, value: unknown) {
    setBlocks((prev) =>
      prev.map((b, idx) => (idx === i ? { ...b, data: { ...b.data, [key]: value } } : b)),
    );
  }

  function save() {
    setMessage(null);
    const fd = new FormData();
    fd.set("chapterId", chapterId);
    fd.set("storyId", storyId);
    fd.set("blocksJson", JSON.stringify(blocks));
    startTransition(async () => {
      const result = await saveBlocksAction(fd);
      if (result?.error) setMessage(result.error);
      else setMessage("Saved.");
    });
  }

  return (
    <div className="mt-4">
      <ul className="space-y-3">
        {blocks.map((b, i) => (
          <li
            key={i}
            className="rounded border border-parchment/10 bg-parchment/[0.02] p-3"
          >
            <div className="flex items-center justify-between text-xs text-parchment/60">
              <span className="font-mono">{b.type}</span>
              <div className="flex items-center gap-2">
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
            <BlockFields block={b} onPatch={(k, v) => patch(i, k, v)} />
          </li>
        ))}
      </ul>

      {blocks.length === 0 && (
        <p className="text-sm text-parchment/60">No blocks yet — add one below.</p>
      )}

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {BLOCK_LIBRARY.map((spec) => (
          <button
            key={spec.type}
            type="button"
            onClick={() => add(spec.type)}
            className="rounded border border-parchment/20 px-2 py-1 text-xs hover:border-accent hover:text-accent"
          >
            + {spec.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={save}
          className="rounded bg-accent px-4 py-2 font-medium text-ink hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save content"}
        </button>
        {message && <span className="text-sm text-parchment/70">{message}</span>}
      </div>
    </div>
  );
}

function BlockFields({
  block,
  onPatch,
}: {
  block: EditableBlock;
  onPatch: (key: string, value: unknown) => void;
}) {
  const cn =
    "mt-1 w-full rounded border border-parchment/20 bg-transparent px-2 py-1 text-sm";

  switch (block.type) {
    case "narration":
      return (
        <textarea
          rows={3}
          className={cn}
          value={String(block.data.text ?? "")}
          onChange={(e) => onPatch("text", e.target.value)}
          placeholder="The wind pulled at the shutters…"
        />
      );
    case "dialogue":
      return (
        <div className="grid gap-2 sm:grid-cols-[1fr_3fr]">
          <input
            className={cn}
            placeholder="Speaker"
            value={String(block.data.speaker ?? "")}
            onChange={(e) => onPatch("speaker", e.target.value)}
          />
          <textarea
            rows={2}
            className={cn}
            placeholder="Line…"
            value={String(block.data.text ?? "")}
            onChange={(e) => onPatch("text", e.target.value)}
          />
        </div>
      );
    case "background":
      return (
        <div className="grid gap-2 sm:grid-cols-[3fr_1fr]">
          <input
            className={cn}
            placeholder="Image URL"
            value={String(block.data.image ?? "")}
            onChange={(e) => onPatch("image", e.target.value)}
          />
          <select
            className={cn}
            value={String(block.data.transition ?? "fade")}
            onChange={(e) => onPatch("transition", e.target.value)}
          >
            <option value="cut">cut</option>
            <option value="fade">fade</option>
          </select>
        </div>
      );
    case "sprite":
      return (
        <div className="grid gap-2 sm:grid-cols-3">
          <input
            className={cn}
            placeholder="Image URL"
            value={String(block.data.image ?? "")}
            onChange={(e) => onPatch("image", e.target.value)}
          />
          <select
            className={cn}
            value={String(block.data.side ?? "center")}
            onChange={(e) => onPatch("side", e.target.value)}
          >
            <option value="left">left</option>
            <option value="center">center</option>
            <option value="right">right</option>
          </select>
          <select
            className={cn}
            value={String(block.data.action ?? "show")}
            onChange={(e) => onPatch("action", e.target.value)}
          >
            <option value="show">show</option>
            <option value="hide">hide</option>
          </select>
        </div>
      );
    case "sfx":
      return (
        <input
          className={cn}
          placeholder="Audio URL"
          value={String(block.data.url ?? "")}
          onChange={(e) => onPatch("url", e.target.value)}
        />
      );
    case "bgm.play":
    case "bgm.change":
      return (
        <div className="grid gap-2 sm:grid-cols-[2fr_1fr_1fr]">
          <input
            className={cn}
            placeholder="Track URL"
            value={String(block.data.track ?? "")}
            onChange={(e) => onPatch("track", e.target.value)}
          />
          <input
            className={cn}
            type="number"
            min={0}
            placeholder="Fade (ms)"
            value={Number(block.data.fadeMs ?? 800)}
            onChange={(e) => onPatch("fadeMs", Number(e.target.value))}
          />
          <input
            className={cn}
            type="number"
            step="0.05"
            min={0}
            max={1}
            placeholder="Volume 0–1"
            value={Number(block.data.volume ?? 0.7)}
            onChange={(e) => onPatch("volume", Number(e.target.value))}
          />
        </div>
      );
    case "bgm.stop":
      return (
        <input
          className={cn}
          type="number"
          min={0}
          placeholder="Fade (ms)"
          value={Number(block.data.fadeMs ?? 800)}
          onChange={(e) => onPatch("fadeMs", Number(e.target.value))}
        />
      );
    case "wait":
      return (
        <input
          className={cn}
          type="number"
          min={0}
          placeholder="ms"
          value={Number(block.data.ms ?? 800)}
          onChange={(e) => onPatch("ms", Number(e.target.value))}
        />
      );
    default:
      return null;
  }
}
