/**
 * Ranks used in 2500 (no 2s, no jokers), low → high with **aces low**:
 * A is the lowest rank (like a 1); 3…K follow. Meld/wild scoring still uses ±100 for aces via the calculator taps.
 */
export const RANKS_2500 = ["A", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export type Rank2500 = (typeof RANKS_2500)[number];

const RANK_SET = new Set<string>(RANKS_2500);

const RANK_ORDER = new Map<string, number>(RANKS_2500.map((r, i) => [r, i]));

/** 0 = lowest (A), length−1 = highest (K); −1 if not a 2500 rank. */
export function rankOrderIndex2500(rank: string): number {
    return RANK_ORDER.get(rank) ?? -1;
}

/** Sort key for 2500 ranks (aces low). Invalid ranks sort last. */
export function compareRanks2500(a: string, b: string): number {
    return (RANK_ORDER.get(a) ?? 99) - (RANK_ORDER.get(b) ?? 99);
}

export function isValid2500Rank(rank: string): rank is Rank2500 {
    return RANK_SET.has(rank);
}

export type RankClaimsMap = Record<string, string>;

export function parseRankClaimsJson(raw: string | null | undefined): RankClaimsMap {
    if (raw == null || raw === "") return {};
    try {
        const v = JSON.parse(raw) as unknown;
        if (v == null || typeof v !== "object" || Array.isArray(v)) return {};
        const out: RankClaimsMap = {};
        for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
            if (!isValid2500Rank(k)) continue;
            if (typeof val === "string" && val.length > 0) out[k] = val;
        }
        return out;
    } catch {
        return {};
    }
}

export function serializeRankClaimsJson(claims: RankClaimsMap): string {
    const parts: string[] = [];
    for (const rank of RANKS_2500) {
        const owner = claims[rank];
        if (owner) parts.push(`${JSON.stringify(rank)}:${JSON.stringify(owner)}`);
    }
    // Build the object literal manually so order stays aces-low; plain objects reorder integer-like keys in JSON.stringify.
    return `{${parts.join(",")}}`;
}

export type ApplyRankToggleResult =
    | { ok: true; claims: RankClaimsMap }
    | { ok: false; error: string };

/**
 * Turn rank on (any player) or off (only the player who turned it on).
 */
export function applyRankToggle(
    claims: RankClaimsMap,
    rank: string,
    actorPlayerId: string,
    turnOn: boolean,
): ApplyRankToggleResult {
    if (!isValid2500Rank(rank)) return { ok: false, error: "Invalid rank" };
    const next = { ...claims };
    if (turnOn) {
        next[rank] = actorPlayerId;
        return { ok: true, claims: next };
    }
    const owner = claims[rank];
    if (!owner) {
        return { ok: true, claims: next };
    }
    if (owner !== actorPlayerId) return { ok: false, error: "Only the player who marked this card can clear it" };
    delete next[rank];
    return { ok: true, claims: next };
}

export const WENT_OUT_BONUS = 100;

export type ScoreTapMeta = {
    p5: number;
    m5: number;
    p10: number;
    m10: number;
    p100: number;
    m100: number;
    /** 1 if this row was saved while the player had gone out this round. */
    wentOut?: number;
};

export type ApplyWentOutToggleResult =
    | { ok: true; wentOutPlayerId: string | null }
    | { ok: false; error: string };

/** At most one player may go out per round; only that player can clear. */
export function applyWentOutToggle(
    currentPlayerId: string | null | undefined,
    actorPlayerId: string,
    turnOn: boolean,
): ApplyWentOutToggleResult {
    const current = currentPlayerId ?? null;
    if (turnOn) {
        if (current != null && current !== actorPlayerId) {
            return { ok: false, error: "Someone else already went out this round" };
        }
        return { ok: true, wentOutPlayerId: actorPlayerId };
    }
    if (current == null) return { ok: true, wentOutPlayerId: null };
    if (current !== actorPlayerId) {
        return { ok: false, error: "Only the player who went out can clear it" };
    }
    return { ok: true, wentOutPlayerId: null };
}

const emptyTaps: ScoreTapMeta = { p5: 0, m5: 0, p10: 0, m10: 0, p100: 0, m100: 0, wentOut: 0 };

export function parseScoreTapMeta(raw: string | null | undefined): ScoreTapMeta {
    if (raw == null || raw === "") return { ...emptyTaps };
    try {
        const v = JSON.parse(raw) as unknown;
        if (v == null || typeof v !== "object" || Array.isArray(v)) return { ...emptyTaps };
        const o = v as Record<string, unknown>;
        const n = (x: unknown) => (typeof x === "number" && Number.isFinite(x) && x >= 0 ? Math.floor(x) : 0);
        const wentOut = o.wentOut === 1 ? 1 : 0;
        return {
            p5: n(o.p5),
            m5: n(o.m5),
            p10: n(o.p10),
            m10: n(o.m10),
            p100: n(o.p100),
            m100: n(o.m100),
            wentOut,
        };
    } catch {
        return { ...emptyTaps };
    }
}

export function sumP100Taps(meta: ScoreTapMeta): number {
    return meta.p100 + meta.m100;
}

const SCORE_2500_NET_MIN = -50_000;
const SCORE_2500_NET_MAX = 50_000;

function clamp2500Net(v: unknown): number {
    const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
    if (!Number.isFinite(n)) return 0;
    return Math.max(SCORE_2500_NET_MIN, Math.min(SCORE_2500_NET_MAX, Math.trunc(n)));
}

/** Net round total for 2500; penalty and bonus are forced to 0. */
export function parse2500ScorePayload(input: {
    score: unknown;
    penalty: unknown;
    bonus: unknown;
}): { score: number; penalty: number; bonus: number; total: number } {
    const net = clamp2500Net(input.score);
    return { score: net, penalty: 0, bonus: 0, total: net };
}

/** Among everyone at or over the target, winners share the highest cumulative (co-winners on exact tie). */
export function winnerPlayerIds2500(
    playerIds: string[],
    cumulativeByPlayer: Map<string, number>,
    targetScore: number,
): string[] {
    const over = playerIds.filter((pid) => (cumulativeByPlayer.get(pid) ?? 0) >= targetScore);
    if (over.length === 0) return [];
    const maxC = Math.max(...over.map((pid) => cumulativeByPlayer.get(pid) ?? 0));
    return over.filter((pid) => (cumulativeByPlayer.get(pid) ?? 0) === maxC);
}

export function normalizeScoreTapMeta(input: Partial<ScoreTapMeta> | undefined): ScoreTapMeta {
    const n = (x: unknown) =>
        typeof x === "number" && Number.isFinite(x) ? Math.max(0, Math.min(10_000, Math.floor(x))) : 0;
    if (!input) return { ...emptyTaps };
    const wentOut = input.wentOut === 1 ? 1 : 0;
    return {
        p5: n(input.p5),
        m5: n(input.m5),
        p10: n(input.p10),
        m10: n(input.m10),
        p100: n(input.p100),
        m100: n(input.m100),
        wentOut,
    };
}
