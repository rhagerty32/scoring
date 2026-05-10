# Tabletop scoring (Nertz)

Next.js app for in-person card games: create a room, share the link, and track Nertz rounds; when every player has saved their score for a round, the round locks and the next one opens automatically.

## Local development

```bash
npm install
npm run db:push   # creates/updates ./local.db (SQLite via libSQL)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Creating a game stores the **host token** in `sessionStorage` on that browser; joining stores a **player token** in `localStorage` so each person can only edit their own scores.

## Environment variables

Copy [.env.example](.env.example) to `.env.local` for Turso in development, or rely on defaults:

| Variable | Purpose |
| --- | --- |
| `TURSO_DATABASE_URL` | Turso database URL, or omit to use `file:./local.db` |
| `TURSO_AUTH_TOKEN` | Turso auth token (omit for local file DB) |

## Deploying on Vercel

1. Create a database on [Turso](https://turso.tech/) (libSQL / SQLite-compatible).
2. Set `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN` on the Vercel project.
3. From your machine (with env set), run `npm run db:push` against the remote Turso URL so tables exist, or run migrations as you prefer.
4. `git push` and connect the repo to Vercel, or use `vercel deploy`.

API routes use the **Node.js** runtime for `@libsql/client` + Drizzle.

## Scripts

- `npm run dev` — dev server  
- `npm run build` — production build  
- `npm run db:push` — apply [Drizzle](https://orm.drizzle.team/) schema (`drizzle-kit push`)  
- `npm run db:studio` — Drizzle Studio (optional)  
- `npm test` — Vitest unit tests  

## Architecture (short)

- **Rooms**: short codes in `games.code`, unguessable **host** and **player** tokens for lightweight auth.
- **Polling**: the room page refetches game state via TanStack Query — about every **1s** while the game is active and the tab is visible, slower when the tab is in the background or the game is in lobby/done (no WebSockets). For near-real-time sync across devices you would add SSE or a hosted realtime channel; **HTTP webhooks** (server POSTs to your URL) help external integrations, not the browser, unless you build a receiver that pushes to clients.
- **Themes**: per-game CSS variables from [lib/games/registry.ts](lib/games/registry.ts); Nertz is enabled, Swoop is stubbed for later.
