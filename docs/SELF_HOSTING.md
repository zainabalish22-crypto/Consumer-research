# Self-hosting

A university, lab or researcher can run their own copy of the platform. There are then no shared limits, and data stays on infrastructure you control. You also become responsible for backups, security updates and email delivery.

> **Status:** the standalone Node server described under "Without Docker" has been built and run: pages, static files and the sign-in redirect all worked. The Docker files (`Dockerfile`, `docker-compose.yml`) package that same server, but they have **not yet been built on a machine with Docker**. Please report any problems you hit.

## What you need

The app has two parts:

1. **The web app** (this repository): a Next.js server. It is stateless, so it can run anywhere Node.js 20+ or Docker runs.
2. **Supabase**, which provides PostgreSQL, sign-in (GoTrue), file storage and the REST API. The app relies on Supabase Auth, Storage and row-level security, so **plain PostgreSQL on its own is not enough**. Use one of these:
   - **Self-hosted Supabase**, using Supabase's official Docker set-up (<https://supabase.com/docs/guides/self-hosting/docker>). Everything stays on your servers.
   - **A Supabase cloud project** in a region your ethics or data-protection rules allow. Only the web app is self-hosted.

Rough sizing for a lab: 2 vCPU, 4 GB RAM and 40 GB disk runs self-hosted Supabase and the app together. Video is what uses up disk and bandwidth (see [`LIMITS.md`](LIMITS.md)).

## 1. Set up Supabase

**Self-hosted:** follow Supabase's Docker guide. Before going live, change every default secret (JWT secret, anon/service keys, dashboard password, Postgres password). Put Supabase behind HTTPS, for example with Caddy, Traefik or nginx with Let's Encrypt.

**Cloud:** create a project and note its URL and publishable key (**Project Settings → API Keys**).

## 2. Apply the database migrations

Run every file in `supabase/migrations/` **in filename order**. They create the tables, row-level security policies, database functions and the private `media` storage bucket. Use one of these:

- **Supabase CLI:** `npx supabase link --project-ref YOUR-REF` and then `npx supabase db push`. For self-hosted, use `npx supabase db push --db-url postgres://postgres:PASSWORD@HOST:5432/postgres`.
- **SQL editor** (Supabase Studio): paste each file in order and run it.
- **psql:** `for f in supabase/migrations/*.sql; do psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"; done`

When you update the app later, apply only the new migration files, again in order. Migrations are never edited after release.

## 3. Configure sign-in

In **Authentication**:

- **URL Configuration:** set the Site URL to your app's address (e.g. `https://research.example.edu`) and add `https://research.example.edu/auth/callback` as a redirect URL.
- **SMTP:** add your institution's mail server. Without it, confirmation and password-reset emails are not delivered reliably.
- **Email templates:** change the confirmation and reset links to the `token_hash` form so that links work in any browser (see `KNOWN_ISSUES.md`, issue 1):
  - Confirm signup: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=email`
  - Reset password: `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=recovery`

## 4. Run the web app

The app needs only two settings, and both are public: the Supabase URL and the publishable (anon) key. It never needs the service-role key. Next.js builds these two values into the browser code, so **set them when building, and rebuild if they change**.

### With Docker Compose

```bash
cp .env.example .env
```

Edit `.env` to fill in the two values, then build and start the container:

```bash
docker compose up -d --build
```

The app listens on port 3000. Put it behind your HTTPS reverse proxy.

### With Docker only

```bash
docker build --build-arg NEXT_PUBLIC_SUPABASE_URL=https://supabase.example.edu --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_KEY -t research-platform .
```

```bash
docker run -d -p 3000:3000 --restart unless-stopped research-platform
```

### Without Docker

Put the two values in `.env.local` (or export them), then install and build:

```bash
npm ci
```

```bash
npm run build
```

The build creates a self-contained server in `.next/standalone`. Copy the static files into it, then start it:

```bash
cp -r .next/static .next/standalone/.next/static
```

```bash
PORT=3000 HOSTNAME=0.0.0.0 node .next/standalone/server.js
```

Use a process manager (systemd, pm2) to keep it running. `npm start` (`next start`) is not the right command with this standalone build.

## 5. Check it works

1. Open the app, create an account, confirm the email and sign in.
2. Create a project and a study, publish it, and open its **test link**.
3. Take part once, then check **Participants & data** and **Analytics**, and download the CSV.

## Optional AI assistant

The assistant is off unless you add an Anthropic API key to the **server** environment. This is a runtime setting, so no rebuild is needed:

- `ANTHROPIC_API_KEY`: from the Claude Console. On Vercel, add it under **Settings → Environment Variables** as a **Secret**, without a `NEXT_PUBLIC_` prefix, then redeploy.
- `AI_DAILY_LIMIT` (optional): requests per researcher per 24 hours, 30 by default.

The host pays for usage. It uses Claude Opus 5.5, with Anthropic's automatic fallback if a request is declined. Only the study text being worked on is sent, never participant data. The `ai_requests` table records only the request kind and token counts.

## Changing limits

Upload size, blocks per study and questions per page live in `src/config/platform.ts`. The storage bucket's own size limit is set in the foundation migration. On self-hosted Supabase, raise both, together with the storage server's `FILE_SIZE_LIMIT`. The platform's name is in the same config file and in `messages/*.json` (`common.platformName`).

## Operating it

- **Backups:** back up PostgreSQL every day (`pg_dump`, or your provider's snapshots) and the storage volume that holds uploaded media. Test a restore before you collect real data.
- **Updates:** pull the new version, apply any new migrations, then rebuild and restart the app. Read `DECISIONS.md` and the commit history for anything that changes stored data.
- **Security:** keep the Supabase service-role key and database password out of the app and out of version control. Keep the server and Supabase images updated.
- **Rate limiting:** the participant API's limiter counts per app process. If you run several copies behind a load balancer, add a limit at the proxy as well (see `LIMITS.md`).
- **Data protection:** you are the data controller. Decide your retention period, put it in your consent text, and delete studies (which deletes their data) when it ends.
