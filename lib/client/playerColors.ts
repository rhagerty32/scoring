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
