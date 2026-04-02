# Project Architecture Conventions

This directory contains standardized architecture and coding conventions for fullstack TypeScript applications. These files instruct Claude to generate clean, consistent code across every layer of the stack.

## Convention Files

**Read the relevant file(s) before writing any code or running any deployment.** Use the guide that matches what you are working on — do not skip this step.

| File                   | When to read                                          | Covers                                                              |
| ---------------------- | ----------------------------------------------------- | ------------------------------------------------------------------- |
| `CLAUDE-FRONTEND.md`   | Any frontend work                                     | Components, hooks, state, API calls, Next.js patterns, formatting   |
| `CLAUDE-BACKEND.md`    | Any backend work                                      | Express layers, handlers, repos, services, validation, formatting   |
| `CLAUDE-DATABASE.md`   | Writing or modifying migrations, queries, or schema   | Schema design, migrations, SQL patterns, type mapping               |
| `CLAUDE-STYLING.md`    | Any frontend styling work                             | SCSS modules, CSS custom properties, responsive, typography         |
| `CLOUD-DEPLOYMENT.md`  | Any deployment task                                   | Deploy workflow, env var management, secrets, staging vs production |
| `CLAUDE-MULTI-REPO.md` | Work spanning multiple repos or using parallel agents | Audit-first workflow, prompt minimization, agent batching           |

**Quick reference — which file applies:**

- Writing a React component or page → `CLAUDE-FRONTEND.md` + `CLAUDE-STYLING.md`
- Writing an Express route, service, or repo → `CLAUDE-BACKEND.md`
- Writing a BullMQ worker → `CLAUDE-BACKEND.md`
- Adding or changing a DB table or migration → `CLAUDE-DATABASE.md`
- Deploying services, setting env vars, or configuring storage → `CLOUD-DEPLOYMENT.md`
- Applying a change across multiple repos or spawning parallel agents → `CLAUDE-MULTI-REPO.md`

## Stack

- **Frontend:** Next.js (App Router) deployed to Vercel
- **API:** Express + TypeScript deployed to Railway
- **Database:** PostgreSQL (with pgvector where needed)
- **Auth:** Supabase Auth via `@supabase/ssr`
- **Queue/Cache:** Redis + BullMQ (where needed)
- **LLM:** Anthropic Claude API
- **Monorepo:** `packages/api`, `packages/worker`, `packages/web`, `packages/common`

## Conventions

- **Commit after every task** — each completed task gets its own commit. Do not batch multiple tasks into a single commit.
- **Branch per task** — every task gets its own branch off `main`. Once the task is complete and tests pass, merge into `main` and delete the branch.
- Follow the convention files exactly — consistency across the codebase is more important than individual preference.
