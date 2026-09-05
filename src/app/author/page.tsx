import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { NewStoryForm } from "./NewStoryForm";

export const dynamic = "force-dynamic";

export default async function AuthorDashboardPage() {
  const { user, supabase } = await requireUser("/author");
  const { data: stories } = await supabase
    .from("stories")
    .select("id, slug, title, status, updated_at")
    .eq("author_id", user.id)
    .order("updated_at", { ascending: false });

  return (
    <main className="mx-auto max-w-5xl px-6 py-14">
      <div className="flex items-end justify-between">
        <div>
          <p className="label">Your workshop</p>
          <h1 className="mt-2 font-serif text-5xl text-parchment">Stories</h1>
        </div>
      </div>
      <div className="divider mt-8" />

      <section className="mt-8">
        <NewStoryForm />
      </section>

      <section className="mt-12">
        {stories && stories.length > 0 ? (
          <ul className="grid gap-3">
            {stories.map((s) => (
              <li key={s.id}>
                <Link
                  href={`/author/stories/${s.id}`}
                  className="card card-hover flex items-center justify-between px-5 py-4"
                >
                  <div>
                    <p className="font-serif text-xl text-parchment">{s.title}</p>
                    <p className="mt-1 text-xs text-parchment/50">
                      /{s.slug} · <span className="capitalize">{s.status}</span> ·
                      updated {new Date(s.updated_at).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm text-accent">Open →</span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-parchment/60">No stories yet. Start one above.</p>
        )}
      </section>
    </main>
  );
}
