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
    <main className="mx-auto max-w-4xl px-6 py-12">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-4xl text-accent">Your stories</h1>
      </div>

      <section className="mt-8">
        <NewStoryForm />
      </section>

      <section className="mt-12">
        {stories && stories.length > 0 ? (
          <ul className="divide-y divide-parchment/10 rounded border border-parchment/10">
            {stories.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-4 py-3">
                <div>
                  <Link
                    href={`/author/stories/${s.id}`}
                    className="font-medium hover:text-accent"
                  >
                    {s.title}
                  </Link>
                  <p className="text-xs text-parchment/50">
                    /{s.slug} · {s.status} · updated{" "}
                    {new Date(s.updated_at).toLocaleString()}
                  </p>
                </div>
                <Link
                  href={`/author/stories/${s.id}`}
                  className="text-sm text-parchment/70 hover:text-accent"
                >
                  Edit →
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-parchment/60">
            No stories yet. Start one above.
          </p>
        )}
      </section>
    </main>
  );
}
