import type { GameRow, PlayerRow, RoundRow, RoundScoreRow, TeamRow } from "@/lib/db/schema";
import { computeGroupAwards, type GroupAward, type PlayerLockedAgg } from "@/lib/games/groupAwards";

export type { GroupAward } from "@/lib/games/groupAwards";
import {
    parseRankClaimsJson,
    parseScoreTapMeta,
    type ScoreTapMeta,
    winnerPlayerIds2500,
} from "@/lib/games/game2500";
import {
    parseHandAndFootScoreMetaJson,
    type HandAndFootScoreMeta,
    winnerTeamIdsHandAndFoot,
} from "@/lib/games/handAndFoot";
import { projectFavorites } from "@/lib/games/nertz";

export type { ScoreTapMeta } from "@/lib/games/game2500";
export type { HandAndFootScoreMeta } from "@/lib/games/handAndFoot";

export type PublicTeam = {
    id: string;
    name: string;
    sortOrder: number;
};

export type PublicPlayer = {
    id: string;
    displayName: string;
    joinedAt: number;
    teamId: string | null;
};

export type PublicRoundScore = {
    playerId: string;
    teamId: string | null;
    score: number;
    penalty: number;
    bonus: number;
    total: number;
    scoreMeta: ScoreTapMeta | null;
    handAndFootMeta: HandAndFootScoreMeta | null;
};

export type TeamStandingsRow = {
    teamId: string;
    teamName: string;
    playerNames: string[];
    cumulative: number;
    round1: number | null;
    round2: number | null;
    round3: number | null;
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
    /** 2500: when false, meld tracker is hidden for everyone. */
    showPlayedCards: boolean;
    currentRound: number;
    createdAt: number;
    youAreHost: boolean;
    teams: PublicTeam[];
    players: PublicPlayer[];
    rounds: PublicRound[];
    standings: StandingsRow[];
    teamStandings: TeamStandingsRow[];
    projections: { playerId: string; estimatedRoundsRemaining: number | null }[];
    /** Pace projection: lowest estimated rounds-to-target among players with a computable pace. */
    favoritePlayerId: string | null;
    chart: { keys: string[]; points: ChartPoint[] };
    currentRoundComplete: boolean;
    winnerPlayerIds: string[];
    winnerTeamIds: string[];
    groupAwards: GroupAward[];
};

export function buildPublicGameState(input: {
    game: GameRow;
    teams?: TeamRow[];
    players: PlayerRow[];
    rounds: RoundRow[];
    scores: RoundScoreRow[];
    hostTokenHeader: string | null;
}): PublicGamePayload {
    const { game, players, rounds, scores, hostTokenHeader } = input;
    const teamRows = input.teams ?? [];
    const youAreHost = Boolean(hostTokenHeader && hostTokenHeader === game.hostToken);
    const showPlayedCards = game.showPlayedCards !== 0;
    const publicRankClaims = (json: string | null) =>
        game.type === "2500" && !showPlayedCards ? {} : parseRankClaimsJson(json);

    if (game.type === "hand-and-foot") {
        return buildHandAndFootPublicState({
            game,
            teams: teamRows,
            players,
            rounds,
            scores,
            youAreHost,
        });
    }

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
            rankClaims: publicRankClaims(r.rankClaimsJson),
            scores: (scoreByRound.get(r.id) ?? []).map((s) => mapRoundScoreRow(s, game.type)),
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
        showPlayedCards,
        currentRound: game.currentRound,
        createdAt: game.createdAt,
        youAreHost,
        teams: [],
        players: players.map((p) => ({
            id: p.id,
            displayName: p.displayName,
            joinedAt: p.joinedAt,
            teamId: p.teamId ?? null,
        })),
        rounds: publicRounds,
        standings,
        teamStandings: [],
        projections,
        favoritePlayerId,
        chart: { keys: playerIds, points: chartPoints },
        currentRoundComplete,
        winnerPlayerIds,
        winnerTeamIds: [],
        groupAwards,
    };
}

function mapRoundScoreRow(s: RoundScoreRow, gameType: string): PublicRoundScore {
    const handAndFootMeta =
        gameType === "hand-and-foot" ? parseHandAndFootScoreMetaJson(s.scoreMetaJson) : null;
    const scoreMeta =
        gameType === "2500" && s.scoreMetaJson != null && s.scoreMetaJson !== ""
            ? parseScoreTapMeta(s.scoreMetaJson)
            : null;
    return {
        playerId: s.playerId,
        teamId: s.teamId ?? null,
        score: s.score,
        penalty: s.penalty,
        bonus: s.bonus,
        total: s.total,
        scoreMeta,
        handAndFootMeta,
    };
}

