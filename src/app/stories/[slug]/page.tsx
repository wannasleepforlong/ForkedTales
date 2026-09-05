import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StoryLandingPage({
  params,
}: {
  params: { slug: string };
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

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/stories" className="text-sm text-parchment/60 hover:text-accent">
        ← All stories
      </Link>
      <h1 className="mt-2 font-serif text-5xl text-accent">{story.title}</h1>
      <p className="mt-2 text-xs uppercase tracking-wider text-parchment/50">
        {story.status} · {story.content_rating}
      </p>

      {story.description && (
        <p className="prose-vn mt-6 text-parchment/80">{story.description}</p>
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

      <div className="mt-10">
        {story.start_chapter_id ? (
          <Link
            href={`/stories/${story.slug}/read`}
            className="rounded bg-accent px-5 py-2 font-medium text-ink hover:opacity-90"
          >
            Read from the beginning
          </Link>
        ) : (
          <p className="text-parchment/60">
            This story has no starting chapter yet.
          </p>
        )}
      </div>
    </main>
  );
}
