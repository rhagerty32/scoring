import type { GameRow, PlayerRow, RoundRow, RoundScoreRow } from "@/lib/db/schema";
import { computeGroupAwards, type GroupAward, type PlayerLockedAgg } from "@/lib/games/groupAwards";

export type { GroupAward } from "@/lib/games/groupAwards";
import {
    parseRankClaimsJson,
    parseScoreTapMeta,
    type ScoreTapMeta,
    winnerPlayerIds2500,
} from "@/lib/games/game2500";
import { projectFavorites } from "@/lib/games/nertz";

export type { ScoreTapMeta } from "@/lib/games/game2500";

export type PublicPlayer = {
    id: string;
    displayName: string;
    joinedAt: number;
};

export type PublicRoundScore = {
    playerId: string;
    score: number;
    penalty: number;
    bonus: number;
    total: number;
    scoreMeta: ScoreTapMeta | null;
};

export type PublicRound = {
    id: string;
    number: number;
    lockedAt: number | null;
    /** `playing` | `scoring` for 2500; null for Nertz. */
    playPhase: string | null;
    wildRank: string | null;
    rankClaims: Record<string, string>;
    scores: PublicRoundScore[];
};

export type StandingsRow = {
    playerId: string;
    displayName: string;
    cumulative: number;
    /** Average net round total (score − penalty + bonus) over locked rounds. */
    averagePerLockedRound: number;
    averagePenaltyPerLockedRound: number;
    averageRawScorePerLockedRound: number;
    /** Game 2500: min net points in a single locked round. */
    minNetRound?: number | null;
    /** Game 2500: max net points in a single locked round. */
    maxNetRound?: number | null;
    /** Game 2500: count of wild cards (p100 + m100) across locked rounds. */
    hundredTapEvents?: number;
};

export type ChartPoint = { round: number;[playerId: string]: number | string };

export type PublicGamePayload = {
    code: string;
    type: string;
    status: string;
    targetScore: number;
    roundWinBonus: number;
    currentRound: number;
    createdAt: number;
    youAreHost: boolean;
    players: PublicPlayer[];
    rounds: PublicRound[];
    standings: StandingsRow[];
    projections: { playerId: string; estimatedRoundsRemaining: number | null }[];
    /** Pace projection: lowest estimated rounds-to-target among players with a computable pace. */
    favoritePlayerId: string | null;
    chart: { keys: string[]; points: ChartPoint[] };
    currentRoundComplete: boolean;
    winnerPlayerIds: string[];
    groupAwards: GroupAward[];
};

