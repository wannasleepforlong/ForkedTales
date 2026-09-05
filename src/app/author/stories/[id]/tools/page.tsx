import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { ImportExportPanel } from "./ImportExportPanel";

export const dynamic = "force-dynamic";

export default async function ToolsPage({ params }: { params: { id: string } }) {
  const { user, supabase } = await requireUser(`/author/stories/${params.id}/tools`);
  const { data: story } = await supabase
    .from("stories")
    .select("id, title, author_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!story || story.author_id !== user.id) notFound();

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <Link href={`/author/stories/${story.id}`} className="text-sm text-parchment/60 hover:text-accent">
        ← {story.title}
      </Link>
      <h1 className="mt-2 font-serif text-4xl text-accent">Import / Export</h1>
      <p className="mt-2 text-sm text-parchment/70">
        Download a portable JSON of this story, or paste an export from
        another ForkedTales project to seed a fresh draft.
      </p>
      <div className="mt-8">
        <ImportExportPanel storyId={story.id} storyTitle={story.title} />
      </div>
    </main>
  );
}
