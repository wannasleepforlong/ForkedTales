"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createStoryAction } from "./actions";

export function NewStoryForm() {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createStoryAction(formData);
      if (result?.error) return setError(result.error);
      if (result?.storyId) {
        router.push(`/author/stories/${result.storyId}`);
        router.refresh();
      }
    });
  }

  return (
    <form
      action={submit}
      className="flex flex-col gap-3 rounded border border-parchment/10 p-4 sm:flex-row sm:items-end"
    >
      <label className="flex-1 text-sm">
        <span className="text-parchment/80">Title</span>
        <input
          name="title"
          required
          minLength={2}
          maxLength={120}
          placeholder="The Last Lighthouse"
          className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
        />
      </label>
      <button
        disabled={pending}
        className="rounded bg-accent px-4 py-2 font-medium text-ink hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "…" : "New story"}
      </button>
      {error && (
        <p className="w-full text-sm text-red-300">{error}</p>
      )}
    </form>
  );
}
