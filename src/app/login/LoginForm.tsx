"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { signInAction, signUpAction } from "./actions";

export function LoginForm({
  defaultMode,
  next,
  error,
}: {
  defaultMode: "signin" | "signup";
  next?: string;
  error?: string;
}) {
  const [mode, setMode] = useState<"signin" | "signup">(defaultMode);
  const [message, setMessage] = useState<string | null>(error ?? null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  function submit(formData: FormData) {
    setMessage(null);
    startTransition(async () => {
      const action = mode === "signin" ? signInAction : signUpAction;
      const result = await action(formData);
      if (result?.error) return setMessage(result.error);
      if (result?.notice) return setMessage(result.notice);
      router.push(next || "/");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="mt-6 space-y-4">
      {mode === "signup" && (
        <label className="block text-sm">
          <span className="label">Handle</span>
          <input
            name="handle"
            required
            minLength={3}
            maxLength={24}
            pattern="[a-zA-Z0-9_]+"
            className="mt-1 w-full"
            placeholder="mira_ink"
          />
        </label>
      )}
      <label className="block text-sm">
        <span className="label">Email</span>
        <input type="email" name="email" required className="mt-1 w-full" />
      </label>
      <label className="block text-sm">
        <span className="label">Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          className="mt-1 w-full"
        />
      </label>

      {message && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {message}
        </p>
      )}

      <button disabled={pending} className="btn-primary w-full">
        {pending ? "…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
        className="w-full text-center text-sm text-parchment/60 transition hover:text-parchment"
      >
        {mode === "signin"
          ? "No account yet? Create one →"
          : "Already registered? Sign in →"}
      </button>
    </form>
  );
}
