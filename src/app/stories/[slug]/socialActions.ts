"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { REACTION_EMOJIS } from "./reactionEmojis";

const toggleSchema = z.object({
  storyId: z.string().uuid(),
  slug: z.string(),
  emoji: z.string().min(1).max(8),
});

export async function toggleReactionAction(
  input: { storyId: string; slug: string; emoji: string },
) {
  const parsed = toggleSchema.safeParse(input);
  if (!parsed.success) return { error: "Bad payload." };
  if (!(REACTION_EMOJIS as readonly string[]).includes(parsed.data.emoji)) {
    return { error: "Unknown emoji." };
  }

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to react." };

  const { data: existing } = await supabase
    .from("story_reactions")
    .select("emoji")
    .eq("user_id", user.id)
    .eq("story_id", parsed.data.storyId)
    .eq("emoji", parsed.data.emoji)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("story_reactions")
      .delete()
      .eq("user_id", user.id)
      .eq("story_id", parsed.data.storyId)
      .eq("emoji", parsed.data.emoji);
  } else {
    await supabase
      .from("story_reactions")
      .insert({ user_id: user.id, story_id: parsed.data.storyId, emoji: parsed.data.emoji });
  }

  revalidatePath(`/stories/${parsed.data.slug}`);
  return { ok: true as const };
}

const commentSchema = z.object({
  storyId: z.string().uuid(),
  slug: z.string(),
  body: z.string().min(1).max(4000),
});

export async function postCommentAction(
  input: { storyId: string; slug: string; body: string },
) {
  const parsed = commentSchema.safeParse(input);
  if (!parsed.success) return { error: "Say something first." };

  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to comment." };

  const { error } = await supabase.from("story_comments").insert({
    user_id: user.id,
    story_id: parsed.data.storyId,
    body: parsed.data.body,
  });
  if (error) return { error: error.message };

  revalidatePath(`/stories/${parsed.data.slug}`);
  return { ok: true as const };
}

export async function deleteCommentAction(input: { commentId: string; slug: string }) {
  const supabase = createSupabaseServerClient();
  await supabase.from("story_comments").delete().eq("id", input.commentId);
  revalidatePath(`/stories/${input.slug}`);
}
