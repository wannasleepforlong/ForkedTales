"use client";

import { useState, useTransition } from "react";
import { createChapterAction } from "../actions";

export function NewChapterForm({ storyId }: { storyId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await createChapterAction(formData);
      // On success, the action redirects and never returns.
      if (result?.error) setError(result.error);
    });
  }

  return (
    <form action={submit} className="mt-8 space-y-4">
      <input type="hidden" name="storyId" value={storyId} />
      <label className="block text-sm">
        <span className="text-parchment/80">Title</span>
        <input
          name="title"
          required
          minLength={1}
          maxLength={200}
          autoFocus
          className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
        />
      </label>
      {error && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {error}
        </p>
      )}
      <button
        disabled={pending}
        className="rounded bg-accent px-4 py-2 font-medium text-ink hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "…" : "Create"}
      </button>
    </form>
  );
}
