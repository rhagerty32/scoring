# Contributing

Thanks for helping improve **Good Game** — feedback, docs, tests, and code are all welcome.

## Before you start

- Check [open issues](https://github.com/rhagerty32/scoring/issues) for duplicates or active work.
- For larger changes, open an issue first so we can align on scope.

## Local setup

Prerequisites: **Node.js 20+** and **npm** (versions that work with Next.js 16).

```bash
git clone https://github.com/rhagerty32/scoring.git
cd scoring
npm install
npm run db:push   # creates/updates ./local.db (SQLite via libSQL)
```

Copy [.env.example](.env.example) to `.env.local` if you use Turso in development; otherwise local defaults use `file:./local.db`.

Start the dev server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

Run these before opening a pull request:

```bash
npm run lint    # ESLint (see note below if it reports errors)
npm run test    # Vitest unit tests
npm run build   # production build
```

> **Note:** ESLint currently reports some existing `react-hooks/set-state-in-effect` findings in the UI. New contributions should not add more violations where avoidable; fixing the remaining ones is a great follow-up issue.

Optional:

```bash
npm run db:studio   # Drizzle Studio
```

## Branch and pull request flow

1. Fork the repository (or branch from `main` if you have write access).
2. Create a feature branch, for example `your-name/short-description`.
3. Commit with clear messages; keep diffs focused.
4. Push and open a **pull request** against `main`.
5. Fill in the PR template (what changed, how to test).
6. CI runs **lint**, **test**, and **build** on pull requests — ensure checks pass when you can.

## Code style

- Match existing patterns: TypeScript, App Router, Drizzle for persistence, game rules in `lib/games/`.
- Prefer small, reviewable PRs over large rewrites.
- Do not commit secrets, `.env.local`, or `local.db`.

## Questions

Open a [GitHub issue](https://github.com/rhagerty32/scoring/issues) with the **question** label or comment on an existing discussion thread.

See also [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).
