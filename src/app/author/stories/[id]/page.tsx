import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { StoryMetaForm } from "./StoryMetaForm";
import { DeleteStoryButton } from "./DeleteStoryButton";
import { FlagsPanel, type FlagRow } from "./FlagsPanel";

export const dynamic = "force-dynamic";

export default async function StoryEditPage({
  params,
}: {
  params: { id: string };
}) {
  const { user, supabase } = await requireUser(`/author/stories/${params.id}`);

  const { data: story } = await supabase
    .from("stories")
    .select(
      "id, slug, title, description, tags, content_rating, status, start_chapter_id, author_id, cover_url",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!story || story.author_id !== user.id) notFound();

  const [{ data: chapters }, { data: flagRows }] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, title, order, draft, is_ending")
      .eq("story_id", story.id)
      .order("order", { ascending: true }),
    supabase
      .from("flag_defs")
      .select("id, key, kind, default_value, description, enum_values")
      .eq("story_id", story.id)
      .order("key", { ascending: true }),
  ]);

  const flags: FlagRow[] = (flagRows ?? []).map((f) => ({
    id: f.id,
    key: f.key,
    kind: f.kind,
    defaultValue: f.default_value,
    description: f.description,
    enumValues: f.enum_values,
  }));

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/author" className="text-sm text-parchment/60 hover:text-accent">
            ← All stories
          </Link>
          <h1 className="mt-1 font-serif text-4xl text-accent">{story.title}</h1>
          <p className="text-xs text-parchment/50">/{story.slug}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={`/author/stories/${story.id}/graph`} className="btn-ghost">
            Graph editor
          </Link>
          <Link href={`/author/stories/${story.id}/analytics`} className="btn-ghost">
            Analytics
          </Link>
          <Link href={`/author/stories/${story.id}/tools`} className="btn-ghost">
            Import / Export
          </Link>
          <Link href={`/stories/${story.slug}`} className="btn-ghost">
            Preview →
          </Link>
        </div>
      </div>

      <section className="mt-10">
        <h2 className="font-serif text-2xl text-parchment/85">Details</h2>
        <div className="mt-3">
          <StoryMetaForm
            story={{
              id: story.id,
              title: story.title,
              description: story.description,
              tags: story.tags,
              contentRating: story.content_rating,
              status: story.status,
              startChapterId: story.start_chapter_id,
              coverUrl: story.cover_url,
            }}
            chapters={(chapters ?? []).map((c) => ({ id: c.id, title: c.title }))}
          />
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-serif text-2xl text-parchment/85">Flags</h2>
        <p className="text-xs text-parchment/50">
          Declared flags autocomplete inside the condition and effect
          builders — and the linter warns about references to keys not
          declared here.
        </p>
        <div className="mt-3">
          <FlagsPanel storyId={story.id} flags={flags} />
        </div>
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-2xl text-parchment/85">Chapters</h2>
          <Link
            href={`/author/stories/${story.id}/chapters/new`}
            className="btn-ghost"
          >
            + Chapter
          </Link>
        </div>
        {chapters && chapters.length > 0 ? (
          <ul className="mt-4 grid gap-2">
            {chapters.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/author/stories/${story.id}/chapters/${c.id}`}
                  className="card card-hover flex items-center justify-between px-4 py-3"
                >
                  <div>
                    <p className="font-serif text-lg text-parchment">{c.title}</p>
                    <p className="text-xs text-parchment/50">
                      order {c.order} · {c.draft ? "draft" : "published"}
                      {c.is_ending ? " · ending" : ""}
                    </p>
                  </div>
                  <span className="text-sm text-accent">Edit →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-parchment/60">
            No chapters yet. Add one to start writing.
          </p>
        )}
      </section>

      <section className="mt-16">
        <h2 className="font-serif text-xl text-red-300/80">Danger zone</h2>
        <DeleteStoryButton storyId={story.id} title={story.title} />
      </section>
    </main>
  );
}
