import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SlotsPanel, type SlotSummary } from "./SlotsPanel";
import { StoryExplorer } from "./StoryExplorer";

export const dynamic = "force-dynamic";

export default async function StoryLandingPage({
  params,
  searchParams,
}: {
  params: { slug: string };
  searchParams: { slot?: string };
}) {
  const supabase = createSupabaseServerClient();

  const { data: story } = await supabase
    .from("stories")
    .select(
      "id, slug, title, description, tags, warnings, content_rating, status, start_chapter_id",
    )
    .eq("slug", params.slug)
    .maybeSingle();

  if (!story) notFound();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Chapter graph (published only) — needed for the tree view and ToC titles.
  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, order, is_ending, ending_label, draft")
    .eq("story_id", story.id)
    .eq("draft", false)
    .order("order", { ascending: true });

  const chapterList = (chapters ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    isEnding: c.is_ending,
    endingLabel: c.ending_label,
  }));
  const endingChapters = chapterList.filter((c) => c.isEnding);

  const chapterIds = chapterList.map((c) => c.id);
  const { data: allChoices } = chapterIds.length
    ? await supabase
        .from("choices")
        .select("id, from_chapter_id, target_chapter_id, label")
        .in("from_chapter_id", chapterIds)
    : { data: [] };
  const edges = (allChoices ?? []).map((e) => ({
    id: e.id,
    from: e.from_chapter_id,
    to: e.target_chapter_id,
    label: e.label,
  }));

  // Per-user data.
  let slots: SlotSummary[] = [];
  let activeSlot = Math.max(0, Math.min(31, Number(searchParams.slot ?? 0) || 0));
  let visitedChapterIds: string[] = [];
  let discoveredEndings: string[] = [];
  let path: { seq: number; chapterId: string; choiceId: string | null }[] = [];

  if (user) {
    const [{ data: progressRows }, { data: endings }] = await Promise.all([
      supabase
        .from("reader_progress")
        .select("slot, slot_name, current_chapter_id, visited_chapter_ids, updated_at")
        .eq("user_id", user.id)
        .eq("story_id", story.id)
        .order("slot", { ascending: true }),
      supabase
        .from("discovered_endings")
        .select("chapter_id")
        .eq("user_id", user.id)
        .eq("story_id", story.id),
    ]);

    const chapterTitle = new Map(chapterList.map((c) => [c.id, c.title]));

    slots = (progressRows ?? []).map((p) => ({
      slot: p.slot,
      slotName: p.slot_name,
      currentChapterTitle: p.current_chapter_id
        ? chapterTitle.get(p.current_chapter_id) ?? null
        : null,
      updatedAt: p.updated_at,
    }));

    // If the requested activeSlot has no saved data but the user has any
    // slot, snap to the most recently updated one.
    if (!slots.some((s) => s.slot === activeSlot) && slots.length > 0) {
      activeSlot = slots.reduce(
        (best, s) => (new Date(s.updatedAt) > new Date(best.updatedAt) ? s : best),
        slots[0],
      ).slot;
    }

    const active = slots.find((s) => s.slot === activeSlot);
    if (active) {
      visitedChapterIds =
        (progressRows ?? []).find((p) => p.slot === activeSlot)?.visited_chapter_ids ?? [];
    }

    const { data: pathRows } = await supabase
      .from("reader_path")
      .select("seq, chapter_id, choice_id")
      .eq("user_id", user.id)
      .eq("story_id", story.id)
      .eq("slot", activeSlot)
      .order("seq", { ascending: true });
    path = (pathRows ?? []).map((r) => ({
      seq: r.seq,
      chapterId: r.chapter_id,
      choiceId: r.choice_id,
    }));

    discoveredEndings = (endings ?? []).map((e) => e.chapter_id);
  }

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/stories" className="text-sm text-parchment/60 hover:text-accent">
        ← All stories
      </Link>

      <div className="mt-4 grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <p className="text-xs uppercase tracking-widest text-parchment/50">
            {story.status} · {story.content_rating}
          </p>
          <h1 className="mt-1 font-serif text-5xl text-accent">{story.title}</h1>

          {story.description && (
            <p className="prose-vn mt-6 text-parchment/85">{story.description}</p>
          )}

          {story.warnings && story.warnings.length > 0 && (
            <p className="mt-4 rounded border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-100">
              Content warnings: {story.warnings.join(", ")}
            </p>
          )}

          {story.tags && story.tags.length > 0 && (
            <p className="mt-4 text-xs text-parchment/50">
              {story.tags.map((t: string) => `#${t}`).join("  ")}
            </p>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            {story.start_chapter_id ? (
              user ? (
                <Link
                  href={`/stories/${story.slug}/read?slot=${activeSlot}`}
                  className="rounded bg-accent px-5 py-2 font-medium text-ink hover:opacity-90"
                >
                  {slots.some((s) => s.slot === activeSlot)
                    ? "Resume current slot"
                    : "Begin"}
                </Link>
              ) : (
                <Link
                  href={`/login?next=${encodeURIComponent(`/stories/${story.slug}/read`)}`}
                  className="rounded bg-accent px-5 py-2 font-medium text-ink hover:opacity-90"
                >
                  Sign in to read
                </Link>
              )
            ) : (
              <p className="text-parchment/60">This story has no starting chapter yet.</p>
            )}
          </div>
        </div>

        {user && (
          <aside className="lg:pl-4">
            <SlotsPanel
              storySlug={story.slug}
              storyId={story.id}
              activeSlot={activeSlot}
              slots={slots}
            />
          </aside>
        )}
      </div>

      {user && story.start_chapter_id && (
        <section className="mt-12">
          <StoryExplorer
            storyId={story.id}
            storySlug={story.slug}
            startChapterId={story.start_chapter_id}
            chapters={chapterList}
            edges={edges}
            activeSlot={activeSlot}
            path={path}
            visitedChapterIds={visitedChapterIds}
            discoveredEndings={discoveredEndings}
            endingChapters={endingChapters}
          />
        </section>
      )}
    </main>
  );
}
