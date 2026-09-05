import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <h1 className="font-serif text-5xl text-accent">ForkedTales</h1>
      <p className="mt-4 text-lg text-parchment/80">
        A home for branching visual-novel stories. Read them, or write your own.
      </p>
      <div className="mt-10 flex gap-4">
        <Link
          href="/stories"
          className="rounded border border-accent px-4 py-2 text-accent hover:bg-accent hover:text-ink"
        >
          Browse stories
        </Link>
        <Link
          href="/author"
          className="rounded border border-parchment/40 px-4 py-2 hover:border-parchment"
        >
          Author dashboard
        </Link>
      </div>
    </main>
  );
}
