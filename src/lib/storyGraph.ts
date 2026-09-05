// Shared loader that pulls the entire story graph (chapters + blocks +
// choices + flag_defs) in one go, in the shape the linter, the graph
// editor, and the reader all want. Server-only.

import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConditionNode, Effect } from "@/lib/types";

export interface StoryGraph {
  story: {
    id: string;
    slug: string;
    title: string;
    description: string | null;
    startChapterId: string | null;
    coverUrl: string | null;
  };
  chapters: Array<{
    id: string;
    title: string;
    order: number;
    isEnding: boolean;
    endingLabel: string | null;
    draft: boolean;
    unlockCondition: ConditionNode | null;
    blocks: Array<{ type: string; data: Record<string, unknown>; order: number }>;
  }>;
  choices: Array<{
    id: string;
    fromChapterId: string;
    targetChapterId: string | null;
    label: string;
    order: number;
    showCondition: ConditionNode | null;
    effects: Effect[];
  }>;
  flagDefs: Array<{
    id: string;
    key: string;
    kind: "bool" | "int" | "string" | "enum";
    defaultValue: unknown;
    description: string | null;
    enumValues: string[] | null;
  }>;
}

export async function loadStoryGraph(
  supabase: SupabaseClient,
  storyId: string,
  opts: { includeDrafts?: boolean } = {},
): Promise<StoryGraph | null> {
  const { data: story } = await supabase
    .from("stories")
    .select("id, slug, title, description, start_chapter_id, cover_url")
    .eq("id", storyId)
    .maybeSingle();
  if (!story) return null;

  const chapterQuery = supabase
    .from("chapters")
    .select("id, title, order, is_ending, ending_label, draft, unlock_condition")
    .eq("story_id", storyId)
    .order("order", { ascending: true });
  const { data: chapters } = opts.includeDrafts
    ? await chapterQuery
    : await chapterQuery.eq("draft", false);

  const chapterIds = (chapters ?? []).map((c) => c.id);
  const [{ data: blocks }, { data: choices }, { data: flagDefs }] = await Promise.all([
    chapterIds.length
      ? supabase
          .from("blocks")
          .select("chapter_id, type, data, order")
          .in("chapter_id", chapterIds)
          .order("order", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    chapterIds.length
      ? supabase
          .from("choices")
          .select("id, from_chapter_id, target_chapter_id, label, order, show_condition, effects")
          .in("from_chapter_id", chapterIds)
          .order("order", { ascending: true })
      : Promise.resolve({ data: [] as any[] }),
    supabase
      .from("flag_defs")
      .select("id, key, kind, default_value, description, enum_values")
      .eq("story_id", storyId),
  ]);

  const blocksByChapter: Record<string, StoryGraph["chapters"][number]["blocks"]> = {};
  for (const id of chapterIds) blocksByChapter[id] = [];
  for (const b of blocks ?? []) {
    blocksByChapter[b.chapter_id]?.push({
      type: b.type,
      data: (b.data as Record<string, unknown>) ?? {},
      order: b.order,
    });
  }

  return {
    story: {
      id: story.id,
      slug: story.slug,
      title: story.title,
      description: story.description,
      startChapterId: story.start_chapter_id,
      coverUrl: story.cover_url,
    },
    chapters: (chapters ?? []).map((c) => ({
      id: c.id,
      title: c.title,
      order: c.order,
      isEnding: c.is_ending,
      endingLabel: c.ending_label,
      draft: c.draft,
      unlockCondition: (c.unlock_condition as ConditionNode | null) ?? null,
      blocks: blocksByChapter[c.id] ?? [],
    })),
    choices: (choices ?? []).map((ch) => ({
      id: ch.id,
      fromChapterId: ch.from_chapter_id,
      targetChapterId: ch.target_chapter_id,
      label: ch.label,
      order: ch.order,
      showCondition: (ch.show_condition as ConditionNode | null) ?? null,
      effects: ((ch.effects as Effect[] | null) ?? []) as Effect[],
    })),
    flagDefs: (flagDefs ?? []).map((f) => ({
      id: f.id,
      key: f.key,
      kind: f.kind,
      defaultValue: f.default_value,
      description: f.description,
      enumValues: f.enum_values,
    })),
  };
}
