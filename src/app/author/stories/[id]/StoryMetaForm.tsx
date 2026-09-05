"use client";

import { useState, useTransition } from "react";
import { updateStoryAction } from "@/app/author/actions";

type Chapter = { id: string; title: string };
type Props = {
  story: {
    id: string;
    title: string;
    description: string | null;
    tags: string[];
    contentRating: "everyone" | "teen" | "mature";
    status: "draft" | "ongoing" | "complete";
    startChapterId: string | null;
  };
  chapters: Chapter[];
};

export function StoryMetaForm({ story, chapters }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const result = await updateStoryAction(formData);
      if (result?.error) setMessage(result.error);
      else setMessage("Saved.");
    });
  }

  return (
    <form action={submit} className="mt-4 grid gap-4">
      <input type="hidden" name="id" value={story.id} />

      <label className="text-sm">
        <span className="text-parchment/80">Title</span>
        <input
          name="title"
          defaultValue={story.title}
          required
          className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
        />
      </label>

      <label className="text-sm">
        <span className="text-parchment/80">Description</span>
        <textarea
          name="description"
          rows={4}
          defaultValue={story.description ?? ""}
          className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
        />
      </label>

      <label className="text-sm">
        <span className="text-parchment/80">Tags (comma-separated)</span>
        <input
          name="tags"
          defaultValue={story.tags.join(", ")}
          className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="text-parchment/80">Rating</span>
          <select
            name="contentRating"
            defaultValue={story.contentRating}
            className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
          >
            <option value="everyone">Everyone</option>
            <option value="teen">Teen</option>
            <option value="mature">Mature</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-parchment/80">Status</span>
          <select
            name="status"
            defaultValue={story.status}
            className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
          >
            <option value="draft">Draft</option>
            <option value="ongoing">Ongoing</option>
            <option value="complete">Complete</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="text-parchment/80">Start chapter</span>
          <select
            name="startChapterId"
            defaultValue={story.startChapterId ?? ""}
            className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
          >
            <option value="">— none yet —</option>
            {chapters.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          disabled={pending}
          className="rounded bg-accent px-4 py-2 font-medium text-ink hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save details"}
        </button>
        {message && <span className="text-sm text-parchment/70">{message}</span>}
      </div>
    </form>
  );
}
