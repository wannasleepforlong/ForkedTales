"use client";

import { useState, useTransition } from "react";
import { updateStoryAction } from "@/app/author/actions";
import { CoverUploader } from "./CoverUploader";

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
    coverUrl: string | null;
  };
  chapters: Chapter[];
};

export function StoryMetaForm({ story, chapters }: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [coverUrl, setCoverUrl] = useState<string>(story.coverUrl ?? "");

  function submit(formData: FormData) {
    setMessage(null);
    formData.set("coverUrl", coverUrl);
    startTransition(async () => {
      const result = await updateStoryAction(formData);
      if (result?.error) setMessage(result.error);
      else setMessage("Saved.");
    });
  }

  return (
    <form action={submit} className="grid gap-4">
      <input type="hidden" name="id" value={story.id} />

      <div className="grid gap-4 lg:grid-cols-[1fr_240px]">
        <div className="grid gap-4">
          <label className="text-sm">
            <span className="label">Title</span>
            <input name="title" defaultValue={story.title} required className="mt-1 w-full" />
          </label>

          <label className="text-sm">
            <span className="label">Description</span>
            <textarea
              name="description"
              rows={4}
              defaultValue={story.description ?? ""}
              className="mt-1 w-full"
            />
          </label>

          <label className="text-sm">
            <span className="label">Tags (comma-separated)</span>
            <input name="tags" defaultValue={story.tags.join(", ")} className="mt-1 w-full" />
          </label>
        </div>

        <div>
          <span className="label">Cover</span>
          <CoverUploader value={coverUrl} onChange={setCoverUrl} />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm">
          <span className="label">Rating</span>
          <select name="contentRating" defaultValue={story.contentRating} className="mt-1 w-full">
            <option value="everyone">Everyone</option>
            <option value="teen">Teen</option>
            <option value="mature">Mature</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Status</span>
          <select name="status" defaultValue={story.status} className="mt-1 w-full">
            <option value="draft">Draft</option>
            <option value="ongoing">Ongoing</option>
            <option value="complete">Complete</option>
          </select>
        </label>
        <label className="text-sm">
          <span className="label">Start chapter</span>
          <select
            name="startChapterId"
            defaultValue={story.startChapterId ?? ""}
            className="mt-1 w-full"
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
        <button disabled={pending} className="btn-primary">
          {pending ? "Saving…" : "Save details"}
        </button>
        {message && <span className="text-sm text-parchment/70">{message}</span>}
      </div>
    </form>
  );
}
