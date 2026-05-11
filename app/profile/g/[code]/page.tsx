"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import { GameTheme } from "@/components/GameTheme";
import { ScoreChart } from "@/components/ScoreChart";
import { StandingsTable } from "@/components/StandingsTable";
import type { PublicGamePayload } from "@/lib/server/gameState";

type GameDetailResponse = { state: PublicGamePayload; yourPlayerId: string };

async function fetchGameDetail(code: string): Promise<GameDetailResponse> {
  const res = await fetch(`/api/profile/games/${encodeURIComponent(code)}`, {
    credentials: "include",
    cache: "no-store",
  });
  if (res.status === 401) throw new Error("401");
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error ?? "Failed to load game");
  }
  return res.json();
}

export default function ProfileGamePage() {
  const params = useParams<{ code: string }>();
  const router = useRouter();
  const code = decodeURIComponent(params.code ?? "").trim().toUpperCase();

  const q = useQuery({
    queryKey: ["profile", "game", code],
    queryFn: () => fetchGameDetail(code),
    enabled: code.length > 0,
    retry: false,
  });

  useEffect(() => {
    if (q.error && (q.error as Error).message === "401") router.replace("/login");
  }, [q.error, router]);

  if (!code) {
    return (
      <GameTheme type="nertz">
        <main className="p-6">
          <p className="text-[var(--game-warn)]">Invalid code.</p>
        </main>
      </GameTheme>
    );
  }

  if (q.isPending) {
    return (
      <GameTheme type="nertz">
        <main className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-24 text-[var(--game-muted)]">
          <span className="inline-block size-8 animate-pulse rounded-full bg-white/20" aria-hidden />
          Loading…
        </main>
      </GameTheme>
    );
  }

  if (q.isError || !q.data) {
    return (
      <GameTheme type="nertz">
        <main className="mx-auto max-w-xl px-6 py-12">
          <p className="text-[var(--game-warn)]">{(q.error as Error)?.message ?? "Could not load game."}</p>
          <Link href="/profile" className="mt-4 inline-block text-[var(--game-accent-2)] underline">
            Back to profile
          </Link>
        </main>
      </GameTheme>
    );
  }

  const { state: game, yourPlayerId } = q.data;
  const you = game.players.find((p) => p.id === yourPlayerId);
  const won =
    game.status === "done" && game.winnerPlayerIds.length > 0 ? game.winnerPlayerIds.includes(yourPlayerId) : null;

  return (
    <GameTheme type={game.type === "2500" ? "2500" : "nertz"}>
      <main className="mx-auto w-full max-w-xl space-y-6 px-[max(1rem,env(safe-area-inset-left))] py-6 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))]">
        <div>
          <Link href="/profile" className="text-sm text-[var(--game-accent-2)] underline underline-offset-4">
            ← Profile
          </Link>
          <h1 className="mt-2 font-mono text-2xl font-semibold text-[var(--game-text)]">{game.code}</h1>
          <p className="mt-1 text-sm text-[var(--game-muted)]">
            {game.type} · You played as {you?.displayName ?? "?"}
            {won === true ? (
              <span className="ml-2 text-emerald-300">· Win</span>
            ) : won === false ? (
              <span className="ml-2">· Loss</span>
            ) : null}
          </p>
        </div>

        <p className="text-sm text-[var(--game-muted)]">
          <Link href={`/g/${encodeURIComponent(game.code)}`} className="text-[var(--game-accent-2)] underline underline-offset-4">
            Open live room
          </Link>{" "}
          if the game is still active.
        </p>

        <StandingsTable game={game} />
        <ScoreChart game={game} />

        <section className="rounded-2xl border border-white/10 bg-[var(--game-surface)] p-4 shadow-[var(--game-shadow)]">
          <h2 className="text-sm font-medium text-[var(--game-muted)]">Rounds</h2>
          <ul className="mt-3 space-y-3 text-sm">
            {game.rounds
              .slice()
              .sort((a, b) => a.number - b.number)
              .map((r) => {
                const mine = r.scores.find((s) => s.playerId === yourPlayerId);
                return (
                  <li key={r.id} className="border-b border-white/5 pb-3 last:border-0">
                    <span className="font-medium text-[var(--game-text)]">Round {r.number}</span>
                    {r.lockedAt ? (
                      <span className="ml-2 text-[var(--game-muted)]">locked</span>
                    ) : (
                      <span className="ml-2 text-[var(--game-muted)]">open</span>
                    )}
                    {mine ? (
                      <span className="mt-1 block font-mono text-[var(--game-muted)]">
                        Your line: {mine.score} pts, pen {mine.penalty}, bonus {mine.bonus} → total {mine.total}
                      </span>
                    ) : (
                      <span className="mt-1 block text-[var(--game-muted)]">No score saved for you this round.</span>
                    )}
                  </li>
                );
              })}
          </ul>
        </section>
      </main>
    </GameTheme>
  );
}
