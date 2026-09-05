"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function ensureAuthor(storyId: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const { data: story } = await supabase
    .from("stories")
    .select("id, author_id")
    .eq("id", storyId)
    .maybeSingle();
  if (!story || story.author_id !== user.id) throw new Error("Story not found.");
  return supabase;
}

const saveSchema = z.object({
  chapterId: z.string().uuid(),
  storyId: z.string().uuid(),
  choicesJson: z.string(),
});

const choiceSchema = z.object({
  label: z.string().min(1).max(160),
  targetChapterId: z.string().uuid().nullable().optional(),
  order: z.number().int().min(0),
  showCondition: z.unknown().nullable().optional(),
  effects: z.array(z.record(z.string(), z.unknown())).default([]),
});

export async function saveChoicesAction(formData: FormData) {
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Bad payload." };

  const supabase = await ensureAuthor(parsed.data.storyId);

  let choices: Array<z.infer<typeof choiceSchema>>;
  try {
    const raw = JSON.parse(parsed.data.choicesJson);
    choices = z.array(choiceSchema).parse(raw);
  } catch (e) {
    return { error: "Malformed choices." };
  }

  const { error: delErr } = await supabase
    .from("choices")
    .delete()
    .eq("from_chapter_id", parsed.data.chapterId);
  if (delErr) return { error: delErr.message };

  if (choices.length > 0) {
    const rows = choices.map((c, i) => ({
      from_chapter_id: parsed.data.chapterId,
      target_chapter_id: c.targetChapterId ?? null,
      label: c.label,
      order: i,
      show_condition: c.showCondition ?? null,
      effects: c.effects ?? [],
    }));
    const { error } = await supabase.from("choices").insert(rows);
    if (error) return { error: error.message };
  }

  revalidatePath(
    `/author/stories/${parsed.data.storyId}/chapters/${parsed.data.chapterId}`,
  );
  return { ok: true as const };
}

// --------------------------- chapter unlock save --------------------------

const unlockSchema = z.object({
  chapterId: z.string().uuid(),
  storyId: z.string().uuid(),
  unlockJson: z.string(),
});

export async function saveChapterUnlockAction(formData: FormData) {
  const parsed = unlockSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Bad payload." };
  const supabase = await ensureAuthor(parsed.data.storyId);

  let unlock: unknown = null;
  const trimmed = parsed.data.unlockJson.trim();
  if (trimmed.length > 0 && trimmed !== "null") {
    try {
      unlock = JSON.parse(trimmed);
    } catch {
      return { error: "Unlock condition JSON is malformed." };
    }
  }

  const { error } = await supabase
    .from("chapters")
    .update({ unlock_condition: unlock })
    .eq("id", parsed.data.chapterId);
  if (error) return { error: error.message };
  revalidatePath(
    `/author/stories/${parsed.data.storyId}/chapters/${parsed.data.chapterId}`,
  );
  return { ok: true as const };
}
