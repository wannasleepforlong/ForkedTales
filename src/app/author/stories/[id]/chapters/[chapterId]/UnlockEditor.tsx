"use client";

import { useState, useTransition } from "react";
import { ConditionBuilder } from "@/components/ConditionBuilder";
import type { ConditionNode } from "@/lib/types";
import { saveChapterUnlockAction } from "../choicesActions";

export function UnlockEditor({
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
  initial: ConditionNode | null;
}) {
  const [value, setValue] = useState<ConditionNode | null>(initial);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function save() {
    setMessage(null);
    const fd = new FormData();
    fd.set("chapterId", chapterId);
    fd.set("storyId", storyId);
    fd.set("unlockJson", JSON.stringify(value));
    startTransition(async () => {
      const result = await saveChapterUnlockAction(fd);
      if (result?.error) setMessage(result.error);
      else setMessage("Saved.");
    });
  }

  return (
    <div className="mt-4 space-y-3">
      <ConditionBuilder
        value={value}
        onChange={setValue}
        chapters={siblingChapters}
        choices={[]}
        flagKeys={flagKeys}
      />
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={pending}
          className="rounded bg-accent px-4 py-2 text-sm font-medium text-ink hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save unlock"}
        </button>
        {message && <span className="text-sm text-parchment/70">{message}</span>}
      </div>
    </div>
  );
}
