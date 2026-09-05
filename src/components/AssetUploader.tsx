"use client";

import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function AssetUploader({
  value,
  onChange,
  accept = "image/*,audio/*",
  kind = "asset",
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (url: string) => void;
  accept?: string;
  kind?: "background" | "sprite" | "sfx" | "bgm" | "asset";
  placeholder?: string;
  className?: string;
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
      const ext = (file.name.split(".").pop() || "bin").toLowerCase();
      const path = `${user.id}/${kind}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("assets")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data: pub } = supabase.storage.from("assets").getPublicUrl(path);
      onChange(pub.publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`space-y-1 ${className}`}>
      <div className="flex gap-2">
        <input
          className="flex-1 text-xs"
          placeholder={placeholder ?? "URL"}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
        <label className="rounded border border-white/15 px-2 py-1 text-xs text-parchment/80 hover:border-accent hover:text-accent cursor-pointer">
          {busy ? "…" : "Upload"}
          <input
            type="file"
            accept={accept}
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
        </label>
      </div>
      {err && <p className="text-xs text-red-300">{err}</p>}
      {value && (kind === "background" || kind === "sprite" || kind === "asset") && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={value} alt="" className="max-h-20 rounded border border-white/10" />
      )}
    </div>
  );
}
