export type GameTypeId = "nertz" | "swoop" | "2500" | "hand-and-foot";

export type GameDefinition = {
  id: GameTypeId;
  label: string;
  description: string;
  enabled: boolean;
  theme: {
    /** Applied on `[data-game]` wrapper */
    dataAttr: string;
    cssVars: Record<string, string>;
  };
};

export const GAME_REGISTRY: GameDefinition[] = [
  {
    id: "nertz",
    label: "Nertz",
    description: "Shared room: each player logs points, penalties, and round-win bonus per round.",
    enabled: true,
    theme: {
      dataAttr: "nertz",
      cssVars: {
        "--game-bg": "#17120f",
        "--game-surface": "#242019",
        "--game-surface-2": "#2f2a22",
        "--game-accent": "#f97316",
        "--game-accent-2": "#5eead4",
        "--game-on-accent": "#1a0f05",
        "--game-on-accent-2": "#0a1614",
        "--game-warn": "#fbbf24",
        "--game-text": "#faf6f0",
        "--game-muted": "#a89b8f",
        "--game-radius": "14px",
        "--game-shadow": "0 18px 50px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  {
    id: "swoop",
    label: "Swoop",
    description: "Same room flow as Nertz; scoring rules TBD.",
    enabled: false,
    theme: {
      dataAttr: "swoop",
      cssVars: {
        "--game-bg": "#141a18",
        "--game-surface": "#1f2623",
        "--game-surface-2": "#28302c",
        "--game-accent": "#34d399",
        "--game-accent-2": "#fcd34d",
        "--game-on-accent": "#041008",
        "--game-on-accent-2": "#1a1408",
        "--game-warn": "#fb923c",
        "--game-text": "#f4faf7",
        "--game-muted": "#8fa39a",
        "--game-radius": "12px",
        "--game-shadow": "0 16px 40px rgba(0, 0, 0, 0.4)",
      },
    },
  },
  {
    id: "hand-and-foot",
    label: "Hand and Foot",
    description: "Three rounds of team play. Drag players into teams, then score books, cards, and penalties each round.",
    enabled: true,
    theme: {
      dataAttr: "hand-and-foot",
      cssVars: {
        "--game-bg": "#0c1410",
        "--game-surface": "#141f1a",
        "--game-surface-2": "#1a2a22",
        "--game-accent": "#34d399",
        "--game-accent-2": "#a3e635",
        "--game-on-accent": "#041008",
        "--game-on-accent-2": "#141a06",
        "--game-warn": "#fbbf24",
        "--game-text": "#ecfdf5",
        "--game-muted": "#86a89a",
        "--game-radius": "14px",
        "--game-shadow": "0 18px 50px rgba(0, 0, 0, 0.45)",
      },
    },
  },
  {
    id: "2500",
    label: "Wild Things",
    description:
      "Race to a target with meld tracking, wild cards, and round scoring. Aces are low in rank (below 3); scoring still uses ±100 for aces.",
    enabled: true,
    theme: {
      dataAttr: "wild-things",
      cssVars: {
        "--game-bg": "#05040a",
        "--game-surface": "#0c0a12",
        "--game-surface-2": "#14101c",
        "--game-accent": "#8f7eb8",
        "--game-accent-2": "#4a3f68",
        "--game-on-accent": "#f2eff8",
        "--game-on-accent-2": "#ebe6f5",
        "--game-warn": "#c9a86a",
        "--game-text": "#e8e4f0",
        "--game-muted": "#6a6578",
        "--game-radius": "14px",
        "--game-shadow": "0 22px 60px rgba(0, 0, 0, 0.72)",
      },
    },
  },
];

export function getGameDefinition(id: string): GameDefinition | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}

/** User-facing name for a game type id (e.g. `2500` → Wild Things). */
export function gameTypeLabel(id: string): string {
  return getGameDefinition(id)?.label ?? id;
}
