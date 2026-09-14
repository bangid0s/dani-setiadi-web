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

```bash
npm install
npm run db:seed
npm run dev
```

Open <http://localhost:3000>, and the dashboard at <http://localhost:3000/admin>.

The seed prints the first sign-in. Change that password immediately — either in
**Settings → Account**, or from the command line:

```bash
npm run admin:password -- you@example.com "a long new password"
```

### Optional sample content

Useful for seeing the layouts before real work is loaded:

```bash
node scripts/demo-content.mjs      # 10 sample projects in mixed ratios + one YouTube item
node scripts/demo-portrait.mjs     # a placeholder hero portrait
```

Both take `--clear` to remove what they added.

---

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
| Data | SQLite via `better-sqlite3` (`data/content.db`) |
| Files | `public/uploads` (media) and `public/files` (CV) |
| Images | `sharp` — downscaling, blur placeholders, dominant colour |
| Validation | Zod schemas shared by client and server |
| Auth | scrypt password hashes + httpOnly session cookies |

### One deliberate deviation from the PRD

**PRD §11.1 specifies Supabase + Vercel. This build uses SQLite and the local filesystem.**
The reason is practical: a Supabase project cannot be provisioned from here, and a build that
fails on missing environment variables delivers nothing you can run today.

What that means for you:

- Everything works immediately with `npm install && npm run db:seed && npm run dev` — no
  accounts, no keys.
- The schema in [`lib/db/schema.sql`](lib/db/schema.sql) matches PRD §10.1 table for table and
  column for column, and all data access sits behind a thin repository layer
  ([`lib/repo/`](lib/repo/)). Moving to Supabase is a driver swap, not a rewrite.
- **Deploy on a host with a persistent disk** — a VPS, Fly.io, Render, Railway, Coolify or
  Docker. Vercel's filesystem is ephemeral, so uploads and the database would not survive a
  deploy there. If Vercel is a hard requirement, migrate the repository layer to Supabase
  (Postgres + Storage) first; the RLS policy table in PRD §10.3 still applies.
- Back up `data/content.db` and `public/uploads` together — they are the whole site.

Other deviations, both to avoid dependencies outside PRD §11.1:

- Rich text is a small **Markdown subset** rendered straight to React elements
  ([`lib/richtext.tsx`](lib/richtext.tsx)) rather than Tiptap. Nothing is ever passed through
  `dangerouslySetInnerHTML`, so markup cannot be injected.
- Reordering uses **Move up / Move down** buttons rather than dnd-kit. PRD §9.2 allows this
  explicitly, and it works with touch and the keyboard out of the box.

---

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
  db/schema.sql           the database, mirroring PRD §10.1
  repo/                   all data access
  media/                  youtube.ts, import-url.ts, process.ts, src.ts
  masonry.ts              PRD §7.3.6 layout
  validation.ts           Zod schemas + the §9.5 content guardrails
docs/ADMIN-GUIDE.md       the one-page guide for Dani
```

---

## Environment variables

None are required to run. For production set:

```bash
NEXT_PUBLIC_SITE_URL=https://your-domain.com   # canonical URLs, sitemap, share cards
DATA_DIR=/var/lib/dani/data                    # optional: move the database off the repo
```

---

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
