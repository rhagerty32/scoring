"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { GameTheme } from "@/components/GameTheme";

type ProfileResponse = {
  username: string;
  stats: {
    gamesPlayed: number;
    finishedGames: number;
    wins: number;
    losses: number;
    activeGames: number;
  };
  games: Array<{
    code: string;
    type: string;
    status: string;
    createdAt: number;
    displayName: string;
    won: boolean | null;
  }>;
};

async function fetchProfile(): Promise<ProfileResponse> {
  const res = await fetch("/api/profile", { credentials: "include", cache: "no-store" });
  if (res.status === 401) throw new Error("401");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to load profile");
  }
  return res.json();
}

export default function ProfilePage() {
  const router = useRouter();
  const q = useQuery({ queryKey: ["profile"], queryFn: fetchProfile, retry: false });

  useEffect(() => {
    if (q.error && (q.error as Error).message === "401") router.replace("/login");
  }, [q.error, router]);

  if (q.isPending) {
    return (
      <GameTheme type="nertz">
        <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-[var(--game-muted)]">
          <span className="inline-block size-8 animate-pulse rounded-full bg-white/20" aria-hidden />
          Loading profile…
        </main>
      </GameTheme>
    );
  }

  if (q.isError || !q.data) {
    return (
      <GameTheme type="nertz">
        <main className="mx-auto max-w-xl px-6 py-12">
          <p className="text-[var(--game-warn)]">{(q.error as Error)?.message ?? "Something went wrong."}</p>
          <Link href="/login" className="mt-4 inline-block text-[var(--game-accent-2)] underline">
            Log in
          </Link>
        </main>
      </GameTheme>
    );
  }

  const { username, stats, games } = q.data;

  return (
    <GameTheme type="nertz">
      <main className="mx-auto w-full max-w-xl px-[max(1rem,env(safe-area-inset-left))] py-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <h1 className="text-2xl font-semibold text-[var(--game-text)]">Profile</h1>
        <p className="mt-1 font-mono text-sm text-[var(--game-muted)]">{username}</p>

        <section className="mt-8 rounded-2xl border border-white/10 bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)]">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--game-muted)]">Overall</h2>
          <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-[var(--game-muted)]">Games</dt>
              <dd className="font-mono text-lg text-[var(--game-text)]">{stats.gamesPlayed}</dd>
            </div>
            <div>
              <dt className="text-[var(--game-muted)]">Wins</dt>
              <dd className="font-mono text-lg text-[var(--game-accent-2)]">{stats.wins}</dd>
            </div>
            <div>
              <dt className="text-[var(--game-muted)]">Losses</dt>
              <dd className="font-mono text-lg text-[var(--game-text)]">{stats.losses}</dd>
            </div>
            <div>
              <dt className="text-[var(--game-muted)]">Finished</dt>
              <dd className="font-mono text-lg text-[var(--game-text)]">{stats.finishedGames}</dd>
            </div>
            <div>
              <dt className="text-[var(--game-muted)]">Active</dt>
              <dd className="font-mono text-lg text-[var(--game-text)]">{stats.activeGames}</dd>
            </div>
          </dl>
        </section>

        <section className="mt-8">
          <h2 className="text-sm font-medium uppercase tracking-wide text-[var(--game-muted)]">Your games</h2>
          {games.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--game-muted)]">
              Join a room while logged in to record games here.{" "}
              <Link href="/join" className="text-[var(--game-accent-2)] underline underline-offset-4">
                Join a room
              </Link>
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {games.map((g) => (
                <li key={g.code}>
                  <Link
                    href={`/profile/g/${encodeURIComponent(g.code)}`}
                    className="flex flex-col rounded-2xl border border-white/10 bg-[var(--game-surface)] px-4 py-3 shadow-[var(--game-shadow)] transition hover:border-white/20 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <span className="font-mono text-base font-semibold text-[var(--game-text)]">{g.code}</span>
                      <span className="ml-2 text-xs text-[var(--game-muted)]">{g.type}</span>
                      <p className="text-sm text-[var(--game-muted)]">
                        As <span className="text-[var(--game-text)]">{g.displayName}</span>
                        {g.status !== "done" ? (
                          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">Active</span>
                        ) : g.won === true ? (
                          <span className="ml-2 rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs text-emerald-300">
                            Win
                          </span>
                        ) : g.won === false ? (
                          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">Loss</span>
                        ) : (
                          <span className="ml-2 rounded-full bg-white/10 px-2 py-0.5 text-xs">Done</span>
                        )}
                      </p>
                    </div>
                    <span className="mt-2 text-xs text-[var(--game-muted)] sm:mt-0">
                      {new Date(g.createdAt).toLocaleString()}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </GameTheme>
  );
}
