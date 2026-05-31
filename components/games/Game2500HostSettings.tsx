"use client";

import { forwardRef, useCallback, useEffect, useId, useImperativeHandle, useState, type Ref } from "react";

const FIELD =
    "min-h-12 w-full rounded-2xl border border-white/15 bg-black/25 px-4 text-base text-[var(--game-text)] outline-none transition focus:border-[var(--game-accent)] focus:ring-2 focus:ring-[var(--game-accent)]/30";

const BTN_GHOST =
    "flex min-h-12 touch-manipulation items-center justify-center rounded-2xl border border-white/20 bg-white/5 px-4 text-base font-medium text-[var(--game-text)] active:bg-white/10 disabled:pointer-events-none disabled:opacity-45";

export type Game2500SettingsSavePayload = {
    targetScore?: number;
    showPlayedCards?: boolean;
    endGame?: boolean;
};

export function ShowPlayedCardsToggle({
    checked,
    disabled,
    onChange,
}: {
    checked: boolean;
    disabled?: boolean;
    onChange: (showPlayedCards: boolean) => void;
}) {
    const id = useId();
    return (
        <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
                <label htmlFor={id} className="text-sm font-medium text-[var(--game-text)]">
                    Cards played tracker
                </label>
                <p className="mt-1 text-pretty text-xs leading-relaxed text-[var(--game-muted)]">
                    When off, nobody sees which ranks are down during play or scoring.
                </p>
            </div>
            <button
                id={id}
                type="button"
                role="switch"
                aria-checked={checked}
                disabled={disabled}
                className={`relative mt-0.5 h-8 w-14 shrink-0 rounded-full border transition touch-manipulation disabled:opacity-45 ${checked ? "border-[var(--game-accent)] bg-[var(--game-accent)]" : "border-white/25 bg-white/10"}`}
                onClick={() => onChange(!checked)}
            >
                <span
                    className={`absolute top-1/2 size-6 -translate-y-1/2 rounded-full bg-black shadow transition ${checked ? "left-[calc(100%-1.625rem)]" : "left-1"}`}
                    aria-hidden
                />
                <span className="sr-only">{checked ? "On" : "Off"}</span>
            </button>
        </div>
    );
}

export const TargetScoreEditor = forwardRef<
    { flush: () => Promise<void> },
    {
        savedValue: number;
        onSave: (targetScore: number) => Promise<unknown>;
        savingExternal: boolean;
    }
>(function TargetScoreEditor({ savedValue, onSave, savingExternal }, ref) {
    const [draft, setDraft] = useState(String(savedValue));
    const [note, setNote] = useState<"idle" | "saving" | "saved">("idle");

    useEffect(() => {
        setDraft(String(savedValue));
    }, [savedValue]);

    const persist = useCallback(async () => {
        const ts = Number(draft);
        if (!Number.isFinite(ts) || ts === savedValue) return;
        setNote("saving");
        try {
            await onSave(ts);
            setNote("saved");
            window.setTimeout(() => setNote("idle"), 2000);
        } catch {
            setNote("idle");
        }
    }, [draft, savedValue, onSave]);

    useImperativeHandle(ref, () => ({ flush: persist }), [persist]);

    const showSaving = savingExternal || note === "saving";

    return (
        <label className="block text-sm font-medium text-[var(--game-muted)] sm:text-xs">
            <span className="text-[var(--game-text)]">Target score</span>
            <input
                className={`${FIELD} mt-2 font-mono`}
                inputMode="numeric"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={() => void persist()}
            />
            {showSaving ? (
                <span className="mt-2 block text-xs text-[var(--game-accent-2)]">Saving…</span>
            ) : note === "saved" ? (
                <span className="mt-2 block text-xs text-[var(--game-accent)]">Saved.</span>
            ) : null}
        </label>
    );
});

export function Game2500HostSettings({
    targetScore,
    showPlayedCards,
    saving,
    onSaveSettings,
    onEndGame,
    showEndGame = false,
    targetScoreRef,
}: {
    targetScore: number;
    showPlayedCards: boolean;
    saving: boolean;
    onSaveSettings: (p: Game2500SettingsSavePayload) => Promise<unknown>;
    onEndGame?: () => Promise<unknown>;
    showEndGame?: boolean;
    targetScoreRef?: Ref<{ flush: () => Promise<void> }>;
}) {
    const [ending, setEnding] = useState(false);

    const handleEndGame = async () => {
        if (
            !window.confirm(
                "End the match now? Standings stay as they are; you can still review scores.",
            )
        ) {
            return;
        }
        setEnding(true);
        try {
            await onEndGame?.();
        } finally {
            setEnding(false);
        }
    };

    return (
        <div className="space-y-5">
            <TargetScoreEditor
                ref={targetScoreRef}
                savedValue={targetScore}
                onSave={(ts) => onSaveSettings({ targetScore: ts })}
                savingExternal={saving}
            />
            <ShowPlayedCardsToggle
                checked={showPlayedCards}
                disabled={saving}
                onChange={(next) => void onSaveSettings({ showPlayedCards: next })}
            />
            {showEndGame ? (
                <div className="border-t border-white/10 pt-5">
                    <button
                        type="button"
                        className={`${BTN_GHOST} w-full border-[var(--game-warn)]/35 text-[var(--game-warn)]`}
                        disabled={saving || ending}
                        onClick={() => void handleEndGame()}
                    >
                        {ending ? "Ending…" : "End match"}
                    </button>
                </div>
            ) : null}
        </div>
    );
}
