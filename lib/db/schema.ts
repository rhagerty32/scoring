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
    /** 2500: 1 = show meld tracker to all players, 0 = hidden. */
    showPlayedCards: integer("show_played_cards").notNull().default(1),
    createdAt: integer("created_at").notNull(),
  },
  (t) => [uniqueIndex("games_code_idx").on(t.code)]
);

export const teams = sqliteTable(
  "teams",
  {
    id: text("id").primaryKey(),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    sortOrder: integer("sort_order").notNull(),
  },
  (t) => [index("teams_game_idx").on(t.gameId)]
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
    teamId: text("team_id").references(() => teams.id, { onDelete: "set null" }),
  },
  (t) => [
    index("players_game_idx").on(t.gameId),
    uniqueIndex("players_game_client_key_idx").on(t.gameId, t.clientKey),
    index("players_user_idx").on(t.userId),
    index("players_team_idx").on(t.teamId),
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
    /** `playing` | `scoring` for 2500 / hand-and-foot; NULL for legacy Nertz rounds. */
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
    /** Hand and Foot: score belongs to this team; playerId is the submitter. */
    teamId: text("team_id").references(() => teams.id, { onDelete: "cascade" }),
    score: integer("score").notNull(),
    penalty: integer("penalty").notNull(),
    bonus: integer("bonus").notNull(),
    total: integer("total").notNull(),
    /** JSON: 2500 tap counts or Hand and Foot { books, cards, penalties }. */
    scoreMetaJson: text("score_meta_json"),
  },
  (t) => [
    uniqueIndex("round_scores_round_player_idx").on(t.roundId, t.playerId),
    uniqueIndex("round_scores_round_team_idx").on(t.roundId, t.teamId),
  ]
);

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type GameRow = typeof games.$inferSelect;
export type TeamRow = typeof teams.$inferSelect;
export type PlayerRow = typeof players.$inferSelect;
export type RoundRow = typeof rounds.$inferSelect;
export type RoundScoreRow = typeof roundScores.$inferSelect;
