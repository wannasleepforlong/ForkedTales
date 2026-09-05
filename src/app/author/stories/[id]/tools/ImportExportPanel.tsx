"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { exportStoryAction, importStoryAction } from "./actions";

export function ImportExportPanel({
  storyId,
  storyTitle,
}: {
  storyId: string;
  storyTitle: string;
}) {
  const [pending, startTransition] = useTransition();
  const [importText, setImportText] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  function doExport() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const result = await exportStoryAction(storyId);
      if (result?.error) return setErr(result.error);
      if (!result?.json) return;
      const blob = new Blob([result.json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${storyTitle.replace(/[^\w\-]+/g, "_")}.forkedtales.json`;
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Exported.");
    });
  }

  function doImport() {
    setErr(null);
    setMsg(null);
    startTransition(async () => {
      const result = await importStoryAction(importText);
      if (result?.error) return setErr(result.error);
      if (result?.storyId) {
        router.push(`/author/stories/${result.storyId}`);
        router.refresh();
      }
    });
  }

  return (
    <div className="grid gap-8">
      <section className="card p-5">
        <h2 className="font-serif text-xl text-parchment/85">Export</h2>
        <p className="mt-1 text-sm text-parchment/60">
          Downloads a JSON file with the story, chapters, blocks, choices,
          and flag definitions. Internal ids are replaced with stable local
          ids so the export re-imports cleanly.
        </p>
        <button onClick={doExport} disabled={pending} className="btn-primary mt-4">
          {pending ? "…" : "Download JSON"}
        </button>
      </section>

      <section className="card p-5">
        <h2 className="font-serif text-xl text-parchment/85">Import</h2>
        <p className="mt-1 text-sm text-parchment/60">
          Creates a new draft story from a ForkedTales export. The slug is
          re-generated so it never collides with an existing story.
        </p>
        <textarea
          rows={10}
          value={importText}
          onChange={(e) => setImportText(e.target.value)}
          placeholder="Paste export JSON here…"
          className="mt-4 w-full font-mono text-xs"
        />
        <button
          onClick={doImport}
          disabled={pending || !importText.trim()}
          className="btn-primary mt-4"
        >
          {pending ? "Importing…" : "Import as new draft"}
        </button>
      </section>

      {msg && <p className="text-sm text-teal">{msg}</p>}
      {err && <p className="text-sm text-red-300">{err}</p>}
    </div>
  );
}
