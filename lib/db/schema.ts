import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const games = sqliteTable(
  "games",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    type: text("type").notNull(),
    targetScore: integer("target_score").notNull(),
    roundWinBonus: integer("round_win_bonus").notNull(),
    status: text("status").notNull(),
    currentRound: integer("current_round").notNull().default(0),
    hostToken: text("host_token").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("games_code_idx").on(t.code)]
);

export const players = sqliteTable(
  "players",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    displayName: text("display_name").notNull(),
    /** Shown once to the joining client; required to submit scores for this player. */
    playerToken: text("player_token").notNull(),
    clientKey: text("client_key"),
    joinedAt: integer("joined_at").notNull(),
  },
  (t) => [
    index("players_game_idx").on(t.gameId),
    uniqueIndex("players_game_client_key_idx").on(t.gameId, t.clientKey),
  ]
);

export const rounds = sqliteTable(
  "rounds",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
    lockedAt: integer("locked_at"),
  },
  (t) => [
    index("rounds_game_idx").on(t.gameId),
    uniqueIndex("rounds_game_number_idx").on(t.gameId, t.number),
  ]
);

export const roundScores = sqliteTable(
  "round_scores",
  {
    id: text("id").primaryKey(),
    roundId: text("round_id")
      .notNull()
      .references(() => rounds.id, { onDelete: "cascade" }),
    playerId: text("player_id")
      .notNull()
      .references(() => players.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    penalty: integer("penalty").notNull(),
    bonus: integer("bonus").notNull(),
    total: integer("total").notNull(),
  },
  (t) => [uniqueIndex("round_scores_round_player_idx").on(t.roundId, t.playerId)]
);

export type GameRow = typeof games.$inferSelect;
export type PlayerRow = typeof players.$inferSelect;
export type RoundRow = typeof rounds.$inferSelect;
export type RoundScoreRow = typeof roundScores.$inferSelect;
