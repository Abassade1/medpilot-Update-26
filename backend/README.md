# MedPilot API

NestJS + Drizzle + PostgreSQL backend for the MedPilot mobile app.

## Requirements

- Node 20+
- PostgreSQL 15+

No Docker is required. The repo is developed against a project-local Postgres
running on port 5433 with its own data directory, so nothing global is touched.

## Setup

```bash
cd backend && npm install
```

Copy the environment template and generate an app secret:

```bash
cp .env.example .env && printf 'APP_SECRET=%s\n' "$(openssl rand -hex 32)" >> .env
```

`.env.example` documents every variable. It contains no real credentials, and
`.env` is git-ignored.

Point `DATABASE_URL` at your database, then create the schema and seed the
catalog:

```bash
npm run db:migrate && npm run db:seed
```

`npm run db:reset` drops and rebuilds everything. It refuses to run when
`NODE_ENV=production`. The seed script has the same guard.

## Running

```bash
npm run dev
```

The API listens on `PORT` (default 3000). `API_PUBLIC_URL` must match the
address clients actually reach, because signed upload tickets embed it — a
mismatch makes uploads fail with an empty response.

Interactive docs are at `/docs`; the raw document is at `/docs.json`. Both are
generated from the same Zod schemas used to validate requests, so they cannot
drift from the implementation.

## Keys

RS256 signing keys live in `keys/` (git-ignored). In development and test they
are generated automatically on first boot. In staging and production the
process refuses to start unless `JWT_PRIVATE_KEY_PATH` and
`JWT_PUBLIC_KEY_PATH` point at real keys.

## Tests

```bash
npm test
```

Runs against the database named by `TEST_DATABASE_URL`, resetting it first.
Rate limiting is disabled under `NODE_ENV=test` so the suite can drive many
requests from one address.

## Verifying rate limits

Because the limiter is off in tests, check it against a running server instead.
Registration allows 5 attempts per window:

```bash
for i in $(seq 1 7); do curl -s -o /dev/null -w "$i: %{http_code}\n" -X POST http://localhost:3000/v1/auth/register -H 'content-type: application/json' -d "{\"email\":\"rl-$i@example.com\",\"password\":\"Str0ngPassw0rd!\",\"firstName\":\"A\",\"lastName\":\"B\",\"phone\":\"+14165551234\",\"dateOfBirth\":\"1990-01-01\"}"; done
```

Attempts 1–5 return 201 and 6–7 return 429. The counters are in-memory, so
restarting the server clears them.

## Driver seams

Storage, email, AUX, billing, and push each sit behind a driver chosen by an
environment variable, so development runs with no third-party accounts:

| Variable | Development | Production |
| --- | --- | --- |
| `STORAGE_DRIVER` | `local` | `s3` |
| `EMAIL_DRIVER` | `outbox` (writes to `var/outbox`) | `smtp` |
| `AUX_DRIVER` | `deterministic` | `llm` (not implemented — see below) |
| `BILLING_DRIVER` | `mock` | `store` (not implemented) |
| `PUSH_DRIVER` | `console` | `expo` |

Setting `AUX_DRIVER=llm` or `BILLING_DRIVER=store` throws on use rather than
silently degrading; those integrations are blocked on open product decisions.
