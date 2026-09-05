"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadStoryGraph } from "@/lib/storyGraph";
import { graphToExport, importSchema } from "@/lib/storyIO";
import { slugify } from "@/lib/slug";

async function requireAuthorForStory(storyId: string) {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in first.");
  const { data: story } = await supabase
    .from("stories")
    .select("id, author_id, content_rating, status, tags, warnings")
    .eq("id", storyId)
    .maybeSingle();
  if (!story || story.author_id !== user.id) throw new Error("Story not found.");
  return { supabase, story, userId: user.id };
}

export async function exportStoryAction(storyId: string) {
  const { supabase, story } = await requireAuthorForStory(storyId);
  const graph = await loadStoryGraph(supabase, storyId, { includeDrafts: true });
  if (!graph) return { error: "Not found." };
  const payload = graphToExport(graph, {
    contentRating: story.content_rating,
    status: story.status,
    tags: story.tags,
    warnings: story.warnings,
  });
  return { ok: true as const, json: JSON.stringify(payload, null, 2) };
}

export async function importStoryAction(
  raw: string,
): Promise<{ error?: string; storyId?: string }> {
  const supabase = createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in first." };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { error: "Not valid JSON." };
  }
  const parsed = importSchema.safeParse(json);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid export file." };
  }
  const data = parsed.data;

  // Unique slug (fresh — never re-use the incoming one blindly).
  const baseSlug = slugify(data.story.slug || data.story.title) || "imported";
  let slug = baseSlug;
  for (let i = 0; i < 6; i++) {
    const { data: exists } = await supabase.from("stories").select("id").eq("slug", slug).maybeSingle();
    if (!exists) break;
    slug = `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
  }

  const { data: newStory, error: storyErr } = await supabase
    .from("stories")
    .insert({
      author_id: user.id,
      slug,
      title: data.story.title,
      description: data.story.description ?? null,
      cover_url: data.story.coverUrl ?? null,
      tags: data.story.tags ?? [],
      warnings: data.story.warnings ?? [],
      content_rating: data.story.contentRating ?? "everyone",
      status: "draft",
    })
    .select("id")
    .single();
  if (storyErr) return { error: storyErr.message };
  const storyId = newStory.id;

  // Flag defs (best-effort; ignore duplicates via unique(story_id, key))
  if (data.flagDefs.length > 0) {
    const rows = data.flagDefs
      .filter((f: any) => typeof f?.key === "string")
      .map((f: any) => ({
        story_id: storyId,
        key: f.key,
        kind: f.kind ?? "bool",
        default_value: f.defaultValue ?? null,
        description: f.description ?? null,
        enum_values: f.enumValues ?? null,
      }));
    if (rows.length) await supabase.from("flag_defs").insert(rows);
  }

  // Chapters
  const localToDbChapter: Record<string, string> = {};
  const chapterInsertRows = data.chapters.map((c) => ({
    story_id: storyId,
    title: c.title,
    order: c.order,
    is_ending: c.isEnding,
    ending_label: c.endingLabel ?? null,
    draft: c.draft,
    unlock_condition: c.unlockCondition ?? null,
  }));
  if (chapterInsertRows.length) {
    const { data: chRows, error } = await supabase
      .from("chapters")
      .insert(chapterInsertRows)
      .select("id, title, order");
    if (error) return { error: error.message };

    // Match returned rows back to the export's localIds by (title, order).
    const key = (t: string, o: number) => `${t}::${o}`;
    const byKey = new Map<string, string>();
    for (const r of chRows ?? []) byKey.set(key(r.title, r.order), r.id);
    for (const c of data.chapters) {
      const dbId = byKey.get(key(c.title, c.order));
      if (dbId) localToDbChapter[c.localId] = dbId;
    }
  }

  // Blocks (per chapter)
  const blockRows: Array<{
    chapter_id: string;
    order: number;
    type: string;
    data: Record<string, unknown>;
  }> = [];
  for (const c of data.chapters) {
    const dbId = localToDbChapter[c.localId];
    if (!dbId) continue;
    (c.blocks as any[]).forEach((b, i) =>
      blockRows.push({
        chapter_id: dbId,
        order: b.order ?? i,
        type: b.type,
        data: b.data ?? {},
      }),
    );
  }
  if (blockRows.length) {
    await supabase.from("blocks").insert(blockRows);
  }

  // Choices — rewrite localIds to db ids
  const localToDbChoice: Record<string, string> = {};
  const remapCondition = (n: any): any => {
    if (!n || typeof n !== "object") return n;
    if (n.op === "and" || n.op === "or")
      return { ...n, children: n.children.map(remapCondition) };
    if (n.op === "not") return { ...n, child: remapCondition(n.child) };
    if (n.op === "visited" || n.op === "endingReached")
      return { ...n, chapterId: localToDbChapter[n.chapterId] ?? n.chapterId };
    if (n.op === "chose")
      return { ...n, choiceId: localToDbChoice[n.choiceId] ?? n.choiceId };
    return n;
  };
  const remapEffects = (effs: any[]): any[] =>
    effs.map((e) =>
      e?.op === "unlockEnding" ? { ...e, chapterId: localToDbChapter[e.chapterId] ?? e.chapterId } : e,
    );

  // Insert choices in two passes so `chose` conditions can reference other
  // choice ids after we know them. First pass: insert without show_condition;
  // second pass: patch show_condition.
  if (data.choices.length > 0) {
    const insertRows = data.choices
      .filter((ch) => localToDbChapter[ch.fromLocalId])
      .map((ch) => ({
        from_chapter_id: localToDbChapter[ch.fromLocalId],
        target_chapter_id: ch.targetLocalId ? localToDbChapter[ch.targetLocalId] ?? null : null,
        label: ch.label,
        order: ch.order,
        show_condition: null,
        effects: remapEffects((ch.effects as any[]) ?? []),
      }));
    const { data: chRows, error } = await supabase
      .from("choices")
      .insert(insertRows)
      .select("id, from_chapter_id, label, order");
    if (error) return { error: error.message };

    const key = (from: string, label: string, order: number) =>
      `${from}::${label}::${order}`;
    const byKey = new Map<string, string>();
    for (const r of chRows ?? []) byKey.set(key(r.from_chapter_id, r.label, r.order), r.id);
    for (const ch of data.choices) {
      const from = localToDbChapter[ch.fromLocalId];
      if (!from) continue;
      const dbId = byKey.get(key(from, ch.label, ch.order));
      if (dbId) localToDbChoice[ch.localId] = dbId;
    }

    // Patch conditions with resolved choice ids.
    for (const ch of data.choices) {
      const dbId = localToDbChoice[ch.localId];
      if (!dbId || !ch.showCondition) continue;
      const remapped = remapCondition(ch.showCondition);
      await supabase.from("choices").update({ show_condition: remapped }).eq("id", dbId);
    }
  }

  // Chapter unlock_condition may reference choice ids — patch after choices exist.
  for (const c of data.chapters) {
    const dbId = localToDbChapter[c.localId];
    if (!dbId || !c.unlockCondition) continue;
    const remapped = remapCondition(c.unlockCondition);
    await supabase.from("chapters").update({ unlock_condition: remapped }).eq("id", dbId);
  }

  // Start chapter
  if (data.startLocalId && localToDbChapter[data.startLocalId]) {
    await supabase
      .from("stories")
      .update({ start_chapter_id: localToDbChapter[data.startLocalId] })
      .eq("id", storyId);
  }

  revalidatePath("/author");
  return { storyId };
}
