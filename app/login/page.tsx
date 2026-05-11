"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GameTheme } from "@/components/GameTheme";
import { normalizeUsername } from "@/lib/username";

const field =
  "min-h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-base text-[var(--game-text)] outline-none transition focus:border-[var(--game-accent)] focus:ring-2 focus:ring-[var(--game-accent)]/30";

const btnPrimary =
  "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent)] px-4 text-base font-semibold text-black active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

export default function LoginPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const listId = useId();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadSuggestions = useCallback(async (q: string) => {
    const n = normalizeUsername(q);
    if (n.length < 1) {
      setSuggestions([]);
      return;
    }
    const res = await fetch(`/api/auth/usernames?q=${encodeURIComponent(n)}`, { credentials: "include" });
    const data = (await res.json().catch(() => ({}))) as { usernames?: string[] };
    setSuggestions(Array.isArray(data.usernames) ? data.usernames : []);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      void loadSuggestions(username);
    }, 200);
    return () => window.clearTimeout(t);
  }, [username, loadSuggestions]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username: username.trim(), password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Login failed");
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
        <h1 className="text-2xl font-semibold text-[var(--game-text)]">Log in</h1>
        <p className="mt-2 text-sm text-[var(--game-muted)]">Use the same username you signed up with.</p>

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
              list={listId}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
            />
            <datalist id={listId}>
              {suggestions.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </label>
          <label className="text-sm font-medium text-[var(--game-muted)]">
            Password
            <input
              className={`${field} mt-2`}
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </label>
          {error ? <p className="text-sm text-[var(--game-warn)]">{error}</p> : null}
          <button type="submit" className={btnPrimary} disabled={busy || username.trim().length < 1 || password.length < 1}>
            {busy ? "Signing in…" : "Log in"}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-[var(--game-muted)]">
          No account?{" "}
          <Link href="/signup" className="font-medium text-[var(--game-accent-2)] underline underline-offset-4">
            Sign up
          </Link>
        </p>
      </main>
    </GameTheme>
  );
}