export function buildPublicGameState(input: {
    game: GameRow;
    players: PlayerRow[];
    rounds: RoundRow[];
    scores: RoundScoreRow[];
    hostTokenHeader: string | null;
}): PublicGamePayload {
    const { game, players, rounds, scores, hostTokenHeader } = input;
    const youAreHost = Boolean(hostTokenHeader && hostTokenHeader === game.hostToken);

    const scoreByRound = new Map<string, RoundScoreRow[]>();
    for (const s of scores) {
        const list = scoreByRound.get(s.roundId) ?? [];
        list.push(s);
        scoreByRound.set(s.roundId, list);
    }

    const publicRounds: PublicRound[] = rounds
        .slice()
        .sort((a, b) => a.number - b.number)
        .map((r) => ({
            id: r.id,
            number: r.number,
            lockedAt: r.lockedAt,
            playPhase: r.playPhase ?? null,
            wildRank: r.wildRank ?? null,
            rankClaims: parseRankClaimsJson(r.rankClaimsJson),
            scores: (scoreByRound.get(r.id) ?? []).map((s) => ({
                playerId: s.playerId,
                score: s.score,
                penalty: s.penalty,
                bonus: s.bonus,
                total: s.total,
                scoreMeta: s.scoreMetaJson != null && s.scoreMetaJson !== "" ? parseScoreTapMeta(s.scoreMetaJson) : null,
            })),
        }));

    const lockedRounds = publicRounds.filter((r) => r.lockedAt != null).sort((a, b) => a.number - b.number);
    const playerIds = players.map((p) => p.id);

    const cumulativeLocked = new Map<string, number>();
    for (const pid of playerIds) cumulativeLocked.set(pid, 0);

    const chartPoints: ChartPoint[] = [];
    for (const r of lockedRounds) {
        const point: ChartPoint = { round: r.number };
        for (const pid of playerIds) {
            const row = r.scores.find((s) => s.playerId === pid);
            const t = row?.total ?? 0;
            const prev = cumulativeLocked.get(pid) ?? 0;
            const next = prev + t;
            cumulativeLocked.set(pid, next);
            point[pid] = next;
        }
        chartPoints.push(point);
    }

    const current = publicRounds.find((r) => r.number === game.currentRound && r.lockedAt == null);
    const cumulativeDisplay = new Map<string, number>(cumulativeLocked);
    if (current) {
        for (const pid of playerIds) {
            const row = current.scores.find((s) => s.playerId === pid);
            const t = row?.total ?? 0;
            cumulativeDisplay.set(pid, (cumulativeLocked.get(pid) ?? 0) + t);
        }
    }

    const numLocked = lockedRounds.length;
    const standings: StandingsRow[] = players.map((p) => {
        const cum = cumulativeDisplay.get(p.id) ?? 0;
        let sumLocked = 0;
        let sumPenalty = 0;
        let sumScore = 0;
        const nets: number[] = [];
        let hundredTapEvents = 0;
        for (const r of lockedRounds) {
            const row = r.scores.find((s) => s.playerId === p.id);
            sumLocked += row?.total ?? 0;
            sumPenalty += row?.penalty ?? 0;
            sumScore += row?.score ?? 0;
            nets.push(row?.total ?? 0);
            const meta = row?.scoreMeta;
            if (meta) hundredTapEvents += meta.p100 + meta.m100;
        }
        const avg = numLocked > 0 ? sumLocked / numLocked : 0;
        const avgPenalty = numLocked > 0 ? sumPenalty / numLocked : 0;
        const avgRawScore = numLocked > 0 ? sumScore / numLocked : 0;
        const minNetRound = game.type === "2500" && nets.length > 0 ? Math.min(...nets) : undefined;
        const maxNetRound = game.type === "2500" && nets.length > 0 ? Math.max(...nets) : undefined;
        return {
            playerId: p.id,
            displayName: p.displayName,
            cumulative: cum,
            averagePerLockedRound: avg,
            averagePenaltyPerLockedRound: avgPenalty,
            averageRawScorePerLockedRound: avgRawScore,
            ...(game.type === "2500"
                ? {
                    minNetRound: minNetRound ?? null,
                    maxNetRound: maxNetRound ?? null,
                    hundredTapEvents,
                }
                : {}),
        };
    });

    const lockedAggs: PlayerLockedAgg[] = players.map((p) => {
        let sumPenalty = 0;
        let sumScore = 0;
        let sumTotal = 0;
        let negativeRounds = 0;
        let bonusWins = 0;
        for (const r of lockedRounds) {
            const row = r.scores.find((s) => s.playerId === p.id);
            const penalty = row?.penalty ?? 0;
            const score = row?.score ?? 0;
            const total = row?.total ?? 0;
            const bonus = row?.bonus ?? 0;
            sumPenalty += penalty;
            sumScore += score;
            sumTotal += total;
            if (total < 0) negativeRounds += 1;
            if (game.roundWinBonus > 0 && bonus === game.roundWinBonus) bonusWins += 1;
        }
        return {
            playerId: p.id,
            sumPenalty,
            sumScore,
            sumTotal,
            negativeRounds,
            bonusWins,
        };
    });
    const groupAwards = computeGroupAwards(lockedAggs, numLocked, game.roundWinBonus);

    const cumulativeForProjection = new Map<string, number[]>();
    for (const pid of playerIds) {
        const series: number[] = [];
        let run = 0;
        for (const r of lockedRounds) {
            const row = r.scores.find((s) => s.playerId === pid);
            run += row?.total ?? 0;
            series.push(run);
        }
        cumulativeForProjection.set(pid, series);
    }

    const projections = projectFavorites(playerIds, cumulativeForProjection, game.targetScore);

    const ranked = projections
        .filter((p) => p.estimatedRoundsRemaining != null)
        .sort((a, b) => (a.estimatedRoundsRemaining ?? 0) - (b.estimatedRoundsRemaining ?? 0));
    const favoritePlayerId = ranked[0]?.playerId ?? null;

    const winnerPlayerIds =
        game.type === "2500"
            ? winnerPlayerIds2500(playerIds, cumulativeDisplay, game.targetScore)
            : playerIds.filter((pid) => (cumulativeDisplay.get(pid) ?? 0) >= game.targetScore);

    let currentRoundComplete = false;
    if (current && players.length > 0) {
        if (game.type === "2500" && current.playPhase === "playing") {
            currentRoundComplete = false;
        } else {
            currentRoundComplete = players.every((p) => current.scores.some((s) => s.playerId === p.id));
        }
    }

    return {
        code: game.code,
        type: game.type,
        status: game.status,
        targetScore: game.targetScore,
        roundWinBonus: game.roundWinBonus,
        currentRound: game.currentRound,
        createdAt: game.createdAt,
        youAreHost,
        players: players.map((p) => ({
            id: p.id,
            displayName: p.displayName,
            joinedAt: p.joinedAt,
        })),
        rounds: publicRounds,
        standings,
        projections,
        favoritePlayerId,
        chart: { keys: playerIds, points: chartPoints },
        currentRoundComplete,
        winnerPlayerIds,
        groupAwards,
    };
}
