import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { StoryMetaForm } from "./StoryMetaForm";
import { DeleteStoryButton } from "./DeleteStoryButton";

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
      "id, slug, title, description, tags, content_rating, status, start_chapter_id, author_id",
    )
    .eq("id", params.id)
    .maybeSingle();

  if (!story || story.author_id !== user.id) notFound();

  const { data: chapters } = await supabase
    .from("chapters")
    .select("id, title, order, draft, is_ending")
    .eq("story_id", story.id)
    .order("order", { ascending: true });

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/author" className="text-sm text-parchment/60 hover:text-accent">
            ← All stories
          </Link>
          <h1 className="mt-1 font-serif text-3xl text-accent">
            {story.title}
          </h1>
          <p className="text-xs text-parchment/50">/{story.slug}</p>
        </div>
        <Link
          href={`/stories/${story.slug}`}
          className="text-sm text-parchment/70 hover:text-accent"
        >
          Preview →
        </Link>
      </div>

      <section className="mt-8">
        <h2 className="font-serif text-xl text-parchment/80">Details</h2>
        <StoryMetaForm
          story={{
            id: story.id,
            title: story.title,
            description: story.description,
            tags: story.tags,
            contentRating: story.content_rating,
            status: story.status,
            startChapterId: story.start_chapter_id,
          }}
          chapters={(chapters ?? []).map((c) => ({ id: c.id, title: c.title }))}
        />
      </section>

      <section className="mt-12">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl text-parchment/80">Chapters</h2>
          <Link
            href={`/author/stories/${story.id}/chapters/new`}
            className="rounded border border-accent px-3 py-1 text-sm text-accent hover:bg-accent hover:text-ink"
          >
            + Chapter
          </Link>
        </div>
        {chapters && chapters.length > 0 ? (
          <ul className="mt-4 divide-y divide-parchment/10 rounded border border-parchment/10">
            {chapters.map((c) => (
              <li key={c.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <Link
                    href={`/author/stories/${story.id}/chapters/${c.id}`}
                    className="font-medium hover:text-accent"
                  >
                    {c.title}
                  </Link>
                  <p className="text-xs text-parchment/50">
                    order {c.order} · {c.draft ? "draft" : "published"}
                    {c.is_ending ? " · ending" : ""}
                  </p>
                </div>
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
