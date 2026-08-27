# Deploying MedPilot

Reproducible staging deployment. Every step is a command; nothing here relies
on a manual change made once in a console and forgotten.

## Environments

Three environments, each fully independent. Nothing is shared — not a
database, not a bucket, not a secret, not an SMTP account.

| | development | staging | production |
| --- | --- | --- | --- |
| Database | local Postgres :5433 | own instance | own instance |
| Storage | local disk | own S3 buckets | own S3 buckets |
| Email | `./var/outbox` | own SMTP account | own SMTP account |
| Purchases | mock driver | store sandbox | store production |
| Push | console | Expo | Expo |
| Secrets | `.env` (git-ignored) | platform secret store | platform secret store |

**Staging must never be pointed at a production database or bucket.** The two
environments use different credentials, so a copy/paste mistake fails to
authenticate rather than reading live patient data.

The API refuses to boot in staging or production on a development driver. A
misconfigured deploy stops immediately and names every offending variable,
instead of running and silently sending no email.

## Pipeline

Run in order. Any failure stops the deploy.

```bash
# 1. Install exactly what the lockfile pins
npm ci

# 2. Type check
npm run typecheck

# 3. Tests (needs TEST_DATABASE_URL; resets that database first)
npm test

# 4. Audit production dependencies
npm audit --omit=dev --audit-level=high

# 5. Build
npm run build

# 6. Migrate — safe to re-run; applies only what is missing
npm run db:migrate

# 7. Start (the boot guard validates configuration here)
node dist/main.js
```

Seed data (`npm run db:seed`) populates the catalog. It refuses to run when
`NODE_ENV=production`; run it once on a fresh staging database.

## Configuration

Set every variable in `.env.example` through the platform's secret store. Never
bake a secret into an image or commit one.

Before the first deploy of an environment, confirm these exist and are distinct
from every other environment:

```
DATABASE_URL  APP_SECRET  JWT_PRIVATE_KEY  JWT_PUBLIC_KEY
API_PUBLIC_URL  WEB_PUBLIC_URL
SMTP_HOST  SMTP_USER  SMTP_PASSWORD  EMAIL_FROM
S3_REGION  S3_BUCKET_PHI  S3_BUCKET_MEDIA  S3_ACCESS_KEY_ID  S3_SECRET_ACCESS_KEY
APPLE_BUNDLE_ID  GOOGLE_PACKAGE_NAME  GOOGLE_SERVICE_ACCOUNT_EMAIL  GOOGLE_SERVICE_ACCOUNT_KEY
EXPO_ACCESS_TOKEN
```

`APP_SECRET` and the JWT keys must be generated per environment:

```bash
openssl rand -hex 32                                    # APP_SECRET
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out jwt.key
openssl rsa -in jwt.key -pubout -out jwt.pub
```

Rotating `APP_SECRET` invalidates outstanding verification links and signed
upload tickets. Rotating the JWT keys signs every session out.

## Verifying a deploy

```bash
# Liveness — the process is up. Never touches a dependency.
curl -fsS https://api-staging.example/healthz

# Readiness — every dependency reachable. 503 when one is not.
curl -fsS https://api-staging.example/readyz
```

`/readyz` reports each dependency as `ok` or `unreachable` without naming a
host, bucket or credential. Point the load balancer at `/readyz` and the
restart probe at `/healthz`, so a database blip drains the instance rather than
restarting it in a loop.

## Smoke test

After `/readyz` is green:

```bash
API=https://api-staging.example
curl -fsS $API/v1/plans > /dev/null && echo "catalog ok"

curl -fsS -X POST $API/v1/auth/register -H 'content-type: application/json' \
  -d '{"email":"smoke@example.com","password":"<generated>","firstName":"Smoke","lastName":"Test","phone":"+14165551234","dateOfBirth":"1990-01-01"}' \
  > /dev/null && echo "registration ok"
```

Then confirm the verification email actually arrives and its link verifies the
account. That is the one check that cannot be made from the server side, and
the one most likely to be misconfigured.

## Database

- **Migrations** are forward-only and idempotent; re-running applies only what
  is missing. Drizzle records applied migrations in the `drizzle` schema.
- **Rollback**: there are no down-migrations. Roll back by deploying the
  previous application version and, if the schema must also move back,
  restoring from a backup. So prefer additive migrations — add a column,
  backfill, switch reads, drop later — which let the previous release keep
  running against the new schema.
- **Indexes and constraints** ship with the migrations, including the unique
  index on `subscriptions.original_transaction_id` that stops one store
  receipt being redeemed by two accounts.
- **Backups** are the platform's responsibility (managed Postgres
  point-in-time recovery, or `pg_dump` on a schedule). Backups contain PHI:
  encrypt them, restrict access, and set a retention period the privacy policy
  actually promises.

> Backups are **not** verified. Nobody has performed a restore of this
> database. Do not treat backup readiness as done until a restore into a scratch
> database has been run end to end and the result checked.

## Mobile builds

Each build targets one environment explicitly:

```bash
EXPO_PUBLIC_ENV=staging EXPO_PUBLIC_API_URL=https://api-staging.example npx expo start
```

A staging or production build with `EXPO_PUBLIC_API_URL` unset, or set to a
non-https URL, throws at startup — so a build can never quietly ship pointing
at a developer's laptop.
