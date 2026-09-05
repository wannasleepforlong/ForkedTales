import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { GraphEditor } from "./GraphEditor";

export const dynamic = "force-dynamic";

export default async function GraphPage({ params }: { params: { id: string } }) {
  const { user, supabase } = await requireUser(`/author/stories/${params.id}/graph`);

  const { data: story } = await supabase
    .from("stories")
    .select("id, title, author_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!story || story.author_id !== user.id) notFound();

  const [{ data: chapters }, { data: choices }] = await Promise.all([
    supabase
      .from("chapters")
      .select("id, title, is_ending, draft, order, layout")
      .eq("story_id", story.id)
      .order("order", { ascending: true }),
    supabase
      .from("choices")
      .select("id, from_chapter_id, target_chapter_id, label")
      .in(
        "from_chapter_id",
        (
          await supabase.from("chapters").select("id").eq("story_id", story.id)
        ).data?.map((c) => c.id) ?? [],
      ),
  ]);

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col">
      <header className="flex items-center justify-between border-b border-white/10 px-6 py-3">
        <div>
          <Link
            href={`/author/stories/${story.id}`}
            className="text-xs text-parchment/60 hover:text-accent"
          >
            ← {story.title}
          </Link>
          <h1 className="font-serif text-2xl text-accent">Graph editor</h1>
        </div>
      </header>

      <div className="flex-1">
        <GraphEditor
          storyId={story.id}
          chapters={(chapters ?? []).map((c) => ({
            id: c.id,
            title: c.title,
            isEnding: c.is_ending,
            draft: c.draft,
            layout: (c.layout as { x: number; y: number } | null) ?? null,
          }))}
          choices={(choices ?? []).map((ch) => ({
            id: ch.id,
            from: ch.from_chapter_id,
            to: ch.target_chapter_id,
            label: ch.label,
          }))}
        />
      </div>
    </div>
  );
}
