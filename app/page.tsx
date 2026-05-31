"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { AnimatedWizardStep, useFocusWhen } from "@/components/step-wizard";
import { GameTheme } from "@/components/GameTheme";
import { GAME_REGISTRY, type GameTypeId } from "@/lib/games/registry";
import { writeHostToken } from "@/lib/client/storage";

function createWizardSteps(gameType: GameTypeId): number {
  return gameType === "2500" || gameType === "hand-and-foot" ? 3 : 4;
}

function usesShortWizard(gameType: GameTypeId): boolean {
  return gameType === "2500" || gameType === "hand-and-foot";
}

const field =
  "min-h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-base text-[var(--game-text)] outline-none transition focus:border-[var(--game-accent)] focus:ring-2 focus:ring-[var(--game-accent)]/30";

const btnPrimary =
  "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent)] px-4 text-base font-semibold text-[var(--game-on-accent)] active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

const btnGhost =
  "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-4 text-base font-medium text-[var(--game-text)] active:bg-white/10 disabled:pointer-events-none disabled:opacity-45";

export default function Home() {
  const router = useRouter();
  const [gameType, setGameType] = useState<GameTypeId>("nertz");
  const [targetScore, setTargetScore] = useState("100");
  const [roundWinBonus, setRoundWinBonus] = useState("10");
  const [showPlayedCards, setShowPlayedCards] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);

  const CREATE_STEPS = createWizardSteps(gameType);

  useEffect(() => {
    if (gameType === "2500") {
      setTargetScore("2500");
      setRoundWinBonus("0");
      setShowPlayedCards(true);
    } else if (gameType === "hand-and-foot") {
      setTargetScore("0");
      setRoundWinBonus("0");
    } else {
      setTargetScore("100");
      setRoundWinBonus("10");
    }
    setStep(0);
  }, [gameType]);

  const selectRef = useRef<HTMLSelectElement>(null);
  const targetRef = useRef<HTMLInputElement>(null);
  const bonusRef = useRef<HTMLInputElement>(null);
  const createRef = useRef<HTMLButtonElement>(null);

  useFocusWhen([step], selectRef, step === 0);
  useFocusWhen([step], targetRef, step === 1);
  useFocusWhen([step, gameType], bonusRef, step === 2 && !usesShortWizard(gameType));
  useFocusWhen([step, gameType], createRef, step === (usesShortWizard(gameType) ? 2 : 3));

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && step > 0) {
        e.preventDefault();
        setDirection(-1);
        setStep((s) => Math.max(0, s - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [step]);

  const goNext = () => {
    setDirection(1);
    setStep((s) => Math.min(createWizardSteps(gameType) - 1, s + 1));
  };

  const goBack = () => {
    setDirection(-1);
    setStep((s) => Math.max(0, s - 1));
  };

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const def = GAME_REGISTRY.find((g) => g.id === gameType);
      if (!def?.enabled) {
        setError("That game is not available yet.");
        setBusy(false);
        return;
      }
      const body =
        gameType === "2500"
          ? {
              type: "2500" as const,
              targetScore: Number(targetScore),
              showPlayedCards,
            }
          : gameType === "hand-and-foot"
            ? { type: "hand-and-foot" as const }
            : { type: "nertz" as const, targetScore: Number(targetScore), roundWinBonus: Number(roundWinBonus) };
      const res = await fetch("/api/games", {
        method: "POST",
        credentials: "include",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as { error?: string }).error ?? "Could not create game");
      const code = (data as { code: string }).code;
      const hostToken = (data as { hostToken: string }).hostToken;
      writeHostToken(code, hostToken);
      router.push(`/g/${encodeURIComponent(code)}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const onInputEnter = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (step < CREATE_STEPS - 1) goNext();
    else void start();
  };

  const nav = (
    <div
      className={`mt-8 min-w-0 gap-3 sm:mt-10 ${
        step < CREATE_STEPS - 1
          ? "grid max-sm:grid-cols-2 sm:flex sm:flex-wrap"
          : "flex flex-col gap-3 sm:flex sm:flex-wrap"
      }`}
    >
      <button
        type="button"
        className={`${btnGhost} min-w-0 sm:min-w-[5.5rem]`}
        disabled={step === 0}
        onClick={goBack}
      >
        Back
      </button>
      {step < CREATE_STEPS - 1 ? (
        <button type="button" className={`${btnPrimary} min-w-0 sm:min-w-[6.5rem]`} onClick={goNext}>
          Next
        </button>
      ) : (
        <button
          ref={createRef}
          type="button"
          className={`${btnPrimary} min-h-14 min-w-0 text-lg sm:min-h-12 sm:min-w-[6.5rem] sm:text-base`}
          disabled={busy}
          onClick={() => void start()}
        >
          {busy ? "Creating…" : "Create room"}
        </button>
      )}
    </div>
  );

  return (
    <GameTheme type={gameType}>
      <main className="mx-auto flex w-full max-w-xl flex-col px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:p-10">
        <header className="shrink-0">
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--game-muted)]">Good Game</p>
          <h1 className="mt-2 text-balance text-2xl font-semibold leading-tight text-[var(--game-text)] sm:text-3xl">
            Tabletop scoring in a shared room
          </h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--game-muted)] sm:text-sm">
            Pick a game, create a room, and share the link. Everyone joins from their own phone while one browser keeps
            the host tools and invite QR.
          </p>
        </header>

        <section className="mt-6 flex min-w-0 w-full flex-col rounded-2xl border border-white/10 bg-[var(--game-surface)] p-5 pb-6 shadow-[var(--game-shadow)] sm:mt-8 sm:min-h-[min(72dvh,36rem)] sm:flex-1 sm:rounded-[var(--game-radius)] sm:p-6">
          <p className="text-xs font-medium text-[var(--game-muted)]">
            Step {step + 1} of {CREATE_STEPS}
            <span className="hidden sm:inline"> · Enter continues · Esc goes back</span>
            <span className="sm:hidden"> · Use Next and Back below</span>
          </p>
          <AnimatedWizardStep stepKey={step} direction={direction} className="mt-5 flex flex-col sm:mt-6 sm:min-h-0 sm:flex-1">
            {step === 0 ? (
              <div className="flex flex-col justify-start sm:flex-1 sm:justify-center">
                <label className="text-sm font-medium text-[var(--game-muted)] sm:text-xs">
                  Game
                  <select
                    ref={selectRef}
                    className={`${field} mt-2`}
                    value={gameType}
                    onChange={(e) => setGameType(e.target.value as GameTypeId)}
                    onKeyDown={onInputEnter}
                  >
                    {GAME_REGISTRY.map((g) => (
                      <option key={g.id} value={g.id} disabled={!g.enabled}>
                        {g.label}
                        {!g.enabled ? " (soon)" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {nav}
              </div>
            ) : null}
            {step === 1 && gameType === "hand-and-foot" ? (
              <div className="flex flex-col justify-start gap-4 sm:flex-1 sm:justify-center">
                <p className="text-sm font-medium text-[var(--game-muted)] sm:text-xs">About this game</p>
                <p className="text-pretty text-sm leading-relaxed text-[var(--game-muted)]">
                  Three rounds of team play. In the lobby, drag players into teams. The host ends each round of play;
                  then each team enters books, cards, and penalty points. Highest total after round 3 wins.
                </p>
                {nav}
              </div>
            ) : null}
            {step === 1 && gameType !== "hand-and-foot" ? (
              <div className="flex flex-col justify-start gap-5 sm:flex-1 sm:justify-center">
                <label className="text-sm font-medium text-[var(--game-muted)] sm:text-xs">
                  Winning score (play to)
                  <input
                    ref={targetRef}
                    className={`${field} mt-2 font-mono`}
                    inputMode="numeric"
                    value={targetScore}
                    onChange={(e) => setTargetScore(e.target.value)}
                    onKeyDown={onInputEnter}
                  />
                </label>
                {gameType === "2500" ? (
                  <div className="flex items-start justify-between gap-4 rounded-2xl border border-white/10 bg-black/15 px-4 py-4">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[var(--game-text)]">Cards played tracker</p>
                      <p className="mt-1 text-pretty text-xs leading-relaxed text-[var(--game-muted)]">
                        Let everyone mark which ranks have been laid down. You can change this in the lobby or anytime
                        during play.
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={showPlayedCards}
                      className={`relative mt-0.5 h-8 w-14 shrink-0 rounded-full border transition touch-manipulation ${showPlayedCards ? "border-[var(--game-accent)] bg-[var(--game-accent)]" : "border-white/25 bg-white/10"}`}
                      onClick={() => setShowPlayedCards((v) => !v)}
                    >
                      <span
                        className={`absolute top-1/2 size-6 -translate-y-1/2 rounded-full bg-black shadow transition ${showPlayedCards ? "left-[calc(100%-1.625rem)]" : "left-1"}`}
                        aria-hidden
                      />
                      <span className="sr-only">{showPlayedCards ? "On" : "Off"}</span>
                    </button>
                  </div>
                ) : null}
                {nav}
              </div>
            ) : null}
            {step === 2 && gameType !== "2500" && gameType !== "hand-and-foot" ? (
              <div className="flex flex-col justify-start sm:flex-1 sm:justify-center">
                <label className="text-sm font-medium text-[var(--game-muted)] sm:text-xs">
                  Round win bonus
                  <input
                    ref={bonusRef}
                    className={`${field} mt-2 font-mono`}
                    inputMode="numeric"
                    value={roundWinBonus}
                    onChange={(e) => setRoundWinBonus(e.target.value)}
                    onKeyDown={onInputEnter}
                  />
                </label>
                {nav}
              </div>
            ) : null}
            {step === 2 && usesShortWizard(gameType) ? (
              <div className="flex flex-col justify-start gap-4 sm:flex-1 sm:justify-center">
                <p className="text-sm font-medium text-[var(--game-muted)] sm:text-xs">Review</p>
                <ul className="space-y-2 rounded-2xl border border-white/10 bg-black/15 px-4 py-4 text-base text-[var(--game-text)] sm:text-sm">
                  <li className="flex justify-between gap-4">
                    <span className="text-[var(--game-muted)]">Game</span>
                    <span className="font-medium">{GAME_REGISTRY.find((g) => g.id === gameType)?.label}</span>
                  </li>
                  {gameType === "2500" ? (
                    <>
                      <li className="flex justify-between gap-4">
                        <span className="text-[var(--game-muted)]">Play to</span>
                        <span className="font-mono font-medium">{targetScore}</span>
                      </li>
                      <li className="flex justify-between gap-4">
                        <span className="text-[var(--game-muted)]">Cards played tracker</span>
                        <span className="font-medium">{showPlayedCards ? "On" : "Off"}</span>
                      </li>
                    </>
                  ) : (
                    <li className="flex justify-between gap-4">
                      <span className="text-[var(--game-muted)]">Rounds</span>
                      <span className="font-medium">3 (highest total wins)</span>
                    </li>
                  )}
                </ul>
                {error ? <p className="text-base text-[var(--game-warn)] sm:text-sm">{error}</p> : null}
                <p className="text-pretty text-sm leading-relaxed text-[var(--game-muted)]">
                  {gameType === "hand-and-foot"
                    ? "Assign teams in the lobby, then play three rounds. The host ends each round; teams enter scores on their phones."
                    : "The host ends each round of play, then everyone logs their score. The host locks the round to start the next one; players can edit until then."}
                </p>
                {nav}
              </div>
            ) : null}
            {step === 3 ? (
              <div className="flex flex-col justify-start gap-4 sm:flex-1 sm:justify-center">
                <p className="text-sm font-medium text-[var(--game-muted)] sm:text-xs">Review</p>
                <ul className="space-y-2 rounded-2xl border border-white/10 bg-black/15 px-4 py-4 text-base text-[var(--game-text)] sm:text-sm">
                  <li className="flex justify-between gap-4">
                    <span className="text-[var(--game-muted)]">Game</span>
                    <span className="font-medium">{GAME_REGISTRY.find((g) => g.id === gameType)?.label}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span className="text-[var(--game-muted)]">Play to</span>
                    <span className="font-mono font-medium">{targetScore}</span>
                  </li>
                  <li className="flex justify-between gap-4">
                    <span className="text-[var(--game-muted)]">Round win bonus</span>
                    <span className="font-mono font-medium">{roundWinBonus}</span>
                  </li>
                </ul>
                {error ? <p className="text-base text-[var(--game-warn)] sm:text-sm">{error}</p> : null}
                <p className="text-pretty text-sm leading-relaxed text-[var(--game-muted)]">
                  This browser is the host: settings and the invite link stay here. Rounds move forward when every
                  player has saved for the current round.
                </p>
                {nav}
              </div>
            ) : null}
          </AnimatedWizardStep>
        </section>

        <p className="mt-8 shrink-0 text-center text-base text-[var(--game-muted)] sm:text-sm">
          <Link
            href="/join"
            className="font-medium text-[var(--game-accent-2)] underline underline-offset-4"
          >
            Join with a room code
          </Link>
        </p>
      </main>
    </GameTheme>
  );
}
