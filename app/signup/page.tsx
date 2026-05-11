"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GameTheme } from "@/components/GameTheme";

const field =
  "min-h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-base text-[var(--game-text)] outline-none transition focus:border-[var(--game-accent)] focus:ring-2 focus:ring-[var(--game-accent)]/30";

const btnPrimary =
  "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent)] px-4 text-base font-semibold text-black active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

export default function SignupPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Could not sign up");
      await qc.invalidateQueries({ queryKey: ["auth", "me"] });
      router.push("/profile");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <GameTheme type="nertz">
      <main className="mx-auto flex w-full max-w-md flex-col px-[max(1rem,env(safe-area-inset-left))] py-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <h1 className="text-2xl font-semibold text-[var(--game-text)]">Sign up</h1>
        <p className="mt-2 text-sm text-[var(--game-muted)]">
          Usernames are 2–32 characters: letters, numbers, and underscores. Passwords need at least 6 characters.
        </p>

        <form
          className="mt-8 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            void submit();
          }}
        >
          <label className="text-sm font-medium text-[var(--game-muted)]">
            Username
            <input
              className={`${field} mt-2 font-mono`}
              name="username"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
          </label>
          <label className="text-sm font-medium text-[var(--game-muted)]">
            Password
            <input
              className={`${field} mt-2`}
              name="password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-[var(--game-warn)]">{error}</p> : null}
          <button
            type="submit"
            className={btnPrimary}
            disabled={busy || username.trim().length < 2 || password.length < 6}
          >
            {busy ? "Creating account…" : "Create account"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-[var(--game-muted)]">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-[var(--game-accent-2)] underline underline-offset-4">
            Log in
          </Link>
        </p>
      </main>
    </GameTheme>
  );
}
