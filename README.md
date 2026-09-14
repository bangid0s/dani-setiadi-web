# Dani Setiadi — Portfolio & Profile

The site specified in [`PRD-Dani-Setiadi-Portfolio.md`](PRD-Dani-Setiadi-Portfolio.md): a
single-page portfolio plus project pages, with a private dashboard at `/admin` where every
word, image and video on the site can be changed without a developer.

- **Public site** — hero, work (featured rows + masonry gallery + lightbox), about, contact,
  project pages, 404, sitemap, robots, Open Graph, JSON-LD.
- **Dashboard** — chapters, projects, categories, experience, tools, media library, display
  settings, site settings, account.
- **Media** — every image slot takes an **upload**, an **image link**, or a **YouTube link**.

---

## Quick start

You need a Supabase project first — **[DEPLOY.md](DEPLOY.md) walks through it
step by step**, including going live on Vercel.

```bash
npm install
cp .env.example .env.local     # then fill in your Supabase values
npm run db:setup               # creates the schema and seeds content
npm run dev
```

Open <http://localhost:3000>, and the dashboard at <http://localhost:3000/admin>.

`db:setup` prints a generated admin password on first run. Change it after
signing in (Settings → Account), or from the command line:

```bash
npm run admin:password -- you@example.com "a long new password"
```

### Bringing across content from the old SQLite build

```bash
npm run db:migrate-from-sqlite -- --dry   # report what would move
npm run db:migrate-from-sqlite            # move rows and files to Supabase
```

### Working without a Supabase project

`scripts/dev/` contains a throwaway Postgres (PGlite over the real wire
protocol) so you can run the whole app offline — see
[scripts/dev/README.md](scripts/dev/README.md).

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Development server on :3000 |
| `npm run build` / `npm start` | Production build and server |
| `npm run typecheck` | TypeScript, no emit |
| `npm run lint` | ESLint |
| `npm run db:seed` | Create the database and seed PRD Appendix A content (safe to re-run) |
| `npm run db:reset` | Wipe content tables and reseed |
| `npm run admin:password -- <email> "<password>"` | Set or create an admin password |

---

## How it is put together

| Layer | Choice |
|---|---|
| Framework | Next.js (App Router, TypeScript) |
| Styling | Tailwind CSS v4, brand tokens via `@theme` (PRD §5.10) |
| Database | Supabase Postgres, via the `postgres` driver over the transaction pooler |
| Files | Supabase Storage — `media` and `files` buckets |
| Images | `sharp` — downscaling, blur placeholders, dominant colour |
| Validation | Zod schemas shared by client and server |
| Auth | scrypt password hashes + httpOnly session cookies |
| Hosting | Vercel |

### Two deliberate departures from the PRD

Both were taken to avoid dependencies outside PRD §11.1:

- Rich text is a small **Markdown subset** rendered straight to React elements
  ([`lib/richtext.tsx`](lib/richtext.tsx)) rather than Tiptap. Nothing is ever
  passed through `dangerouslySetInnerHTML`, so markup cannot be injected.
- Reordering uses **Move up / Move down** buttons rather than dnd-kit. PRD §9.2
  allows this explicitly, and it works with touch and the keyboard out of the box.

### How access control works

Every query runs on the server — server components, server actions and route
handlers — over a privileged Postgres connection, and the app owns its own admin
sessions. Row-level security is still enabled on **every** table
([`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql)) so
that a leaked anon key could only ever read what a visitor already sees on the
public site, and could never write. `private_settings`, `messages`,
`admin_users`, `sessions` and `login_attempts` have no policy at all, so they are
unreadable to anyone but the server.

## Project structure

```text
app/
  (site)/                 public site — home, /work, /work/[slug]
  admin/login             sign-in
  admin/(dashboard)/      the dashboard modules
  api/media/*             upload, URL import, YouTube, library, metadata
  api/projects/bulk       bulk upload → draft projects
components/
  site/                   hero, gallery, lightbox, about, contact, nav, footer
  admin/                  dashboard forms and managers
  media/                  MediaField (upload / link / YouTube) + renderers
lib/
  db/                     the Postgres pool
  storage.ts              Supabase Storage upload / delete
  repo/                   all data access
  media/                  youtube.ts, import-url.ts, process.ts, src.ts
  masonry.ts              PRD §7.3.6 layout
  validation.ts           Zod schemas + the §9.5 content guardrails
supabase/migrations/      the schema and the storage buckets
scripts/                  setup, migration and password tools
docs/ADMIN-GUIDE.md       the one-page guide for Dani
DEPLOY.md                 going live on GitHub + Supabase + Vercel
```

---

## Environment variables

Copy `.env.example` to `.env.local`. All four are required:

```bash
DATABASE_URL=                 # Supabase → Database → Transaction pooler (port 6543)
NEXT_PUBLIC_SUPABASE_URL=     # Supabase → API → Project URL
SUPABASE_SERVICE_ROLE_KEY=    # Supabase → API → service_role (server-only, never commit)
NEXT_PUBLIC_SITE_URL=         # your public address, no trailing slash
```

Set the same four in Vercel → Project → Settings → Environment Variables.

## Security notes

- Every dashboard route and every server action re-checks the session (PRD ADM-03); the UI is
  never trusted on its own.
- Sign-in is allowlist-only, rate-limited, and gives the same message for an unknown email and
  a wrong password.
- Uploads are validated by **file signature**, not extension; SVGs are stripped of scripts,
  event handlers and `javascript:` links before they are stored.
- URL import is guarded against SSRF: private, loopback, link-local and CGNAT addresses are
  refused, non-standard ports are refused, redirects are re-checked at every hop, and the
  response must be `image/*`.
- YouTube loads nothing until a visitor clicks: cards show a thumbnail imported into your own
  storage, and the player uses `youtube-nocookie.com`.
- The service-role key is read only in server code and is never exposed to the browser.
  Row-level security is on for every table as a second line of defence.
