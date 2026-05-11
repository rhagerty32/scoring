/** HttpOnly session cookie name (Good Game). */
export const SESSION_COOKIE_NAME = "gg_session";

/** Rolling session lifetime from each authenticated request (~400 days). */
export const SESSION_DURATION_MS = 400 * 24 * 60 * 60 * 1000;
