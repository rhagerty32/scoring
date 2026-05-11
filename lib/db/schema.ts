import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    /** Normalized lowercase for uniqueness and login search. */
    username: text("username").notNull(),
    passwordHash: text("password_hash").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("users_username_idx").on(t.username)]
);

export const sessions = sqliteTable(
  "sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: integer("expires_at").notNull(),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("sessions_token_hash_idx").on(t.tokenHash), index("sessions_user_idx").on(t.userId)]
);

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
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
  },
  (t) => [
    index("players_game_idx").on(t.gameId),
    uniqueIndex("players_game_client_key_idx").on(t.gameId, t.clientKey),
    index("players_user_idx").on(t.userId),
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
    /** `playing` | `scoring` for game type 2500; NULL for legacy Nertz rounds. */
    playPhase: text("play_phase"),
    wildRank: text("wild_rank"),
    /** JSON: { [rank]: playerId } — who marked each rank as played down. */
    rankClaimsJson: text("rank_claims_json"),
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
    /** JSON: calculator tap counts for 2500 analytics (e.g. p100, m100). */
    scoreMetaJson: text("score_meta_json"),
  },
  (t) => [uniqueIndex("round_scores_round_player_idx").on(t.roundId, t.playerId)]
);

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type PlayerRow = typeof players.$inferSelect;
export type RoundRow = typeof rounds.$inferSelect;
export type RoundScoreRow = typeof roundScores.$inferSelect;
