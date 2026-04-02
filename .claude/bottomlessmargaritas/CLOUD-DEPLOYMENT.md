# Cloud Deployment Guide

This guide covers deployment best practices for fullstack TypeScript applications using Railway (API/workers/Redis), PostgreSQL (Neon or Railway-managed), Vercel (frontend), and Cloudflare R2 (file storage).

---

## General Rules

- **Always set `NODE_ENV`** — every remote deployment must have `NODE_ENV=production` (or `NODE_ENV=staging` for staging environments). Never leave it unset or defaulted.
- **Never deploy to production without a staging smoke test** — deploy to staging first, verify core flows, then promote.
- **One service per Railway project** — keep API, worker, Redis, and Postgres as separate Railway services within one project. This isolates restarts and scaling.
- **Commit after every task, deploy after every phase** — don't defer deploys.

---

## Security Rules — Non-Negotiable

These are hard rules. No exceptions, no shortcuts to facilitate a deploy.

### TLS / SSL

- **Never set `rejectUnauthorized: false`** in any database, Redis, or HTTPS client connection config. This disables certificate verification and exposes connections to man-in-the-middle attacks.
- **Never set `NODE_TLS_REJECT_UNAUTHORIZED=0`** as an environment variable. Same risk.
- **Never use `checkServerIdentity: () => {}`** or any no-op TLS identity check.
- The correct pattern for `pg` Pool SSL in production:

  ```typescript
  ssl: isProduction()
    ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" }
    : { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED === "true" },
  ```

  This defaults to **strict TLS in production** and only disables it if `DATABASE_SSL_REJECT_UNAUTHORIZED=false` is explicitly set — a deliberate, visible override.

### Secrets

- **Never commit `.env` files** containing real credentials. `.env` is for local dev only and must be in `.gitignore`.
- **Never hardcode API keys, passwords, or tokens** in source code. Use a secret manager in production, `.env` files locally.
- **Never set sensitive API keys as Railway env vars directly** — use a secret manager (e.g., GCP Secret Manager, AWS Secrets Manager, or Doppler). Only the secret manager credentials go in Railway.

### CORS

- **Never use `origin: '*'` with `credentials: true`** — this allows any site to make credentialed requests.
- `CORS_ORIGIN` must always be set to the exact Vercel production URL in Railway. Using `localhost` in production is a misconfiguration.
- Use the team-scoped stable URL (`{project-name}.vercel.app`) as the `CORS_ORIGIN` value — never a preview/hash URL.

---

## Railway

### Project Structure

```
Railway Project
├── api          — Express/TypeScript server (packages/api)
├── worker       — BullMQ worker (packages/worker, if needed)
├── postgres     — Managed Postgres (or use Neon for the DB)
└── redis        — Managed Redis
```

### Deploying a Service

1. Link the service to the repo via the Railway dashboard or CLI.
2. Set the root directory to the package being deployed (e.g., `packages/api`).
3. Set the start command explicitly — e.g., `node dist/index.js` or `npm run start`.
4. Set `NODE_ENV=production` (or `staging`) — **this must always be set explicitly**.
5. Configure all required env vars before the first deploy (see env var checklist below).
6. Deploy via the Railway dashboard, CLI (`railway up`), or MCP tool.

### Environment Variables — Required for Every Service

| Variable       | Value                        | Notes                                                 |
| -------------- | ---------------------------- | ----------------------------------------------------- |
| `NODE_ENV`     | `production` or `staging`    | **Always set. Never omit.**                           |
| `PORT`         | Railway injects this         | Do not hardcode                                       |
| `DATABASE_URL` | PostgreSQL connection string | Use pooled URL for the API, direct URL for migrations |
| `REDIS_URL`    | Redis URL                    | Required if using BullMQ or caching                   |

Add app-specific vars (e.g., `CLOUDFLARE_ACCOUNT_ID`, `CORS_ORIGIN`) directly as Railway env vars. Store sensitive API keys in a secret manager.

### Railway Workflow

```
# Check current projects
railway list-projects

# Check service logs after a deploy
railway get-logs --serviceId <id>

# Set env vars
railway set-variables --serviceId <id> --variables '{"NODE_ENV":"production"}'

# List current variables to verify
railway list-variables --serviceId <id>
```

### Healthcheck & Zero-Downtime

- Expose a `GET /health` endpoint on every API service that returns `200 { status: "ok" }`.
- Configure Railway's healthcheck path to `/health`.
- Railway will wait for the healthcheck to pass before routing traffic to the new deploy.
- **Workers also need a health server** — BullMQ worker processes must expose a minimal HTTP server on `process.env.PORT`, or Railway's healthcheck will mark the service as failed. See `CLAUDE-BACKEND.md` → Worker Pattern for the implementation.

### Per-Service Dockerfiles

Monorepo apps with both an API and a worker use separate Dockerfiles to control which entrypoint is run:

```
Dockerfile          # API service
Dockerfile.worker   # Worker service
```

**Important:** The `RAILWAY_DOCKERFILE_PATH` environment variable does **not** reliably override which Dockerfile Railway uses. Instead, modify `railway.toml` to specify the Dockerfile path before deploying:

