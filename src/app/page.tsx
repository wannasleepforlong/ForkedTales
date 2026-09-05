import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createSupabaseServerClient();
  const { data: featured } = await supabase
    .from("stories")
    .select("id, slug, title, description, tags, content_rating")
    .neq("status", "draft")
    .order("published_at", { ascending: false })
    .limit(3);

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-hero-glow" />
        <div className="relative mx-auto grid max-w-6xl gap-10 px-6 py-24 lg:grid-cols-[3fr_2fr] lg:py-32">
          <div className="animate-fade-in">
            <p className="label">Interactive · Branching · Yours</p>
            <h1 className="mt-4 font-serif text-6xl leading-[1.05] tracking-tight text-parchment sm:text-7xl">
              Stories that <span className="text-accent italic">fork</span>{" "}
              with you.
            </h1>
            <p className="mt-6 max-w-lg text-lg text-parchment/75">
              Read visual novels where every choice bends the path — or write
              your own, wire the branches, and let readers discover the
              endings you hid between them.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-3">
              <Link href="/stories" className="btn-primary">
                Browse stories →
              </Link>
              <Link href="/author" className="btn-ghost">
                Start writing
              </Link>
            </div>

            <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 text-sm">
              <Stat label="Branching engine" value="Conditions + flags" />
              <Stat label="Save slots" value="Fork any moment" />
              <Stat label="Reader map" value="Spoiler-safe" />
            </dl>
          </div>

          <div className="relative animate-fade-in-slow">
            <div className="card p-6 shadow-glow">
              <p className="label">Chapter 04 · The Lighthouse</p>
              <p className="prose-vn mt-3">
                <span className="text-accent">Elena:</span> &ldquo;If you walk
                through that door, I&rsquo;m not following.&rdquo;
              </p>
              <p className="mt-2 text-sm italic text-parchment/70">
                The wind pulled at the shutters. You had, at most, a heartbeat
                to decide.
              </p>
              <div className="mt-5 grid gap-2 text-sm">
                <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 hover:border-accent hover:bg-accent/5 transition">
                  → Walk through the door
                </div>
                <div className="rounded-md border border-white/10 bg-white/[0.02] px-3 py-2 hover:border-accent hover:bg-accent/5 transition">
                  → Stay with Elena
                </div>
                <div className="rounded-md border border-white/5 bg-white/[0.01] px-3 py-2 text-parchment/40 line-through">
                  ??? (locked — trust ≥ 3)
                </div>
              </div>
            </div>
            <div className="pointer-events-none absolute -bottom-6 -right-6 -z-10 h-40 w-40 rounded-full bg-accent/20 blur-3xl" />
          </div>
        </div>
      </section>

      {/* Featured */}
      {featured && featured.length > 0 && (
        <section className="mx-auto max-w-6xl px-6 pb-24">
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="font-serif text-3xl text-parchment">Recently published</h2>
            <Link href="/stories" className="text-sm text-accent hover:underline">
              See all →
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((s) => (
              <Link key={s.id} href={`/stories/${s.slug}`} className="card card-hover p-5">
                <p className="label">{s.content_rating}</p>
                <h3 className="mt-2 font-serif text-2xl text-parchment">
                  {s.title}
                </h3>
                {s.description && (
                  <p className="mt-2 line-clamp-3 text-sm text-parchment/70">
                    {s.description}
                  </p>
                )}
                {s.tags && s.tags.length > 0 && (
                  <p className="mt-3 flex flex-wrap gap-1.5">
                    {s.tags.slice(0, 4).map((t: string) => (
                      <span key={t} className="chip">
                        {t}
                      </span>
                    ))}
                  </p>
                )}
              </Link>
            ))}
          </div>
        </section>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="label">{label}</dt>
      <dd className="mt-1 font-serif text-lg text-parchment">{value}</dd>
    </div>
  );
}
