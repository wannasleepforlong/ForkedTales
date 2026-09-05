"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function ensureAuthor(storyId: string) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const { data: story } = await supabase
    .from("stories").select("id, author_id").eq("id", storyId).maybeSingle();
  if (!story || story.author_id !== user.id) throw new Error("Story not found.");
  return supabase;
}

const flagSchema = z.object({
  storyId: z.string().uuid(),
  id: z.string().uuid().optional(),
  key: z.string().min(1).max(60).regex(/^[a-zA-Z_][a-zA-Z0-9_]*$/, "Keys must be identifier-safe."),
  kind: z.enum(["bool", "int", "string", "enum"]),
  defaultValue: z.string().optional(),
  description: z.string().max(400).optional(),
  enumValues: z.string().max(400).optional(),
});

function coerceDefault(kind: string, raw?: string): unknown {
  const v = (raw ?? "").trim();
  if (v === "") return kind === "bool" ? false : kind === "int" ? 0 : "";
  if (kind === "bool") return v === "true";
  if (kind === "int") {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : 0;
  }
  return v;
}

export async function upsertFlagDefAction(formData: FormData) {
  const parsed = flagSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid flag." };
  }
  const supabase = await ensureAuthor(parsed.data.storyId);

  const row = {
    story_id: parsed.data.storyId,
    key: parsed.data.key,
    kind: parsed.data.kind,
    default_value: coerceDefault(parsed.data.kind, parsed.data.defaultValue),
    description: parsed.data.description || null,
    enum_values: parsed.data.kind === "enum"
      ? (parsed.data.enumValues ?? "").split(",").map((s) => s.trim()).filter(Boolean)
      : null,
  };

  if (parsed.data.id) {
    const { error } = await supabase.from("flag_defs").update(row).eq("id", parsed.data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("flag_defs").insert(row);
    if (error) return { error: error.message };
  }

  revalidatePath(`/author/stories/${parsed.data.storyId}`);
  return { ok: true as const };
}

export async function deleteFlagDefAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const storyId = String(formData.get("storyId") ?? "");
  if (!id || !storyId) return;
  const supabase = await ensureAuthor(storyId);
  await supabase.from("flag_defs").delete().eq("id", id);
  revalidatePath(`/author/stories/${storyId}`);
}
