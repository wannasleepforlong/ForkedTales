import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StoriesIndexPage() {
  const supabase = createSupabaseServerClient();
  const { data: stories } = await supabase
    .from("stories")
    .select("id, slug, title, description, tags, status, content_rating")
    .neq("status", "draft")
    .order("published_at", { ascending: false })
    .limit(50);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <h1 className="font-serif text-4xl text-accent">Stories</h1>
      <p className="mt-2 text-parchment/70">Pick one to begin.</p>

      {stories && stories.length > 0 ? (
        <ul className="mt-8 grid gap-4 sm:grid-cols-2">
          {stories.map((s) => (
            <li
              key={s.id}
              className="rounded border border-parchment/10 p-4 hover:border-accent"
            >
              <Link href={`/stories/${s.slug}`} className="block">
                <h2 className="font-serif text-2xl text-parchment group-hover:text-accent">
                  {s.title}
                </h2>
                <p className="mt-1 text-xs uppercase tracking-wider text-parchment/50">
                  {s.status} · {s.content_rating}
                </p>
                {s.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-parchment/70">
                    {s.description}
                  </p>
                )}
                {s.tags && s.tags.length > 0 && (
                  <p className="mt-3 text-xs text-parchment/50">
                    {s.tags.join(" · ")}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-8 text-parchment/60">
          No published stories yet. Be the first — head to{" "}
          <Link href="/author" className="underline hover:text-accent">
            the author dashboard
          </Link>
          .
        </p>
      )}
    </main>
  );
}
