"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

async function ensureAuthorOwnsStory(storyId: string) {
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
  if (!story || story.author_id !== user.id) {
    throw new Error("Story not found.");
  }
  return { supabase, user };
}

// ---------------------------------------------------------------------------
// createChapterAction
// ---------------------------------------------------------------------------

const createSchema = z.object({
  storyId: z.string().uuid(),
  title: z.string().min(1).max(200),
});

export async function createChapterAction(formData: FormData) {
  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Chapter title is required." };

  const { supabase } = await ensureAuthorOwnsStory(parsed.data.storyId);

  const { data: last } = await supabase
    .from("chapters")
    .select("order")
    .eq("story_id", parsed.data.storyId)
    .order("order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextOrder = (last?.order ?? -1) + 1;
  const { data, error } = await supabase
    .from("chapters")
    .insert({
      story_id: parsed.data.storyId,
      title: parsed.data.title,
      order: nextOrder,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };

  // If this is the first chapter, make it the start chapter automatically.
  if (nextOrder === 0) {
    await supabase
      .from("stories")
      .update({ start_chapter_id: data.id })
      .eq("id", parsed.data.storyId);
  }

  revalidatePath(`/author/stories/${parsed.data.storyId}`);
  redirect(`/author/stories/${parsed.data.storyId}/chapters/${data.id}`);
}

// ---------------------------------------------------------------------------
// updateChapterAction (metadata: title, order, draft, isEnding)
// ---------------------------------------------------------------------------

const updateSchema = z.object({
  id: z.string().uuid(),
  storyId: z.string().uuid(),
  title: z.string().min(1).max(200),
  order: z.coerce.number().int().min(0),
  draft: z.enum(["on", ""]).optional(),
  isEnding: z.enum(["on", ""]).optional(),
  endingLabel: z.string().max(80).optional().nullable(),
});

export async function updateChapterAction(formData: FormData) {
  const raw = Object.fromEntries(formData);
  const parsed = updateSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }
  const { supabase } = await ensureAuthorOwnsStory(parsed.data.storyId);

  const draft = parsed.data.draft === "on";
  const isEnding = parsed.data.isEnding === "on";

  const { error } = await supabase
    .from("chapters")
    .update({
      title: parsed.data.title,
      order: parsed.data.order,
      draft,
      is_ending: isEnding,
      ending_label: isEnding ? parsed.data.endingLabel || null : null,
      published_at: draft ? null : new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };
  revalidatePath(
    `/author/stories/${parsed.data.storyId}/chapters/${parsed.data.id}`,
  );
  revalidatePath(`/author/stories/${parsed.data.storyId}`);
  return { ok: true as const };
}

// ---------------------------------------------------------------------------
// deleteChapterAction
// ---------------------------------------------------------------------------

export async function deleteChapterAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const storyId = String(formData.get("storyId") ?? "");
  if (!id || !storyId) return;

  const { supabase } = await ensureAuthorOwnsStory(storyId);
  await supabase.from("chapters").delete().eq("id", id);

  revalidatePath(`/author/stories/${storyId}`);
  redirect(`/author/stories/${storyId}`);
}

// ---------------------------------------------------------------------------
// saveBlocksAction: replace all blocks for a chapter
// ---------------------------------------------------------------------------

const blockSchema = z.object({
  type: z.string(),
  data: z.record(z.string(), z.unknown()),
});

const saveBlocksSchema = z.object({
  chapterId: z.string().uuid(),
  storyId: z.string().uuid(),
  blocksJson: z.string(),
});

export async function saveBlocksAction(formData: FormData) {
  const parsed = saveBlocksSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Bad payload." };

  const { supabase } = await ensureAuthorOwnsStory(parsed.data.storyId);

  let blocks: Array<z.infer<typeof blockSchema>>;
  try {
    const raw = JSON.parse(parsed.data.blocksJson);
    blocks = z.array(blockSchema).parse(raw);
  } catch {
    return { error: "Malformed block data." };
  }

  const { error: delErr } = await supabase
    .from("blocks")
    .delete()
    .eq("chapter_id", parsed.data.chapterId);
  if (delErr) return { error: delErr.message };

  if (blocks.length > 0) {
    const rows = blocks.map((b, i) => ({
      chapter_id: parsed.data.chapterId,
      order: i,
      type: b.type,
      data: b.data,
    }));
    const { error: insErr } = await supabase.from("blocks").insert(rows);
    if (insErr) return { error: insErr.message };
  }

  await supabase
    .from("chapters")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", parsed.data.chapterId);

  revalidatePath(
    `/author/stories/${parsed.data.storyId}/chapters/${parsed.data.chapterId}`,
  );
  return { ok: true as const };
}
