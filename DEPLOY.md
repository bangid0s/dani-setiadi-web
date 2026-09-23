# Going live — GitHub, Supabase, Vercel

Everything in the code is ready. What's left is creating three accounts' worth
of resources, which needs your own logins, and pasting five values between them.

Budget about 30 minutes. Nothing here is irreversible.

---

## Before you start

You need:

- A **GitHub** account — <https://github.com/signup>
- A **Supabase** account — <https://supabase.com/dashboard> (free tier is fine)
- A **Vercel** account — <https://vercel.com/signup> (hobby tier is fine)

Sign in to all three in your browser first.

---

## 1 · Push the code to GitHub

The repository is already initialised and committed locally.

Create an empty repository at <https://github.com/new>:

- **Name:** `dani-setiadi-web` (or anything you like)
- **Visibility:** Private
- **Do not** tick "Add a README", ".gitignore" or "license" — the repo already has them

Then, in this project folder:

```bash
git remote add origin https://github.com/YOUR-USERNAME/dani-setiadi-web.git
git push -u origin main
```

GitHub will ask you to sign in. If it asks for a password, use a
**personal access token** instead (<https://github.com/settings/tokens>) — GitHub
stopped accepting account passwords for git.

> Nothing secret is in the repository. `.env.local`, the database file and
> uploaded images are all excluded by `.gitignore`.

---

## 2 · Create the Supabase project

1. Go to <https://supabase.com/dashboard> → **New project**
2. **Name:** `dani-setiadi` · **Region:** Singapore (closest to Indonesia)
3. Set a **database password** and save it somewhere safe — you need it in a moment
4. Wait for provisioning (~2 minutes)

### Create the tables

Open **SQL Editor** → **New query**, then run each migration in order.
Copy the whole file, paste, press **Run**:

1. `supabase/migrations/0001_init.sql` — tables, indexes and row-level security
2. `supabase/migrations/0002_storage.sql` — the `media` and `files` buckets
3. `supabase/migrations/0003_indexes.sql`, `0004_simplify_projects.sql` and
   `0005_project_json_indexes.sql` — in that order, once each

You should see "Success. No rows returned" both times.

### Collect the three values you need

**Project Settings → Database → Connection string → Session pooler**

Copy it and replace `[YOUR-PASSWORD]` with the password from step 3. It looks
like:

```
postgresql://postgres.abcdefgh:YOUR-PASSWORD@aws-0-ap-southeast-1.pooler.supabase.com:5432/postgres
```

> **Either pooler string works.** The app switches a session-pooler URL
> (port 5432) to the transaction pooler (port 6543) on its own, because on
> Vercel every warm instance holds its own connections and session mode runs
> out of them. Query pipelining is turned off in `lib/db/index.ts`, which is
> what makes the transaction pooler safe: with it on, past two concurrent
> queries the pooler stalls instead of erroring and pages hang. Set
> `DB_KEEP_PORT=1` if you ever need to stay on 5432.

**Project Settings → API**

- **Project URL** → looks like `https://abcdefgh.supabase.co`
- **service_role** secret key → a long `eyJ…` string

> The service_role key bypasses all security rules. Never put it in the
> repository, never share it, and never give it a name starting with
> `NEXT_PUBLIC_`.

---

## 3 · Load your content

Create `.env.local` in this folder (copy `.env.example`) and fill in the three
values you just collected, plus your site URL.

Then, from this folder:

```bash
npm install
npm run db:setup
```

That creates the schema and seeds your chapters, categories, tools and
experience, and prints a generated admin password. **Write that password down.**

**If you want to bring across the work already in the local build** (projects,
uploaded images, the CV) instead of starting fresh:

```bash
npm run db:migrate-from-sqlite -- --dry   # see what would move
npm run db:migrate-from-sqlite            # actually move it
```

This uploads every file to Supabase Storage and copies every row, keeping the
same IDs. Your existing admin password keeps working. It is safe to run twice.

Check it locally before deploying:

```bash
npm run dev
```

---

## 4 · Deploy to Vercel

1. Go to <https://vercel.com/new>
2. **Import** the GitHub repository you pushed in step 1
3. Framework preset should auto-detect as **Next.js** — leave the build settings alone
4. Expand **Environment Variables** and add all four:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | the **pooler** connection string, with your password |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://abcdefgh.supabase.co` |
   | `SUPABASE_SERVICE_ROLE_KEY` | the long `eyJ…` secret |
   | `NEXT_PUBLIC_SITE_URL` | `https://your-project.vercel.app` for now |

5. **Deploy**

First build takes 2–3 minutes. When it finishes, open the URL — the site is live.

---

## 5 · Point your domain at it

In Vercel: **Project → Settings → Domains → Add**, type your domain, and follow
the DNS instructions it gives you (usually one `A` record or one `CNAME` at your
registrar).

Once the domain works, update `NEXT_PUBLIC_SITE_URL` to the real address
(**Settings → Environment Variables**) and redeploy — that value drives canonical
URLs, the sitemap and link previews.

---

## 6 · Before you tell anyone about it

- [ ] Sign in at `your-site.com/admin` and change your password (Settings → Account)
- [ ] Add your email address and WhatsApp number (Settings → Contact)
- [ ] Upload your CV (Settings → CV)
- [ ] Set the share image and favicon (Settings → Search and sharing)
- [ ] Replace the placeholder portrait with your cutout (Hero → Portrait)
- [ ] Upload the "Hi, I'm" lettering as SVG if you have it (Hero → Greeting)
- [ ] Replace the real social links (Settings → Social links)
- [ ] Publish your real projects, and delete any sample content
- [ ] Confirm the third experience entry, or delete it (Experience — it's hidden)

---

## Afterwards

**Changing the site** — every push to `main` deploys automatically. You do not
need to touch Vercel again.

```bash
git add -A
git commit -m "what you changed"
git push
```

**Changing content** — use `/admin`. No deploy needed; changes are live in
seconds.

**Backups** — Supabase takes daily backups on paid plans. On the free plan,
export your data occasionally from the SQL Editor, and keep your original
artwork files somewhere safe.

**Costs** — Supabase free tier gives 500 MB of database and 1 GB of file
storage; Vercel's hobby tier covers a personal portfolio. Neither charges
without you upgrading. Watch the Supabase storage number as you add work.

---

## If something goes wrong

**The build fails on Vercel with "DATABASE_URL is not set"**
An environment variable is missing or misspelled. Check all four in
Settings → Environment Variables, then **Redeploy**.

**The site loads but has no content**
The migrations ran on a different project than the one `DATABASE_URL` points at,
or `npm run db:setup` was never run. Re-check the connection string.

**Images don't appear**
`NEXT_PUBLIC_SUPABASE_URL` is wrong, or `0002_storage.sql` was never run. In
Supabase → Storage you should see buckets named `media` and `files`, both public.

**You can't sign in**
Reset the password from your own machine:

```bash
npm run admin:password -- you@example.com "a long new password"
```

**Pages hang and never finish loading**
Make sure the deployed code includes `max_pipeline: 0` in `lib/db/index.ts` —
pipelined queries on the transaction pooler are what used to stall. Then check
the Vercel function logs for the real error (a wrong password or a paused
Supabase project shows up there as a connection error).

**"Too many connections"**
Lower `DB_POOL_MAX` (default 4) in your environment variables, or upgrade the Supabase
plan if real traffic has outgrown the free tier.
