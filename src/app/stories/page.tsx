import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function StoriesIndexPage() {
  const supabase = createSupabaseServerClient();
  const { data: stories } = await supabase
    .from("stories")
    .select("id, slug, title, description, tags, status, content_rating, cover_url")
    .neq("status", "draft")
    .order("published_at", { ascending: false })
    .limit(60);

  return (
    <main className="mx-auto max-w-6xl px-6 py-14">
      <div className="flex items-end justify-between">
        <div>
          <p className="label">The library</p>
          <h1 className="mt-2 font-serif text-5xl text-parchment">Stories</h1>
        </div>
      </div>
      <div className="divider mt-8" />

      {stories && stories.length > 0 ? (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {stories.map((s) => (
            <li key={s.id} className="animate-fade-in">
              <Link href={`/stories/${s.slug}`} className="card card-hover block h-full overflow-hidden">
                {s.cover_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.cover_url}
                    alt=""
                    className="h-40 w-full object-cover"
                  />
                )}
                <div className="p-5">
                <div className="flex items-center justify-between">
                  <span className="chip capitalize">{s.status}</span>
                  <span className="chip capitalize">{s.content_rating}</span>
                </div>
                <h2 className="mt-3 font-serif text-2xl text-parchment">
                  {s.title}
                </h2>
                {s.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-parchment/70">
                    {s.description}
                  </p>
                )}
                {s.tags && s.tags.length > 0 && (
                  <p className="mt-4 flex flex-wrap gap-1.5">
                    {s.tags.slice(0, 5).map((t: string) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </p>
                )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-16 rounded-xl border border-white/10 bg-white/[0.02] p-10 text-center">
          <p className="font-serif text-2xl text-parchment/80">
            The shelves are empty — for now.
          </p>
          <p className="mt-2 text-parchment/60">
            Be the first to publish.
          </p>
          <Link href="/author" className="btn-primary mt-6">
            Start writing
          </Link>
        </div>
      )}
    </main>
  );
}
