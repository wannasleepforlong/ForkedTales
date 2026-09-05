import { notFound, redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ConditionNode, Effect } from "@/lib/types";
import { Reader } from "./Reader";

export const dynamic = "force-dynamic";

export default async function ReadPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { slot?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/stories/${params.slug}/read`)}`);
  }

  const { data: story } = await supabase
    .from("stories")
    .select("id, slug, title, status, start_chapter_id")
    .eq("slug", params.slug)
    .maybeSingle();

  if (!story || !story.start_chapter_id) notFound();

  const slot = Math.max(0, Math.min(31, Number(searchParams.slot ?? 0) || 0));

  const [{ data: chapters }, { data: allBlocks }, { data: allChoices }, { data: progress }, { data: endings }] =
    await Promise.all([
      supabase
        .from("chapters")
        .select("id, title, order, is_ending, ending_label, unlock_condition")
        .eq("story_id", story.id)
        .eq("draft", false)
        .order("order", { ascending: true }),
      supabase
        .from("blocks")
        .select("chapter_id, order, type, data")
        .in(
          "chapter_id",
          (
            await supabase
              .from("chapters")
              .select("id")
              .eq("story_id", story.id)
              .eq("draft", false)
          ).data?.map((c) => c.id) ?? [],
        )
        .order("order", { ascending: true }),
      supabase
        .from("choices")
        .select("id, from_chapter_id, target_chapter_id, label, order, show_condition, effects")
        .in(
          "from_chapter_id",
          (
            await supabase
              .from("chapters")
              .select("id")
              .eq("story_id", story.id)
              .eq("draft", false)
          ).data?.map((c) => c.id) ?? [],
        )
        .order("order", { ascending: true }),
      supabase
        .from("reader_progress")
        .select("current_chapter_id, visited_chapter_ids, picked_choice_ids, flags")
        .eq("user_id", user.id)
        .eq("story_id", story.id)
        .eq("slot", slot)
        .maybeSingle(),
      supabase
        .from("discovered_endings")
        .select("chapter_id")
        .eq("user_id", user.id)
        .eq("story_id", story.id),
    ]);

  const chapterList = chapters ?? [];
  if (chapterList.length === 0) notFound();

  const blocksByChapter: Record<string, { type: string; data: Record<string, unknown> }[]> = {};
  for (const c of chapterList) blocksByChapter[c.id] = [];
  for (const b of allBlocks ?? []) {
    blocksByChapter[b.chapter_id]?.push({
      type: b.type,
      data: (b.data as Record<string, unknown>) ?? {},
    });
  }

  const choicesByChapter: Record<
    string,
    Array<{
      id: string;
      label: string;
      targetChapterId: string | null;
      showCondition: ConditionNode | null;
      effects: Effect[];
    }>
  > = {};
  for (const c of chapterList) choicesByChapter[c.id] = [];
  for (const ch of allChoices ?? []) {
    choicesByChapter[ch.from_chapter_id]?.push({
      id: ch.id,
      label: ch.label,
      targetChapterId: ch.target_chapter_id,
      showCondition: (ch.show_condition as ConditionNode | null) ?? null,
      effects: ((ch.effects as Effect[] | null) ?? []) as Effect[],
    });
  }

  return (
    <Reader
      story={{
        id: story.id,
        slug: story.slug,
        title: story.title,
        startChapterId: story.start_chapter_id,
      }}
      slot={slot}
      chapters={chapterList.map((c) => ({
        id: c.id,
        title: c.title,
        isEnding: c.is_ending,
        endingLabel: c.ending_label,
        unlockCondition: (c.unlock_condition as ConditionNode | null) ?? null,
        blocks: blocksByChapter[c.id] ?? [],
      }))}
      choicesByChapter={choicesByChapter}
      initialProgress={
        progress
          ? {
              currentChapterId: progress.current_chapter_id,
              visitedChapterIds: progress.visited_chapter_ids ?? [],
              pickedChoiceIds: progress.picked_choice_ids ?? [],
              flags: (progress.flags as Record<string, unknown>) ?? {},
            }
          : null
      }
      initialDiscoveredEndings={(endings ?? []).map((e) => e.chapter_id as string)}
    />
  );
}
