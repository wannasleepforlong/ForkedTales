"use server";

import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const credsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const signUpSchema = credsSchema.extend({
  handle: z
    .string()
    .min(3)
    .max(24)
    .regex(/^[a-zA-Z0-9_]+$/, "Handles can only contain letters, digits, and _"),
});

export async function signInAction(
  formData: FormData,
): Promise<{ error?: string; notice?: string } | void> {
  const parsed = credsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Enter a valid email and password." };

  const supabase = createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: error.message };
}

export async function signUpAction(
  formData: FormData,
): Promise<{ error?: string; notice?: string } | void> {
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  }

  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { handle: parsed.data.handle, display_name: parsed.data.handle },
    },
  });

  if (error) return { error: error.message };
  if (!data.session) {
    return {
      notice:
        "Account created. Check your inbox for a confirmation link, then come back to sign in.",
    };
  }
}
