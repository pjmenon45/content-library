# Content Library

Self-hosted content gallery. Entries point to YouTube videos — no video
files touch your server; thumbnail and playback come from YouTube directly.

## Run it locally

```
npm install
cp .env.example .env    # then edit ADMIN_USER / ADMIN_PASS
npm start
```

- `http://localhost:3000` — public gallery
- `http://localhost:3000/admin.html` — add/delete entries + traffic stats
  (prompts for the basic-auth credentials from `.env`)

## What's in here

| File | Job |
|---|---|
| `server.js` | Express app: static files, JSON API, auth, rate limiting, logging |
| `data/content.db` | SQLite file, created on first run. **This is your only copy of the data** — back it up. |
| `public/index.html` | Public gallery, filters via `/api/content` |
| `public/admin.html` | Add/delete content, view traffic stats |
| `.env.example` | Copy to `.env`; holds `PORT` and admin credentials. Never commit `.env` (already gitignored). |
| `deploy/content-library.service` | Example systemd unit for auto-restart on crash/reboot |
| `deploy/Caddyfile.example` | Example reverse proxy config for free auto-renewing HTTPS |

## Security

- `/admin.html` and all write endpoints (`POST`/`DELETE /api/content`) require
  HTTP Basic Auth — credentials come from `.env`, not hardcoded.
- `helmet` sets standard security headers (clickjacking, MIME-sniffing, etc).
- `/api/*` is rate-limited: 100 requests / 15 min per IP.
- Basic Auth sends credentials base64-encoded, **not encrypted** — it relies
  entirely on the connection being HTTPS. Don't run this publicly over plain
  HTTP. See the Caddy example below for free TLS.

## Analytics

No Google Analytics, no third-party script, no cookies. Every hit to `/` is
logged server-side as (path, referrer, timestamp) — nothing that identifies
a person. View it at the bottom of `/admin.html`, or query directly:

```
curl -u admin:yourpassword http://localhost:3000/api/stats
```

This is enough to answer "is anyone visiting" and "where from." If you
later want session/funnel-level detail, self-hosted options that stay
privacy-respecting: **Plausible** or **Umami** (both open-source, run as a
separate service, embed one small script tag). Not included here since it's
a separate service to stand up — say the word if you want it wired in.

## Deploying

Any host that runs Node.js works — a $5 VPS, Render, Railway, Fly.io.
Node itself is fine handling traffic directly for low/moderate volume; the
main reason to add a reverse proxy (Caddy/nginx) is TLS termination.

1. Copy the project to the server, `npm install --production`.
2. Set up `.env` on the server with real credentials.
3. Make sure `data/` is on **persistent** storage — if your host wipes the
   filesystem on redeploy (common on some PaaS free tiers), you lose all
   content and stats. A VPS with a normal disk doesn't have this problem.
4. Process supervision: use `deploy/content-library.service` (systemd) or
   `pm2 start server.js` — either way, the app should restart itself if it
   crashes or the box reboots.
5. TLS: point a domain at the server, use `deploy/Caddyfile.example` (or
   nginx + certbot if you prefer) to terminate HTTPS and proxy to
   `localhost:3000`.
6. `/healthz` returns `{"status":"ok"}` — point an uptime monitor
   (UptimeRobot, Better Uptime, or your host's built-in one) at it.

## Things intentionally left out

- **User accounts / login system** — one shared admin credential is enough
  for a single-operator site. If multiple people need separate logins or
  roles, that's a bigger addition (say if you want it).
- **CDN** — not needed; you're not serving video files, and static
  HTML/CSS/JS is small. Add Cloudflare in front later if traffic grows.
- **Search** — filtering by category/topic covers this app's scale. A
  free-text search box is a small addition if the library grows past a
  page or two.
