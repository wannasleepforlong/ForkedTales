"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { slugify } from "@/lib/slug";

const newStorySchema = z.object({
  title: z.string().min(2).max(120),
});

export async function createStoryAction(
  formData: FormData,
): Promise<{ error?: string; storyId?: string }> {
  const parsed = newStorySchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Give the story a title." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };

  const baseSlug = slugify(parsed.data.title) || "untitled";
  // Ensure slug uniqueness by suffixing a short random tail on collision.
  let slug = baseSlug;
  for (let i = 0; i < 4; i++) {
    const { data: existing } = await supabase
      .from("stories")
      .select("id")
      .eq("slug", slug)
      .maybeSingle();
    if (!existing) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data, error } = await supabase
    .from("stories")
    .insert({
      author_id: user.id,
      title: parsed.data.title,
      slug,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  revalidatePath("/author");
  return { storyId: data.id };
}

const updateStorySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(2).max(120),
  description: z.string().max(2000).optional().nullable(),
  tags: z.string().max(500).optional().nullable(),
  contentRating: z.enum(["everyone", "teen", "mature"]),
  status: z.enum(["draft", "ongoing", "complete"]),
  startChapterId: z.string().uuid().optional().nullable(),
});

export async function updateStoryAction(
  formData: FormData,
): Promise<{ error?: string; ok?: true }> {
  const raw = Object.fromEntries(formData);
  const parsed = updateStorySchema.safeParse({
    ...raw,
    startChapterId: raw.startChapterId || null,
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createSupabaseServerClient();
  const tags = (parsed.data.tags ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  const { error } = await supabase
    .from("stories")
    .update({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      tags,
      content_rating: parsed.data.contentRating,
      status: parsed.data.status,
      start_chapter_id: parsed.data.startChapterId,
      updated_at: new Date().toISOString(),
      published_at:
        parsed.data.status !== "draft" ? new Date().toISOString() : null,
    })
    .eq("id", parsed.data.id);

  if (error) return { error: error.message };
  revalidatePath(`/author/stories/${parsed.data.id}`);
  revalidatePath("/author");
  return { ok: true };
}

export async function deleteStoryAction(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const supabase = createSupabaseServerClient();
  await supabase.from("stories").delete().eq("id", id);
  revalidatePath("/author");
  redirect("/author");
}
