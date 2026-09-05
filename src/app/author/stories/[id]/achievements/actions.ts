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

const upsertSchema = z.object({
  storyId: z.string().uuid(),
  id: z.string().uuid().optional(),
  slug: z.string().min(1).max(60).regex(/^[a-z0-9_-]+$/, "lowercase letters, digits, - or _"),
  title: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  icon: z.string().max(4).optional(),
  unlockJson: z.string(),
});

export async function upsertAchievementAction(formData: FormData) {
  const parsed = upsertSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const supabase = await ensureAuthor(parsed.data.storyId);

  let unlock: unknown = null;
  try {
    unlock = parsed.data.unlockJson.trim() === "" ? null : JSON.parse(parsed.data.unlockJson);
  } catch {
    return { error: "Unlock condition JSON malformed." };
  }

  const row = {
    story_id: parsed.data.storyId,
    slug: parsed.data.slug,
    title: parsed.data.title,
    description: parsed.data.description || null,
    icon: parsed.data.icon || null,
    unlock_condition: unlock,
  };
  if (parsed.data.id) {
    const { error } = await supabase.from("achievements").update(row).eq("id", parsed.data.id);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("achievements").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath(`/author/stories/${parsed.data.storyId}/achievements`);
  return { ok: true as const };
}

export async function deleteAchievementAction(input: { storyId: string; id: string }) {
  const supabase = await ensureAuthor(input.storyId);
  await supabase.from("achievements").delete().eq("id", input.id);
  revalidatePath(`/author/stories/${input.storyId}/achievements`);
}
