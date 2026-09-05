import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AnalyticsPage({ params }: { params: { id: string } }) {
  const { user, supabase } = await requireUser(`/author/stories/${params.id}/analytics`);

  const { data: story } = await supabase
    .from("stories")
    .select("id, title, author_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!story || story.author_id !== user.id) notFound();

  const [{ data: chapters }, { data: choices }, { data: events }, { data: endings }] =
    await Promise.all([
      supabase.from("chapters").select("id, title, is_ending, ending_label").eq("story_id", story.id),
      supabase
        .from("choices")
        .select("id, from_chapter_id, label")
        .in(
          "from_chapter_id",
          (
            await supabase.from("chapters").select("id").eq("story_id", story.id)
          ).data?.map((c) => c.id) ?? [],
        ),
      supabase.from("events").select("type, payload, user_id").eq("story_id", story.id).limit(50000),
      supabase.from("discovered_endings").select("user_id, chapter_id").eq("story_id", story.id),
    ]);

  const chapterTitle = new Map((chapters ?? []).map((c) => [c.id, c.title]));
  const choicesByChapter: Record<string, { id: string; label: string }[]> = {};
  const choiceMeta = new Map<string, { fromChapterId: string; label: string }>();
  for (const ch of choices ?? []) {
    (choicesByChapter[ch.from_chapter_id] ||= []).push({ id: ch.id, label: ch.label });
    choiceMeta.set(ch.id, { fromChapterId: ch.from_chapter_id, label: ch.label });
  }

  const chapterEnters: Record<string, number> = {};
  const choicePicks: Record<string, number> = {};
  const readers = new Set<string>();
  for (const ev of events ?? []) {
    if (ev.user_id) readers.add(ev.user_id as string);
    if (ev.type === "chapter_entered") {
      const id = (ev.payload as any)?.chapterId as string | undefined;
      if (id) chapterEnters[id] = (chapterEnters[id] ?? 0) + 1;
    } else if (ev.type === "choice_picked") {
      const id = (ev.payload as any)?.choiceId as string | undefined;
      if (id) choicePicks[id] = (choicePicks[id] ?? 0) + 1;
    }
  }

  const endingReaches: Record<string, Set<string>> = {};
  for (const e of endings ?? []) {
    (endingReaches[e.chapter_id] ||= new Set()).add(e.user_id);
  }

  const totalReaders = readers.size;

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link
        href={`/author/stories/${story.id}`}
        className="text-sm text-parchment/60 hover:text-accent"
      >
        ← {story.title}
      </Link>
      <h1 className="mt-2 font-serif text-4xl text-accent">Analytics</h1>
      <p className="mt-1 text-sm text-parchment/70">
        Based on reader activity logged into the events stream since the story
        was first read.
      </p>

      <section className="mt-6 grid gap-3 sm:grid-cols-3">
        <Stat label="Unique readers" value={String(totalReaders)} />
        <Stat
          label="Chapter enters"
          value={String(Object.values(chapterEnters).reduce((a, b) => a + b, 0))}
        />
        <Stat
          label="Choices picked"
          value={String(Object.values(choicePicks).reduce((a, b) => a + b, 0))}
        />
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-parchment/85">Choices</h2>
        <p className="text-xs text-parchment/50">
          Pick counts per option, grouped by chapter. Percentages are of the
          chapter&rsquo;s picks so an author can see which branches readers actually take.
        </p>
        <div className="mt-4 space-y-6">
          {(chapters ?? []).map((c) => {
            const list = choicesByChapter[c.id] ?? [];
            if (list.length === 0) return null;
            const totals = list.reduce((sum, ch) => sum + (choicePicks[ch.id] ?? 0), 0);
            return (
              <div key={c.id} className="card p-4">
                <p className="font-serif text-lg text-parchment">{c.title}</p>
                <ul className="mt-2 space-y-1.5">
                  {list.map((ch) => {
                    const n = choicePicks[ch.id] ?? 0;
                    const pct = totals ? Math.round((n / totals) * 100) : 0;
                    return (
                      <li key={ch.id}>
                        <div className="flex items-center justify-between text-sm">
                          <span>{ch.label}</span>
                          <span className="text-parchment/60">
                            {n} · {pct}%
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded bg-white/[0.04]">
                          <div
                            className="h-full bg-accent/70"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-parchment/85">Endings</h2>
        <ul className="mt-4 grid gap-2">
          {(chapters ?? [])
            .filter((c) => c.is_ending)
            .map((c) => {
              const reached = endingReaches[c.id]?.size ?? 0;
              const rate = totalReaders
                ? Math.round((reached / totalReaders) * 100)
                : 0;
              return (
                <li key={c.id} className="card flex items-center justify-between p-4">
                  <span className="font-serif text-parchment">
                    {c.ending_label ?? c.title}
                  </span>
                  <span className="text-sm text-parchment/60">
                    {reached} reader{reached === 1 ? "" : "s"} · {rate}%
                  </span>
                </li>
              );
            })}
        </ul>
      </section>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-parchment/85">Chapter traffic</h2>
        <ul className="mt-4 grid gap-1.5">
          {(chapters ?? [])
            .slice()
            .sort((a, b) => (chapterEnters[b.id] ?? 0) - (chapterEnters[a.id] ?? 0))
            .map((c) => (
              <li key={c.id} className="flex items-center justify-between text-sm">
                <span>{chapterTitle.get(c.id) ?? "?"}</span>
                <span className="text-parchment/60">{chapterEnters[c.id] ?? 0}</span>
              </li>
            ))}
        </ul>
      </section>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card p-4">
      <p className="label">{label}</p>
      <p className="mt-1 font-serif text-3xl text-accent">{value}</p>
    </div>
  );
}
