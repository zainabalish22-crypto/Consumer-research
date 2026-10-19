# Limits and running costs

Limits exist only to keep a free hosted service stable. They apply equally to everyone. Self-hosters can change them in `src/config/platform.ts` and the migration's storage bucket settings.

| Limit | Value | Why |
|---|---|---|
| Upload size | 50 MB per file | Supabase free-tier storage (1 GB total) and bandwidth (5 GB/month egress). |
| Blocks per study | 300 | Keeps the participant page fast on phones. |
| Questions per page | 200 | Same. |
| Participant API | 20 session starts and 240 answers per minute per IP address, per server instance | Blunts scripted abuse. On serverless hosting (Vercel) each instance counts separately, so this is a soft limit. A shared limiter (e.g. Postgres or Redis) is a later improvement. |

## What costs money

- **Video bandwidth** is the main cost. A 10 MB video watched by 400 participants is ~4 GB of egress, close to the Supabase free monthly allowance. Compress video (720p, H.264, short clips) or host it on a dedicated video service for large studies.
- **Database**: the Supabase free tier (500 MB) holds many thousands of sessions of questionnaire data.
- **Free projects pause** after a week of inactivity on Supabase's free plan. Running studies keep them awake; check before a data-collection period.

Self-hosting (Phase 5 documentation) removes these limits but makes the host responsible for backups and security updates.
