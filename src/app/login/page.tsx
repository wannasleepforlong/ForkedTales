import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string; error?: string; mode?: string };
}) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect(searchParams.next || "/");

  return (
    <main className="mx-auto max-w-md px-6 py-20">
      <div className="card p-8">
        <p className="label">Welcome back</p>
        <h1 className="mt-2 font-serif text-4xl text-accent">Sign in</h1>
        <p className="mt-2 text-parchment/70">
          Bring your reader progress and your drafts with you.
        </p>
        <LoginForm
          defaultMode={searchParams.mode === "signup" ? "signup" : "signin"}
          next={searchParams.next}
          error={searchParams.error}
        />
      </div>
    </main>
  );
}
