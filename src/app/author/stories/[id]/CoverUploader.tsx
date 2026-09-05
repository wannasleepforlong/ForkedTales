"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function CoverUploader({
  value,
  onChange,
}: {
  value: string;
  onChange: (url: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function upload(file: File) {
    setErr(null);
    setBusy(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Sign in first.");
      const ext = (file.name.split(".").pop() || "png").toLowerCase();
      const path = `${user.id}/covers/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("covers")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("covers").getPublicUrl(path);
      onChange(pub.publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 space-y-2">
      <div className="aspect-[3/4] w-full overflow-hidden rounded-lg border border-white/10 bg-black/30">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="cover" className="h-full w-full object-cover" />
        ) : (
          <div className="grid h-full place-items-center text-xs text-parchment/40">
            No cover
          </div>
        )}
      </div>
      <label className="btn-ghost w-full cursor-pointer text-center">
        {busy ? "Uploading…" : "Upload cover"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
      </label>
      <input
        placeholder="…or paste image URL"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full text-xs"
      />
      {err && <p className="text-xs text-red-300">{err}</p>}
    </div>
  );
}
