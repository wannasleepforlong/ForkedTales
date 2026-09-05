"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { upsertFlagDefAction, deleteFlagDefAction } from "./flagsActions";

export type FlagRow = {
  id: string;
  key: string;
  kind: "bool" | "int" | "string" | "enum";
  defaultValue: unknown;
  description: string | null;
  enumValues: string[] | null;
};

export function FlagsPanel({
  storyId,
  flags,
}: {
  storyId: string;
  flags: FlagRow[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [adding, setAdding] = useState(false);
  const router = useRouter();

  function submit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await upsertFlagDefAction(formData);
      if (result?.error) setError(result.error);
      else {
        setAdding(false);
        router.refresh();
      }
    });
  }

  function remove(id: string, key: string) {
    if (!confirm(`Delete flag "${key}"? References in conditions/effects will break.`)) return;
    const fd = new FormData();
    fd.set("id", id);
    fd.set("storyId", storyId);
    startTransition(async () => {
      await deleteFlagDefAction(fd);
      router.refresh();
    });
  }

  return (
    <div>
      {flags.length === 0 ? (
        <p className="text-sm text-parchment/60">
          No flags declared yet. Adding them lets the condition and effect
          builders autocomplete.
        </p>
      ) : (
        <ul className="grid gap-2">
          {flags.map((f) => (
            <li key={f.id} className="card p-4">
              <FlagEditor storyId={storyId} flag={f} onSubmit={submit} onDelete={remove} pending={pending} />
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <div className="mt-3 card p-4">
          <FlagEditor storyId={storyId} onSubmit={submit} pending={pending} />
        </div>
      )}

      <div className="mt-4 flex items-center gap-3">
        {!adding && (
          <button type="button" onClick={() => setAdding(true)} className="btn-ghost">
            + New flag
          </button>
        )}
        {error && <span className="text-sm text-red-300">{error}</span>}
      </div>
    </div>
  );
}

function FlagEditor({
  storyId,
  flag,
  onSubmit,
  onDelete,
  pending,
}: {
  storyId: string;
  flag?: FlagRow;
  onSubmit: (fd: FormData) => void;
  onDelete?: (id: string, key: string) => void;
  pending: boolean;
}) {
  const [kind, setKind] = useState<FlagRow["kind"]>(flag?.kind ?? "bool");
  return (
    <form action={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_1fr_2fr_auto]">
      <input type="hidden" name="storyId" value={storyId} />
      {flag && <input type="hidden" name="id" value={flag.id} />}
      <label className="text-sm">
        <span className="label">Key</span>
        <input name="key" defaultValue={flag?.key ?? ""} required className="mt-1 w-full" />
      </label>
      <label className="text-sm">
        <span className="label">Kind</span>
        <select
          name="kind"
          defaultValue={flag?.kind ?? "bool"}
          onChange={(e) => setKind(e.target.value as FlagRow["kind"])}
          className="mt-1 w-full"
        >
          <option value="bool">bool</option>
          <option value="int">int</option>
          <option value="string">string</option>
          <option value="enum">enum</option>
        </select>
      </label>
      <label className="text-sm">
        <span className="label">Default</span>
        <input
          name="defaultValue"
          defaultValue={flag?.defaultValue == null ? "" : String(flag.defaultValue)}
          placeholder={kind === "bool" ? "true / false" : kind === "int" ? "0" : ""}
          className="mt-1 w-full"
        />
      </label>
      <label className="text-sm sm:col-span-1">
        <span className="label">{kind === "enum" ? "Enum values (comma)" : "Description"}</span>
        <input
          name={kind === "enum" ? "enumValues" : "description"}
          defaultValue={
            kind === "enum" ? (flag?.enumValues ?? []).join(", ") : flag?.description ?? ""
          }
          className="mt-1 w-full"
        />
      </label>
      <div className="flex items-end gap-2">
        <button disabled={pending} className="btn-primary">
          {flag ? "Save" : "Add"}
        </button>
        {flag && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(flag.id, flag.key)}
            className="btn-danger"
          >
            ✕
          </button>
        )}
      </div>
    </form>
  );
}
