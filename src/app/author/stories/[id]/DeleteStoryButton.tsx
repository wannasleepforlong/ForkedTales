"use client";

import { useTransition } from "react";
import { deleteStoryAction } from "@/app/author/actions";

export function DeleteStoryButton({
  storyId,
  title,
}: {
  storyId: string;
  title: string;
}) {
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    if (
      !confirm(
        `Delete "${title}"? Chapters, choices, and reader progress for this story will be removed. This cannot be undone.`,
      )
    ) {
      return;
    }
    startTransition(() => deleteStoryAction(formData));
  }

  return (
    <form action={submit} className="mt-4">
      <input type="hidden" name="id" value={storyId} />
      <button
        disabled={pending}
        className="rounded border border-red-400/50 px-3 py-1 text-sm text-red-300 hover:bg-red-500/10 disabled:opacity-60"
      >
        {pending ? "Deleting…" : "Delete story"}
      </button>
    </form>
  );
}
