const PALETTE = ["#f97316", "#5eead4", "#fbbf24", "#fb7185", "#4ade80", "#38bdf8", "#fcd34d", "#f472b6"];

export function playerColorByIndex(index: number): string {
  return PALETTE[index % PALETTE.length]!;
}

/** Stable color from player order in the room list. */
export function playerColorMap(playerIds: string[]): Map<string, string> {
  const m = new Map<string, string>();
  playerIds.forEach((id, i) => m.set(id, playerColorByIndex(i)));
  return m;
}

export type StandingsLike = { playerId: string; cumulative: number };

/** Player ids highest cumulative first (current standings order). */
export function playerIdsByStandings(standings: StandingsLike[]): string[] {
  return [...standings].sort((a, b) => b.cumulative - a.cumulative).map((s) => s.playerId);
}

/** Colors keyed by player id; palette index follows current standings rank. */
export function playerColorMapFromStandings(standings: StandingsLike[]): Map<string, string> {
  return playerColorMap(playerIdsByStandings(standings));
}
