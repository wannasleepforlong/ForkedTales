"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ConditionBuilder } from "@/components/ConditionBuilder";
import type { ConditionNode } from "@/lib/types";
import { upsertAchievementAction, deleteAchievementAction } from "./actions";

type Row = {
  id: string;
  slug: string;
  title: string;
  description: string;
  icon: string;
  unlockCondition: ConditionNode | null;
};

export function AchievementsEditor({
  storyId,
  chapters,
  flagKeys,
  initial,
}: {
  storyId: string;
  chapters: { id: string; title: string }[];
  flagKeys: string[];
  initial: Row[];
}) {
  const [rows, setRows] = useState<Row[]>(initial);
  const [drafts, setDrafts] = useState<Record<string, ConditionNode | null>>(() => {
    const m: Record<string, ConditionNode | null> = {};
    for (const r of initial) m[r.id] = r.unlockCondition;
    return m;
  });
  const [newDraft, setNewDraft] = useState<ConditionNode | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(fd: FormData) {
    setMsg(null);
    startTransition(async () => {
      const result = await upsertAchievementAction(fd);
      if (result?.error) setMsg(result.error);
      else router.refresh();
    });
  }

  function remove(id: string) {
    if (!confirm("Delete achievement?")) return;
    startTransition(async () => {
      await deleteAchievementAction({ storyId, id });
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {rows.map((r) => (
        <form
          key={r.id}
          action={submit}
          className="card p-5"
          onSubmit={(e) => {
            const fd = new FormData(e.currentTarget);
            fd.set("unlockJson", JSON.stringify(drafts[r.id] ?? null));
            e.preventDefault();
            submit(fd);
          }}
        >
          <input type="hidden" name="storyId" value={storyId} />
          <input type="hidden" name="id" value={r.id} />
          <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr_auto]">
            <label className="text-sm">
              <span className="label">Icon</span>
              <input name="icon" defaultValue={r.icon} placeholder="★" className="mt-1 w-full" />
            </label>
            <label className="text-sm">
              <span className="label">Slug</span>
              <input name="slug" defaultValue={r.slug} required className="mt-1 w-full" />
            </label>
            <label className="text-sm">
              <span className="label">Title</span>
              <input name="title" defaultValue={r.title} required className="mt-1 w-full" />
            </label>
            <div className="flex items-end gap-2">
              <button className="btn-primary" disabled={pending}>
                Save
              </button>
              <button
                type="button"
                onClick={() => remove(r.id)}
                className="btn-danger"
              >
                ✕
              </button>
            </div>
          </div>
          <label className="mt-3 block text-sm">
            <span className="label">Description</span>
            <textarea
              name="description"
              rows={2}
              defaultValue={r.description}
              className="mt-1 w-full"
            />
          </label>
          <div className="mt-3">
            <span className="label">Unlock condition</span>
            <div className="mt-1">
              <ConditionBuilder
                value={drafts[r.id] ?? null}
                onChange={(next) => setDrafts((prev) => ({ ...prev, [r.id]: next }))}
                chapters={chapters}
                choices={[]}
                flagKeys={flagKeys}
              />
            </div>
          </div>
        </form>
      ))}

      <details className="card p-5">
        <summary className="cursor-pointer font-serif text-lg text-parchment/85">
          + New achievement
        </summary>
        <form
          className="mt-4 grid gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            const fd = new FormData(e.currentTarget);
            fd.set("unlockJson", JSON.stringify(newDraft));
            fd.set("storyId", storyId);
            submit(fd);
          }}
        >
          <div className="grid gap-3 sm:grid-cols-[100px_1fr_1fr]">
            <label className="text-sm">
              <span className="label">Icon</span>
              <input name="icon" placeholder="★" className="mt-1 w-full" />
            </label>
            <label className="text-sm">
              <span className="label">Slug</span>
              <input name="slug" required placeholder="lighthouse_burns" className="mt-1 w-full" />
            </label>
            <label className="text-sm">
              <span className="label">Title</span>
              <input name="title" required className="mt-1 w-full" />
            </label>
          </div>
          <label className="text-sm">
            <span className="label">Description</span>
            <textarea name="description" rows={2} className="w-full" />
          </label>
          <div>
            <span className="label">Unlock condition</span>
            <div className="mt-1">
              <ConditionBuilder
                value={newDraft}
                onChange={setNewDraft}
                chapters={chapters}
                choices={[]}
                flagKeys={flagKeys}
              />
            </div>
          </div>
          <button className="btn-primary self-start" disabled={pending}>
            Add
          </button>
        </form>
      </details>

      {msg && <p className="text-sm text-red-300">{msg}</p>}
    </div>
  );
}
