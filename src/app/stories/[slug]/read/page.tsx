import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Reader } from "./Reader";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
}: {
  params: { slug: string };
}) {
  const supabase = createSupabaseServerClient();

  const { data: story } = await supabase
    .from("stories")
    .select("id, slug, title, status, start_chapter_id")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!story || !story.start_chapter_id) notFound();

  // Phase-1 reader: linear traversal over all published chapters in `order`.
  // Branching by choice arrives when the condition engine lands.
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, order, is_ending, ending_label")
    .eq("story_id", story.id)
    .eq("draft", false)
    .order("order", { ascending: true });

  const chapterList = chapters ?? [];
  if (chapterList.length === 0) notFound();

  const chapterIds = chapterList.map((c) => c.id);
  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, chapter_id, order, type, data")
    .in("chapter_id", chapterIds)
    .order("order", { ascending: true });

  const blocksByChapter: Record<string, { type: string; data: Record<string, unknown> }[]> = {};
  for (const id of chapterIds) blocksByChapter[id] = [];
  for (const b of blocks ?? []) {
    blocksByChapter[b.chapter_id].push({
      type: b.type,
      data: (b.data as Record<string, unknown>) ?? {},
    });
  }

  return (
    <Reader
      storyTitle={story.title}
      storySlug={story.slug}
      chapters={chapterList.map((c) => ({
        id: c.id,
        title: c.title,
        isEnding: c.is_ending,
        endingLabel: c.ending_label,
        blocks: blocksByChapter[c.id],
      }))}
    />
  );
}
