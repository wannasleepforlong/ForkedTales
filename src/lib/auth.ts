import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function requireUser(nextPath?: string) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const params = nextPath ? `?next=${encodeURIComponent(nextPath)}` : "";
    redirect(`/login${params}`);
  }
  return { user, supabase };
}
