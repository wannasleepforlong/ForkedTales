import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { ConditionNode } from "@/lib/types";
import { AchievementsEditor } from "./AchievementsEditor";

export const dynamic = "force-dynamic";

export default async function AchievementsPage({ params }: { params: { id: string } }) {
  const { user, supabase } = await requireUser(
    `/author/stories/${params.id}/achievements`,
  );

  const { data: story } = await supabase
    .from("stories").select("id, title, author_id").eq("id", params.id).maybeSingle();
  if (!story || story.author_id !== user.id) notFound();

  const [{ data: rows }, { data: chapters }, { data: flagDefs }] = await Promise.all([
    supabase
      .from("achievements")
      .select("id, slug, title, description, icon, unlock_condition")
      .eq("story_id", story.id)
      .order("slug", { ascending: true }),
    supabase
      .from("chapters")
      .select("id, title")
      .eq("story_id", story.id)
      .order("order", { ascending: true }),
    supabase.from("flag_defs").select("key").eq("story_id", story.id),
  ]);

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <Link
        href={`/author/stories/${story.id}`}
        className="text-sm text-parchment/60 hover:text-accent"
      >
        ← {story.title}
      </Link>
      <h1 className="mt-2 font-serif text-4xl text-accent">Achievements</h1>
      <p className="mt-2 text-sm text-parchment/70">
        Readers unlock these automatically once their state satisfies the
        condition. Use the same builder as chapters and choices.
      </p>

      <div className="mt-8">
        <AchievementsEditor
          storyId={story.id}
          chapters={(chapters ?? []).map((c) => ({ id: c.id, title: c.title }))}
          flagKeys={(flagDefs ?? []).map((f) => f.key)}
          initial={(rows ?? []).map((r) => ({
            id: r.id,
            slug: r.slug,
            title: r.title,
            description: r.description ?? "",
            icon: r.icon ?? "",
            unlockCondition: (r.unlock_condition as ConditionNode | null) ?? null,
          }))}
        />
      </div>
    </main>
  );
}