```toml
# railway.toml (set for worker deploy, then restore for API)
[build]
dockerfilePath = "Dockerfile.worker"
```

### Database Migrations

- Run migrations **before** the new API code goes live.
- Use a Railway one-off job or a `prestart` script: `npm run migrate && node dist/index.js`.
- Never run migrations from the worker service — API service owns schema changes.
- Keep `DATABASE_URL` (pooled) and `DATABASE_MIGRATION_URL` (direct) as separate vars if your provider distinguishes them.

---

## Secret Management

Sensitive API keys should be stored in a secret manager and fetched at process startup. This enables key rotation without redeployment.

### How It Works

Each service loads secrets at startup via a secrets config module:

- In **development** (`NODE_ENV !== "production"`): skipped — use `.env` file values
- In **production** without secret manager credentials: logs a warning and falls back to env vars
- In **production** with credentials configured: fetches all secrets before any app code initializes

`index.ts` uses dynamic `import()` for all app code so secrets are populated in `process.env` before any API clients are instantiated.

### Local Development

Secrets are not fetched from the secret manager in local dev. Set values directly in the package's `.env` file.

---

## Vercel (Frontend)

### Deploying a Frontend

```bash
cd packages/web   # or web-client/
vercel deploy --prod --yes
```

- Always deploy from the frontend package directory — never the repo root
- Set `NEXT_PUBLIC_API_URL` in Vercel env vars (project settings) pointing to the Railway API service URL

### Naming Convention

The Vercel project name should match the app or repo name for consistency. If a project was created with a wrong name, rename it via the Vercel dashboard or REST API.

---

## Cloudflare R2 (Document / File Storage)

All user-uploaded files and generated documents should be stored in Cloudflare R2 (or equivalent object storage), not on the Railway filesystem (which is ephemeral).

### Required Variables (API service)

| Variable                          | Notes                                                    |
| --------------------------------- | -------------------------------------------------------- |
| `CLOUDFLARE_ACCOUNT_ID`           | From Cloudflare dashboard                                |
| `CLOUDFLARE_R2_BUCKET`            | Bucket name                                              |
| `CLOUDFLARE_R2_ACCESS_KEY_ID`     | R2 API token — use separate tokens per environment       |
| `CLOUDFLARE_R2_SECRET_ACCESS_KEY` | R2 API token secret (store in secret manager)            |
| `CLOUDFLARE_R2_PUBLIC_URL`        | Public bucket URL or custom domain (if bucket is public) |

### Bucket Naming Convention

```
{app-slug}-{environment}
# e.g., my-app-prod, my-app-staging
```

Use separate buckets for production and staging — never share a bucket across environments.

### Access Pattern

- Files are uploaded server-side (API generates a presigned URL or streams directly).
- Never expose R2 credentials to the frontend.
- For private files, generate short-lived presigned URLs server-side and return them to the client.
- For public assets, use the R2 public URL with a custom domain.

---

## Staging vs Production Checklist

Before promoting a staging deploy to production:

- [ ] `NODE_ENV` is set to `production` on all services
- [ ] All env vars are set (no placeholders like `TODO` or empty strings)
- [ ] Migrations have run successfully against the production DB
- [ ] `GET /health` returns 200 on the API service
- [ ] A smoke test of the core flow passes end-to-end
- [ ] Storage bucket is the production bucket, not staging
- [ ] Redis is the production Redis instance
- [ ] Secret manager credentials are set on all services
- [ ] No `console.log` of secrets in logs (check log output after deploy)

---

## Common Mistakes

| Mistake                                             | Fix                                                                      |
| --------------------------------------------------- | ------------------------------------------------------------------------ |
| Forgetting `NODE_ENV`                               | Always set it explicitly — never rely on a default                       |
| Using the same storage bucket for staging and prod  | Use separate buckets per environment                                     |
| Running migrations from the worker                  | Always run from the API service                                          |
| Hardcoding `PORT`                                   | Use `process.env.PORT` — Railway injects it                              |
| Deploying without a healthcheck                     | Add `/health` and configure it in Railway before first production deploy |
| Using the pooled DB URL for migrations              | Use the direct (non-pooled) URL for migrations only                      |
| Setting API keys as Railway env vars                | Put them in a secret manager                                             |
| `rejectUnauthorized: false` in db pool              | Always use the env-var-controlled pattern — see Security Rules above     |
| `CORS_ORIGIN` pointing to `localhost` in production | Set `CORS_ORIGIN` to the Vercel stable URL before first deploy           |
| `CORS_ORIGIN` containing a preview hash URL         | Use the stable project alias, not a per-deployment hash URL              |

---

## Debugging "Failed to fetch" / CORS Errors

When the user reports "Failed to fetch" or a CORS error:

1. **Check server logs first.** The server logs will show the exact rejected origin. This is always faster than testing with curl.
2. **Do not test CORS with curl.** Curl does not enforce CORS — it will always succeed regardless of the server's CORS policy.
3. **Common rejected origins:**
   - `http://localhost:3000` — local dev frontend hitting production API. Add to `CORS_ORIGIN`.
   - Vercel deployment-specific URLs — the CORS config should allow these via regex pattern matching, not exact allowlist.
4. **Fix the `CORS_ORIGIN` env var**, then wait for the service to redeploy.
