"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { GameTheme } from "@/components/GameTheme";
import { normalizeRoomCodeInput, sanitizedJoinFieldInput } from "@/lib/client/roomCode";

const field =
  "min-h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-[16px] text-[var(--game-text)] outline-none transition focus:border-[var(--game-accent)] focus:ring-2 focus:ring-[var(--game-accent)]/30 sm:text-base";

const btnPrimary =
  "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl bg-[var(--game-accent)] px-4 text-base font-semibold text-[var(--game-on-accent)] active:opacity-90 disabled:pointer-events-none disabled:opacity-45";

const btnGhost =
  "flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-4 text-base font-medium text-[var(--game-text)] active:bg-white/10 disabled:pointer-events-none disabled:opacity-45";

export default function JoinPage() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);
  const [pasting, setPasting] = useState(false);

  const go = () => {
    const code = normalizeRoomCodeInput(raw);
    if (!code) return;
    router.push(`/g/${encodeURIComponent(code)}`);
  };

  const syncRawFromInput = (value: string) => {
    setRaw(sanitizedJoinFieldInput(value));
  };

  const paste = async () => {
    setPasteError(null);
    setPasting(true);
    try {
      const text = await navigator.clipboard.readText();
      const tidied = sanitizedJoinFieldInput(text);
      setRaw(normalizeRoomCodeInput(tidied) || tidied);
    } catch {
      setPasteError("Could not read clipboard. Try typing the code or paste manually.");
    } finally {
      setPasting(false);
    }
  };

  const normalizedPreview = normalizeRoomCodeInput(raw);

  return (
    <GameTheme type="nertz">
      <main className="mx-auto flex w-full max-w-xl flex-col gap-6 px-[max(1rem,env(safe-area-inset-left))] py-5 pr-[max(1rem,env(safe-area-inset-right))] pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] sm:gap-10 sm:p-10">
        <header>
          <p className="text-xs uppercase tracking-[0.25em] text-[var(--game-muted)]">Good Game</p>
          <h1 className="mt-2 text-balance text-2xl font-semibold leading-tight text-[var(--game-text)] sm:text-3xl">
            Join a room
          </h1>
          <p className="mt-3 text-pretty text-sm leading-relaxed text-[var(--game-muted)] sm:text-sm">
            Type the room code or paste an invite link. Spaces cannot be entered; dashes in a code are ignored.
          </p>
        </header>

        <section className="rounded-2xl border border-white/10 bg-[var(--game-surface)] p-5 shadow-[var(--game-shadow)] sm:rounded-[var(--game-radius)] sm:p-6">
          <form
            className="block"
            onSubmit={(e) => {
              e.preventDefault();
              go();
            }}
          >
            <label className="text-sm font-medium text-[var(--game-muted)] sm:text-xs">
              Room code or link
              <input
                className={`${field} mt-2 font-mono uppercase`}
                autoCapitalize="characters"
                autoCorrect="off"
                autoComplete="off"
                spellCheck={false}
                enterKeyHint="go"
                autoFocus
                placeholder="e.g. ABC234"
                value={raw}
                onChange={(e) => syncRawFromInput(e.currentTarget.value)}
                onInput={(e) => syncRawFromInput(e.currentTarget.value)}
              />
            </label>

            {normalizedPreview ? (
              <p className="mt-3 text-sm text-[var(--game-muted)]">
                You will open{" "}
                <span className="font-mono font-medium text-[var(--game-text)]">{normalizedPreview}</span>
              </p>
            ) : null}

            {pasteError ? <p className="mt-4 text-base text-[var(--game-warn)] sm:text-sm">{pasteError}</p> : null}

            <div className="relative z-10 mt-6 flex flex-col gap-3 sm:flex-row sm:items-stretch">
              <button type="button" className={btnGhost} disabled={pasting} onClick={() => void paste()}>
                {pasting ? "Reading…" : "Paste from clipboard"}
              </button>
              <button type="submit" className={btnPrimary} disabled={normalizedPreview.length === 0}>
                Go to room
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-[var(--game-muted)]">
            <Link href="/" className="font-medium text-[var(--game-accent-2)] underline underline-offset-4">
              Create a new room
            </Link>
          </p>
        </section>
      </main>
    </GameTheme>
  );
}
