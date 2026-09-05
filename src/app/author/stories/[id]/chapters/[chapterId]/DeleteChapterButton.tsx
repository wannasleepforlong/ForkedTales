"use client";

import { useTransition } from "react";
import { deleteChapterAction } from "../actions";

export function DeleteChapterButton({
  chapterId,
  storyId,
  title,
}: {
  chapterId: string;
  storyId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    if (!confirm(`Delete chapter "${title}"? Its blocks and choices go with it.`)) return;
    startTransition(() => deleteChapterAction(formData));
  }

  return (
    <form action={submit} className="mt-4">
      <input type="hidden" name="id" value={chapterId} />
      <input type="hidden" name="storyId" value={storyId} />
      <button
        disabled={pending}
        className="rounded border border-red-400/50 px-3 py-1 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete chapter"}
      </button>
    </form>
  );
}
