export type GameTypeId = "nertz" | "swoop";

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
        "--game-warn": "#fb923c",
        "--game-text": "#f4faf7",
        "--game-muted": "#8fa39a",
        "--game-radius": "12px",
        "--game-shadow": "0 16px 40px rgba(0, 0, 0, 0.4)",
      },
    },
  },
];

export function getGameDefinition(id: string): GameDefinition | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}
