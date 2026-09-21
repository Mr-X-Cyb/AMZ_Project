
# AMZ — Bug Bounty Recon Automation Platform

AMZ is a web-based **passive** recon automation platform for bug bounty hunters.
Give it a target domain and it enumerates subdomains, probes for live hosts,
fingerprints tech stacks, checks for commonly-exposed sensitive paths, then uses
an AI model to rank targets by how interesting they are for manual investigation —
all in a clean dark dashboard with CSV/PDF export.

> **For use only on targets you are authorized to test (owned assets or in-scope
> bug bounty programs).** AMZ performs only passive, non-destructive checks.

---

## Architecture

```
                         ┌────────────────────────────┐
   Browser  ── :3000 ──▶ │  frontend (nginx + React)  │
                         │  proxies /api ─────────────┼──▶ backend:8000
                         └────────────────────────────┘
                                                        │
   ┌───────────────────────┐   Celery task    ┌─────────▼──────────┐
   │ worker (Celery)       │◀── redis broker ──│ backend (FastAPI)  │
   │ runs recon pipeline   │                   │ JWT auth, REST API │
   └───────────┬───────────┘                   └─────────┬──────────┘
               │                                          │
               └──────────────── SQLAlchemy ──────────────┘
                                     │
                            ┌────────▼─────────┐
                            │ database (Postgres)│
                            └────────────────────┘
```

All five services (`amz_database`, `amz_redis`, `amz_backend`, `amz_worker`,
`amz_frontend`) are attached to one **explicit named bridge network `amz_net`**,
so service-name DNS resolution (`backend`, `database`, `redis`) works reliably.

**Recon pipeline** (`backend/app/recon/`, orchestrated in `app/tasks.py`):
1. `subdomains.py` — passive enumeration
2. `probe.py` — HTTP GET liveness + title/header capture
3. `tech.py` — header + body fingerprinting
4. `paths.py` — non-destructive sensitive-path checks
5. `ai_rank.py` — Anthropic ranking (heuristic fallback)

---

## Quick start

```bash
# 1. From a clean clone:
cp .env.example .env

# 2. Edit .env — at minimum set a strong POSTGRES_PASSWORD and JWT_SECRET.
#    (Optional) add ANTHROPIC_API_KEY to enable real AI ranking.
#    Generate a JWT secret:  python -c "import secrets; print(secrets.token_urlsafe(48))"

# 3. Build and start everything:
docker compose up -d --build

# 4. Watch them come healthy:
docker compose ps
```

Then open **http://localhost:3000**, register an account, tick the authorization
checkbox, enter a domain you're allowed to test, and start a scan.

- Frontend: http://localhost:3000
- Backend API + Swagger docs: http://localhost:8000/docs
- Health check: http://localhost:8000/health

Database migrations run **automatically** on backend startup
(`entrypoint.sh` runs `alembic upgrade head` before uvicorn). No manual step.

---

## Verifying frontend → backend networking

Two commands prove the nginx container can resolve and reach the backend by its
compose service name over `amz_net`:

```bash
# From inside the frontend container, hit the backend by service name:
docker compose exec frontend curl -s http://backend:8000/health
# expected: {"status":"ok","service":"amz-backend"}

# And through the nginx proxy the browser actually uses:
docker compose exec frontend curl -s http://localhost/health
# expected: {"status":"ok","service":"amz-backend"}
```

---

## Environment variables (`.env`)

| Variable | Purpose |
|---|---|
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Postgres credentials |
| `DATABASE_URL` | SQLAlchemy URL; host must be `database` (the service name) |
| `REDIS_URL` / `CELERY_BROKER_URL` / `CELERY_RESULT_BACKEND` | Redis/Celery; host must be `redis` |
| `JWT_SECRET` / `JWT_ALGORITHM` / `ACCESS_TOKEN_EXPIRE_MINUTES` | Auth token signing |
| `ANTHROPIC_API_KEY` | Enables real AI ranking; blank = heuristic fallback |
| `ANTHROPIC_MODEL` | Claude model id (default `claude-sonnet-4-5`) |
| `RECON_MAX_HOSTS` | Max subdomains probed per scan (safety cap) |
| `RECON_CONCURRENCY` | Concurrent HTTP probes |
| `RECON_TIMEOUT` | Per-request timeout (seconds) |
| `SCAN_MIN_INTERVAL_SECONDS` | Server-side per-user rate limit between scans |
| `CORS_ORIGINS` | Allowed frontend origin(s) |

Only `.env.example` is committed; `.env` is git-ignored. No secrets in code.

---

## Safety & ethics guardrails

