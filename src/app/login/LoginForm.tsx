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
      if (result?.error) {
        setMessage(result.error);
        return;
      }
      if (result?.notice) {
        setMessage(result.notice);
        return;
      }
      router.push(next || "/");
      router.refresh();
    });
  }

  return (
    <form action={submit} className="mt-8 space-y-4">
      {mode === "signup" && (
        <label className="block text-sm">
          <span className="text-parchment/80">Handle</span>
          <input
            name="handle"
            required
            minLength={3}
            maxLength={24}
            pattern="[a-zA-Z0-9_]+"
            className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
          />
        </label>
      )}
      <label className="block text-sm">
        <span className="text-parchment/80">Email</span>
        <input
          type="email"
          name="email"
          required
          className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
        />
      </label>
      <label className="block text-sm">
        <span className="text-parchment/80">Password</span>
        <input
          type="password"
          name="password"
          required
          minLength={6}
          className="mt-1 w-full rounded border border-parchment/30 bg-transparent px-3 py-2"
        />
      </label>

      {message && (
        <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          {message}
        </p>
      )}

      <button
        disabled={pending}
        className="w-full rounded bg-accent px-4 py-2 font-medium text-ink hover:opacity-90 disabled:opacity-60"
      >
        {pending ? "…" : mode === "signin" ? "Sign in" : "Create account"}
      </button>

      <button
        type="button"
        onClick={() => setMode((m) => (m === "signin" ? "signup" : "signin"))}
        className="w-full text-sm text-parchment/70 hover:text-parchment"
      >
        {mode === "signin"
          ? "No account yet? Create one."
          : "Already registered? Sign in."}
      </button>
    </form>
  );
}
