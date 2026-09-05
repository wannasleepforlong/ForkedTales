import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function SiteHeader() {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let handle: string | null = null;
  if (user) {
    const { data } = await supabase
      .from("profiles")
      .select("handle")
      .eq("id", user.id)
      .maybeSingle();
    handle = data?.handle ?? user.email ?? null;
  }

  return (
    <header className="sticky top-0 z-40 glass">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="group flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-accent/15 font-serif text-lg text-accent ring-1 ring-accent/40 transition group-hover:bg-accent/25">
            ⟀
          </span>
          <span className="font-serif text-2xl leading-none text-parchment transition group-hover:text-accent">
            ForkedTales
          </span>
        </Link>
        <nav className="flex items-center gap-5 text-sm">
          <Link href="/stories" className="text-parchment/80 transition hover:text-accent">
            Stories
          </Link>
          {user ? (
            <>
              <Link href="/author" className="text-parchment/80 transition hover:text-accent">
                Author
              </Link>
              <span className="hidden sm:inline chip">@{handle}</span>
              <form action="/auth/signout" method="post">
                <button className="text-parchment/60 transition hover:text-parchment">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="btn-ghost !py-1.5">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
