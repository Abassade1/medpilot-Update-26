/**
 * Baseline settings for every test file, applied before the file loads (jest `setupFiles`).
 * Tests must not depend on a developer's untracked backend/.env: a fresh checkout or CI has none.
 */
process.env.NODE_ENV = "test";
process.env.DATABASE_URL ??= "postgres://medpilot@localhost:5433/medpilot_test";
process.env.API_PUBLIC_URL = "http://127.0.0.1:4100";
process.env.APP_SECRET ??= "test-secret-value-at-least-32-chars-long";
