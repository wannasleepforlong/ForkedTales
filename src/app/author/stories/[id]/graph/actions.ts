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

const layoutSchema = z.object({
  storyId: z.string().uuid(),
  positions: z.array(z.object({
    id: z.string().uuid(),
    x: z.number(),
    y: z.number(),
  })),
});

export async function saveLayoutAction(input: {
  storyId: string;
  positions: { id: string; x: number; y: number }[];
}) {
  const parsed = layoutSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad payload." };
  const supabase = await ensureAuthor(parsed.data.storyId);

  // Batch update: one row at a time (Supabase JS doesn't do bulk updates
  // without an rpc). Author edits are low-frequency, this is fine.
  await Promise.all(
    parsed.data.positions.map((p) =>
      supabase.from("chapters").update({ layout: { x: p.x, y: p.y } }).eq("id", p.id),
    ),
  );
  revalidatePath(`/author/stories/${parsed.data.storyId}/graph`);
  return { ok: true as const };
}

const createChapterSchema = z.object({
  storyId: z.string().uuid(),
  title: z.string().min(1).max(200),
  x: z.number(),
  y: z.number(),
});

export async function createChapterAtAction(input: {
  storyId: string;
  title: string;
  x: number;
  y: number;
}) {
  const parsed = createChapterSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad payload." };
  const supabase = await ensureAuthor(parsed.data.storyId);

  const { data: last } = await supabase
    .from("chapters")
    .select("order")
    .eq("story_id", parsed.data.storyId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("chapters")
    .insert({
      story_id: parsed.data.storyId,
      title: parsed.data.title,
      order: (last?.order ?? -1) + 1,
      layout: { x: parsed.data.x, y: parsed.data.y },
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  revalidatePath(`/author/stories/${parsed.data.storyId}/graph`);
  return { ok: true as const, chapterId: data.id };
}

const connectSchema = z.object({
  storyId: z.string().uuid(),
  fromChapterId: z.string().uuid(),
  targetChapterId: z.string().uuid(),
  label: z.string().min(1).max(160).default("(continue)"),
});

export async function connectChaptersAction(input: {
  storyId: string;
  fromChapterId: string;
  targetChapterId: string;
  label?: string;
}) {
  const parsed = connectSchema.safeParse({ ...input, label: input.label ?? "(continue)" });
  if (!parsed.success) return { error: "Bad payload." };
  const supabase = await ensureAuthor(parsed.data.storyId);

  const { data: last } = await supabase
    .from("choices")
    .select("order")
    .eq("from_chapter_id", parsed.data.fromChapterId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from("choices").insert({
    from_chapter_id: parsed.data.fromChapterId,
    target_chapter_id: parsed.data.targetChapterId,
    label: parsed.data.label,
    order: (last?.order ?? -1) + 1,
    show_condition: null,
    effects: [],
  });
  if (error) return { error: error.message };

  revalidatePath(`/author/stories/${parsed.data.storyId}/graph`);
  return { ok: true as const };
}

export async function deleteChoiceAction(input: { storyId: string; choiceId: string }) {
  const supabase = await ensureAuthor(input.storyId);
  await supabase.from("choices").delete().eq("id", input.choiceId);
  revalidatePath(`/author/stories/${input.storyId}/graph`);
}
