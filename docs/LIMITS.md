# Limits and running costs

Limits exist only to keep a free hosted service stable. They apply equally to everyone. Self-hosters can change them in `src/config/platform.ts` and the migration's storage bucket settings.

| Limit | Value | Why |
|---|---|---|
| Upload size | 50 MB per file | Supabase free-tier storage (1 GB total) and bandwidth (5 GB/month egress). |
| Blocks per study | 300 | Keeps the participant page fast on phones. |
| Questions per page | 200 | Same. |
| Participant API | 20 session starts and 240 answers per minute per IP address, per server instance | Blunts scripted abuse. On serverless hosting (Vercel) each instance counts separately, so this is a soft limit. A shared limiter (e.g. Postgres or Redis) is a later improvement. |

## What costs money

The free allowances below are the ones this guide was written against and have not been re-checked against live pricing. They change, so check the providers' pricing pages before you plan data collection.

| Resource | Free allowance | What uses it |
|---|---|---|
| Supabase database | 500 MB | Sessions, answers and behavioural events |
| Supabase file storage | 1 GB | Uploaded images, video and audio |
| Supabase egress (bandwidth) | 5 GB / month | Mostly media sent to participants |
| Vercel (Hobby) | Generous for this app | Page and API requests. Media is not served by Vercel. |

### Rough sizes per participant

These are estimates from the table layouts (about 300 bytes per stored event including indexes), not measurements. Check **Database → Usage** in Supabase on a pilot study.

| Study type | Events per session | Database per 1,000 participants |
|---|---|---|
| Questionnaire only | 10–30 | 5–15 MB |
| Media exposure (images or video) | 30–80 | 15–35 MB |
| Shopping village or online shop | 100–300 | 40–120 MB |

So the free database holds roughly 4,000–40,000 sessions, depending on the design. Turn off event groups you do not need under **Settings → Behavioural events to record** to save space.

### Media is the main cost

- **Bandwidth:** every participant downloads each media file they see. A 10 MB video shown to 400 participants is about 4 GB, close to the free monthly allowance. Images are much cheaper: compress them on upload, which the media library offers.
- **Rules of thumb:** keep videos under 15–30 seconds at 720p H.264 (2–5 MB), and images under 300 KB. For large video studies, use a paid plan or self-host.
- **Pilot first:** run 10–20 test sessions, then check Supabase's usage page and multiply.

### Other things to know

- **Free projects pause** after a week of inactivity on Supabase's free plan. A paused project does not accept participants. Open the dashboard before a data-collection period, or use a paid plan for long studies.
- **Exports and analytics** read all of a study's sessions each time. That is fine for thousands of sessions; for very large studies, export less often.
- **No background jobs** run on the hosted service, so nothing costs money while no one is using it.

Self-hosting removes the shared limits ([`SELF_HOSTING.md`](SELF_HOSTING.md)), but the host becomes responsible for backups, security updates and email delivery.
