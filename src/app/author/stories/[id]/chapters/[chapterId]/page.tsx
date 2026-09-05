import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { ConditionNode, Effect } from "@/lib/types";
import { ChapterMetaForm } from "./ChapterMetaForm";
import { BlocksEditor } from "./BlocksEditor";
import { DeleteChapterButton } from "./DeleteChapterButton";
import { ChoicesEditor } from "./ChoicesEditor";
import { UnlockEditor } from "./UnlockEditor";

export const dynamic = "force-dynamic";

export default async function ChapterEditPage({
  params,
}: {
  params: { id: string; chapterId: string };
}) {
  const { user, supabase } = await requireUser(
    `/author/stories/${params.id}/chapters/${params.chapterId}`,
  );

  const { data: story } = await supabase
    .from("stories")
    .select("id, title, author_id, slug")
    .eq("id", params.id)
    .maybeSingle();

  if (!story || story.author_id !== user.id) notFound();

  const { data: chapter } = await supabase
    .from("chapters")
    .select("id, story_id, title, order, draft, is_ending, ending_label, unlock_condition")
    .eq("id", params.chapterId)
    .maybeSingle();

  if (!chapter || chapter.story_id !== story.id) notFound();

  const [{ data: blocks }, { data: choices }, { data: siblings }, { data: flagDefs }] =
    await Promise.all([
      supabase
        .from("blocks")
        .select("id, type, data, order")
        .eq("chapter_id", chapter.id)
        .order("order", { ascending: true }),
      supabase
        .from("choices")
        .select("id, label, target_chapter_id, order, show_condition, effects")
        .eq("from_chapter_id", chapter.id)
        .order("order", { ascending: true }),
      supabase
        .from("chapters")
        .select("id, title")
        .eq("story_id", story.id)
        .order("order", { ascending: true }),
      supabase
        .from("flag_defs")
        .select("key")
        .eq("story_id", story.id),
    ]);

  const siblingChapters = (siblings ?? []).map((c) => ({ id: c.id, title: c.title }));
  const flagKeys = (flagDefs ?? []).map((f) => f.key);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href={`/author/stories/${story.id}`}
        className="text-sm text-parchment/60 hover:text-accent"
      >
        ← {story.title}
      </Link>
      <h1 className="mt-1 font-serif text-4xl text-accent">{chapter.title}</h1>

      <section className="mt-8">
        <h2 className="font-serif text-xl text-parchment/80">Chapter details</h2>
        <ChapterMetaForm
          chapter={{
            id: chapter.id,
            storyId: story.id,
            title: chapter.title,
            order: chapter.order,
            draft: chapter.draft,
            isEnding: chapter.is_ending,
            endingLabel: chapter.ending_label,
          }}
        />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl text-parchment/80">Unlock condition</h2>
        <p className="text-xs text-parchment/50">
          Blank means anyone who reaches this chapter via a choice enters
          freely. Add a condition to gate it (e.g. flag route == &quot;betrayal&quot;).
        </p>
        <UnlockEditor
          chapterId={chapter.id}
          storyId={story.id}
          siblingChapters={siblingChapters}
          flagKeys={flagKeys}
          initial={(chapter.unlock_condition as ConditionNode | null) ?? null}
        />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl text-parchment/80">Content</h2>
        <BlocksEditor
          chapterId={chapter.id}
          storyId={story.id}
          initialBlocks={(blocks ?? []).map((b) => ({
            type: b.type,
            data: (b.data as Record<string, unknown>) ?? {},
          }))}
        />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-xl text-parchment/80">Choices</h2>
        <ChoicesEditor
          chapterId={chapter.id}
          storyId={story.id}
          siblingChapters={siblingChapters}
          flagKeys={flagKeys}
          initial={(choices ?? []).map((c) => ({
            label: c.label,
            targetChapterId: c.target_chapter_id,
            order: c.order,
            showCondition: (c.show_condition as ConditionNode | null) ?? null,
            effects: ((c.effects as Effect[] | null) ?? []) as Effect[],
          }))}
        />
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-xl text-red-300/80">Danger zone</h2>
        <DeleteChapterButton
          chapterId={chapter.id}
          storyId={story.id}
          title={chapter.title}
        />
      </section>
    </main>
  );
}
