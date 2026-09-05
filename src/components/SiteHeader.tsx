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
    <header className="border-b border-parchment/10">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-serif text-2xl text-accent">
          ForkedTales
        </Link>
        <nav className="flex items-center gap-6 text-sm">
          <Link href="/stories" className="hover:text-accent">
            Stories
          </Link>
          {user ? (
            <>
              <Link href="/author" className="hover:text-accent">
                Author
              </Link>
              <span className="text-parchment/60">@{handle}</span>
              <form action="/auth/signout" method="post">
                <button className="text-parchment/70 hover:text-parchment">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="hover:text-accent">
              Sign in
            </Link>
          )}
        </nav>
      </div>
    </header>
  );
}
