"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { deleteSlotAction } from "./read/progressActions";

export type SlotSummary = {
  slot: number;
  slotName: string | null;
  currentChapterTitle: string | null;
  updatedAt: string;
};

export function SlotsPanel({
  storySlug,
  storyId,
  activeSlot,
  slots,
}: {
  storySlug: string;
  storyId: string;
  activeSlot: number;
  slots: SlotSummary[];
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function remove(slot: number) {
    if (!confirm(`Delete save slot ${slot + 1}? Its path and progress will be erased.`)) return;
    startTransition(async () => {
      await deleteSlotAction({ storyId, slot });
      router.refresh();
    });
  }

  // Suggest the next free slot number for a fresh start.
  const used = new Set(slots.map((s) => s.slot));
  let nextFree = 0;
  while (used.has(nextFree)) nextFree++;

  return (
    <div>
      <div className="flex items-center justify-between">
        <h3 className="font-serif text-lg text-parchment/80">Your saves</h3>
        <Link
          href={`/stories/${storySlug}/read?slot=${nextFree}`}
          className="rounded border border-accent px-3 py-1 text-xs text-accent hover:bg-accent hover:text-ink"
        >
          + New slot
        </Link>
      </div>

      {slots.length === 0 ? (
        <p className="mt-3 text-sm text-parchment/60">No saves yet.</p>
      ) : (
        <ul className="mt-3 divide-y divide-parchment/10 rounded-lg border border-parchment/10">
          {slots.map((s) => {
            const isActive = s.slot === activeSlot;
            return (
              <li
                key={s.slot}
                className={`flex items-center justify-between gap-3 px-4 py-3 ${
                  isActive ? "bg-accent/5" : ""
                }`}
              >
                <div className="min-w-0">
                  <p className="text-sm">
                    <span className="text-parchment/60">Slot {s.slot + 1}</span>
                    {s.slotName ? (
                      <span className="ml-2 text-parchment">{s.slotName}</span>
                    ) : null}
                  </p>
                  <p className="truncate text-xs text-parchment/50">
                    at {s.currentChapterTitle ?? "—"} · updated{" "}
                    {new Date(s.updatedAt).toLocaleString()}
                  </p>
                </div>
                <div className="flex flex-shrink-0 items-center gap-2">
                  <Link
                    href={`/stories/${storySlug}?slot=${s.slot}`}
                    className={`rounded px-2 py-1 text-xs ${
                      isActive
                        ? "border border-parchment/30 text-parchment"
                        : "border border-parchment/20 text-parchment/70 hover:border-accent hover:text-accent"
                    }`}
                  >
                    View
                  </Link>
                  <Link
                    href={`/stories/${storySlug}/read?slot=${s.slot}`}
                    className="rounded bg-accent px-2 py-1 text-xs font-medium text-ink hover:opacity-90"
                  >
                    Resume
                  </Link>
                  <button
                    onClick={() => remove(s.slot)}
                    disabled={pending}
                    className="rounded border border-red-400/40 px-2 py-1 text-xs text-red-300 hover:bg-red-500/10 disabled:opacity-60"
                  >
                    ✕
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