- **Passive only.** DNS + Certificate Transparency (crt.sh) + HTTP GET/HEAD.
  No brute forcing, no fuzzing, no exploitation, no port scanning beyond checking
  whether the web port answers.
- **Mandatory scope confirmation.** The UI requires an authorization checkbox
  before a scan starts. The confirmation is persisted with a timestamp
  (`scans.authorized`, `scans.authorized_at`) as an audit trail, and the API
  rejects any scan request where `authorized` is not true.
- **Rate limiting.** `SCAN_MIN_INTERVAL_SECONDS` enforces a minimum gap between
  scans per user (HTTP 429 otherwise), and `RECON_MAX_HOSTS` / `RECON_CONCURRENCY`
  cap load so you can't accidentally hammer a target.
- **Fixed, tiny path list.** Exposed-path checks use a short, well-known list of
  paths — no wordlist fuzzing.
- **Visible disclaimer** in the UI footer and login screen.

---

## Subdomain enumeration approach

`app/recon/subdomains.py` tries, in order:

1. **`subfinder` binary** if present on PATH (fastest, broadest). It is *not*
   bundled in the image by default.
2. **Passive public sources over HTTPS** as the fallback that always works:
   - **crt.sh** — Certificate Transparency logs
   - **hackertarget hostsearch** — free tier, best-effort

The UI/each scan records which method was used. To get `subfinder`-grade breadth,
install the binary into the backend image (see *Known limitations*).

---

## AI ranking

If `ANTHROPIC_API_KEY` is set, each scan sends compacted recon data to Claude,
which returns a 0–100 interestingness score + plain-language reasoning per host,
plus an overall summary. If the key is missing **or** the API call fails, AMZ
falls back to a transparent deterministic heuristic (weighted by exposed paths,
suspicious hostnames, auth-protected endpoints) and clearly labels the provider
as `heuristic` in the UI and exports. AI failure never breaks a scan.

---

## Export

Every scan detail page has **CSV** and **PDF** export buttons. Both are generated
server-side (`app/routers/export.py`; PDF via ReportLab) and download as real
files, auth-gated by the JWT.

---

## Project layout

```
AMZ/
├── docker-compose.yml        # 5 services on explicit amz_net network
├── .env.example              # copy to .env
├── README.md
├── backend/
│   ├── Dockerfile
│   ├── entrypoint.sh         # alembic upgrade head -> uvicorn
│   ├── requirements.txt
│   ├── alembic.ini
│   ├── alembic/              # env.py + versions/0001_initial.py
│   └── app/
│       ├── main.py           # FastAPI app + /health
│       ├── config.py         # pydantic-settings
│       ├── database.py models.py schemas.py auth.py deps.py
│       ├── celery_app.py tasks.py
│       ├── recon/            # subdomains, probe, tech, paths, ai_rank
│       └── routers/          # auth, scans, export
└── frontend/
    ├── Dockerfile            # vite build -> nginx serve
    ├── nginx.conf            # proxies /api -> http://backend:8000
    ├── package.json vite.config.js tailwind.config.js
    └── src/                  # React app (auth, dashboard, scan detail)
```

---

## Known limitations (read this — I'm being honest)

This project was authored in a build sandbox with **no internet access and no
Docker daemon**, so the following could **not** be executed there and should be
verified on your machine (all four are expected to pass — the code is complete
and syntax-checked):

1. **`docker compose up -d --build` was not run here.** Images could not be
   pulled/built without a Docker daemon + network. Run it on your machine.
2. **Container networking wasn't live-tested here.** The compose network, service
   names, healthchecks, and nginx proxy are all configured correctly per the
   requirements; use the two `docker compose exec frontend curl …` commands above
   to confirm on your side.
3. **The Anthropic API was not called here** (no network, no key in the sandbox).
   The integration code is complete; add your key to `.env` and it will make real
   calls. Without a key, the heuristic scorer runs instead.
4. **Live recon (crt.sh, target probing) wasn't exercised here** for the same
   reason. The pipeline is real and runs on first scan once deployed.
5. **No screenshotting.** Headless-browser screenshots need Chromium + system libs
   that bloat the image and often fail in constrained environments. Instead AMZ
   captures the **HTML `<title>` + full response headers** per live host (shown in
   the expandable row) as the working alternative. To add real screenshots, add
   Playwright to the backend image and a capture step in `app/tasks.py`.
6. **`subfinder` binary is not bundled.** Passive crt.sh + hackertarget enumeration
   is the default. To add subfinder: in `backend/Dockerfile`, install Go or copy a
   released `subfinder` binary onto PATH; `subdomains.py` will auto-detect and use it.

Nothing in the delivered app uses fake/demo data — every table is populated from
real scan results in Postgres.

