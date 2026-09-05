import { requireUser } from "@/lib/auth";
import { NewChapterForm } from "./NewChapterForm";

export const dynamic = "force-dynamic";

export default async function NewChapterPage({
  params,
}: {
  params: { id: string };
}) {
  await requireUser(`/author/stories/${params.id}/chapters/new`);

  return (
    <main className="mx-auto max-w-xl px-6 py-16">
      <h1 className="font-serif text-3xl text-accent">New chapter</h1>
      <NewChapterForm storyId={params.id} />
    </main>
  );
}
