# Flexit

**Made something? Flex it.** Flexit is a feed where people share what they made, learned or achieved, in any skill: code, design, art, music, gaming, fitness, cooking and more. Think Instagram's photo feed with a LinkedIn-style profile that collects your wins by skill.

Built with **Next.js 16** and **Supabase** (Postgres, Auth, Storage and Realtime).

## What it does

- **Post a flex**: pick a skill, add a title, an optional photo, story and link. Photos are resized in the browser (max 1600 px, WebP) and stripped of location data before upload.
- **Live feed**: new flexes from other people appear behind a "↑ 2 new flexes" button without a reload. Like and comment counts update in place.
- **12 skills**: every skill has its own feed at `/s/<skill>`.
- **Profiles**: name, headline, bio, followers, and a skill breakdown ("Development · 4, Music · 2") above a grid of everything the person posted.
- **Follow people** and switch the home feed to **Following**; sort any feed by **Latest** or **Top this week**. More flexes load as you scroll.
- **Likes and live comments** on every flex. Authors can remove comments on their own posts.
- **Live notifications**: a bell with an unread count and a toast the moment someone likes, comments on or follows you.
- **Search** people and flexes, or browse by skill.
- **Edit** your flex (marked "edited"), **share** a flex or profile link, **report** someone else's. Three reports hide a flex until it's reviewed.
- **Dark mode**: Light, Dark or System, remembered per device, with no flash on load.
- Drafts are saved on your device while you write; paste a screenshot straight into the new-flex form.
- Email + password sign-up with live username checks, optional **GitHub** sign-in, and **delete account** (removes everything you posted).

## How the backend is secured

Every rule lives in the database, so it holds for any client, not just this website ([migration](supabase/migrations/20261113000000_flexit.sql)):

- **Row level security** on every table: anyone can read; you can only write as yourself, and only edit or delete your own posts, likes, comments and follows.
- **Column grants**: clients can't set `author_id`, `like_count` or `comment_count`. Counters are kept by triggers.
- **Rate limits in Postgres**: 10 flexes an hour and 30 comments every 10 minutes per person.
- **Notifications** are written by triggers and readable only by the person they're for; **reports** are private and auto-hide a flex at three.
- **Storage policies**: each user can only upload into their own folder, and a post can only point at an image in its author's folder.
- **Check constraints** on usernames, lengths and links (only `http`/`https`).

These rules are covered by [database tests](tests/db/rls.test.ts) that sign in as different users and try to break them.

## Tech stack

| | |
|---|---|
| Framework | Next.js 16 (App Router, Cache Components), React 19, TypeScript |
| Styling | Tailwind CSS 4, self-hosted Anybody + Instrument Sans |
| Backend | Supabase: Postgres, Auth, Storage, Realtime |
| Validation | Zod (same limits as the database) |
| Tests | Vitest (unit + row level security), Playwright (end-to-end on a local Supabase) with axe accessibility checks in light and dark mode |
| CI | GitHub Actions |

## Run it locally

Requirements: Node 22, pnpm, Docker (for the local Supabase stack).

```bash
pnpm install
pnpm db:start                     # starts Supabase locally and applies the migration
cp .env.example .env.local        # paste the API URL and publishable key it printed
pnpm dev                          # http://localhost:3000
```

Tests:

```bash
pnpm test        # unit tests
pnpm test:db     # row level security tests (needs the local database)
pnpm build && pnpm test:e2e   # end-to-end tests in Chromium
```

## Deploy

1. Create a Supabase project and run the migration: `supabase link` then `supabase db push` (or paste the SQL file into the SQL editor).
2. In **Authentication → Sign In / Providers → Email**, turn off **Confirm email** (or set up custom SMTP), and add `https://<your-site>/auth/callback` to **URL Configuration → Redirect URLs**.
3. Deploy to Vercel with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` and `NEXT_PUBLIC_SITE_URL`.
4. Optional: enable the GitHub provider in Supabase and set `NEXT_PUBLIC_AUTH_GITHUB=1`.

## License

MIT © Muhammad Shehryar
