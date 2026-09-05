"use client";

import { useState, useTransition } from "react";
import { updateChapterAction } from "../actions";

type Props = {
  chapter: {
    id: string;
    storyId: string;
    title: string;
    order: number;
    draft: boolean;
    isEnding: boolean;
    endingLabel: string | null;
  };
};

export function ChapterMetaForm({ chapter }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [isEnding, setIsEnding] = useState(chapter.isEnding);

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateChapterAction(formData);
      if (result?.error) setMessage(result.error);
      else setMessage("Saved.");
    });
  }

  return (
    <form action={submit} className="mt-4 grid gap-4">
      <input type="hidden" name="id" value={chapter.id} />
      <input type="hidden" name="storyId" value={chapter.storyId} />

      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <label className="text-sm">
          <span className="text-parchment/80">Title</span>
          <input
            name="title"
            defaultValue={chapter.title}
            required
            className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
          />
        </label>
        <label className="text-sm">
          <span className="text-parchment/80">Order</span>
          <input
            name="order"
            type="number"
            min={0}
            defaultValue={chapter.order}
            required
            className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-6">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="draft"
            defaultChecked={chapter.draft}
          />
          <span>Draft (hidden from readers)</span>
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="isEnding"
            defaultChecked={chapter.isEnding}
            onChange={(e) => setIsEnding(e.target.checked)}
          />
          <span>Ending chapter</span>
        </label>
      </div>

      {isEnding && (
        <label className="text-sm">
          <span className="text-parchment/80">Ending label</span>
          <input
            name="endingLabel"
            defaultValue={chapter.endingLabel ?? ""}
            maxLength={80}
            placeholder="e.g. The Lighthouse Burns"
            className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
          />
        </label>
      )}

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-accent px-4 py-2 font-medium text-ink hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save chapter"}
        </button>
        {message && <span className="text-sm text-parchment/70">{message}</span>}
      </div>
    </form>
  );
}