function buildHandAndFootPublicState(input: {
    game: GameRow;
    teams: TeamRow[];
    players: PlayerRow[];
    rounds: RoundRow[];
    scores: RoundScoreRow[];
    youAreHost: boolean;
}): PublicGamePayload {
    const { game, teams, players, rounds, scores, youAreHost } = input;
    const showPlayedCards = game.showPlayedCards !== 0;
    const teamIds = teams.map((t) => t.id);
    const teamById = new Map(teams.map((t) => [t.id, t]));
    const playersByTeam = new Map<string, PlayerRow[]>();
    for (const p of players) {
        if (!p.teamId) continue;
        const list = playersByTeam.get(p.teamId) ?? [];
        list.push(p);
        playersByTeam.set(p.teamId, list);
    }

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
            scores: (scoreByRound.get(r.id) ?? []).map((s) => mapRoundScoreRow(s, game.type)),
        }));

    const lockedRounds = publicRounds.filter((r) => r.lockedAt != null).sort((a, b) => a.number - b.number);
    const cumulativeLocked = new Map<string, number>();
    for (const tid of teamIds) cumulativeLocked.set(tid, 0);

    const chartPoints: ChartPoint[] = [];
    for (const r of lockedRounds) {
        const point: ChartPoint = { round: r.number };
        for (const tid of teamIds) {
            const row = r.scores.find((s) => s.teamId === tid);
            const t = row?.total ?? 0;
            const prev = cumulativeLocked.get(tid) ?? 0;
            const next = prev + t;
            cumulativeLocked.set(tid, next);
            point[tid] = next;
        }
        chartPoints.push(point);
    }

    const current = publicRounds.find((r) => r.number === game.currentRound && r.lockedAt == null);
    const cumulativeDisplay = new Map<string, number>(cumulativeLocked);
    if (current) {
        for (const tid of teamIds) {
            const row = current.scores.find((s) => s.teamId === tid);
            const t = row?.total ?? 0;
            cumulativeDisplay.set(tid, (cumulativeLocked.get(tid) ?? 0) + t);
        }
    }

    const roundTotal = (roundNum: number, tid: string): number | null => {
        const r = lockedRounds.find((x) => x.number === roundNum);
        if (!r) return null;
        const row = r.scores.find((s) => s.teamId === tid);
        return row?.total ?? null;
    };

    const teamStandings: TeamStandingsRow[] = teams
        .slice()
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((t) => {
            const members = playersByTeam.get(t.id) ?? [];
            return {
                teamId: t.id,
                teamName: t.name,
                playerNames: members.map((p) => p.displayName),
                cumulative: cumulativeDisplay.get(t.id) ?? 0,
                round1: roundTotal(1, t.id),
                round2: roundTotal(2, t.id),
                round3: roundTotal(3, t.id),
            };
        });

    const winnerTeamIds =
        game.status === "done" ? winnerTeamIdsHandAndFoot(teamIds, cumulativeDisplay) : [];

    let currentRoundComplete = false;
    if (current && teams.length > 0) {
        if (current.playPhase === "playing") {
            currentRoundComplete = false;
        } else {
            const submittedTeams = new Set(
                current.scores.map((s) => s.teamId).filter((id): id is string => id != null),
            );
            currentRoundComplete = teams.every((t) => submittedTeams.has(t.id));
        }
    }

    return {
        code: game.code,
        type: game.type,
        status: game.status,
        targetScore: game.targetScore,
        roundWinBonus: game.roundWinBonus,
        showPlayedCards,
        currentRound: game.currentRound,
        createdAt: game.createdAt,
        youAreHost,
        teams: teams
            .slice()
            .sort((a, b) => a.sortOrder - b.sortOrder)
            .map((t) => ({ id: t.id, name: t.name, sortOrder: t.sortOrder })),
        players: players.map((p) => ({
            id: p.id,
            displayName: p.displayName,
            joinedAt: p.joinedAt,
            teamId: p.teamId ?? null,
        })),
        rounds: publicRounds,
        standings: [],
        teamStandings,
        projections: teamIds.map((tid) => ({ playerId: tid, estimatedRoundsRemaining: null })),
        favoritePlayerId: null,
        chart: { keys: teamIds, points: chartPoints },
        currentRoundComplete,
        winnerPlayerIds: [],
        winnerTeamIds,
        groupAwards: [],
    };
}
