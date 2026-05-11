# Infrastructure Backlog

CI, deployment, operational, and scaling concerns.

**How this file is used:** Append when CI, deployment, or operational issues are discovered. Move to Closed when resolved. Never delete — lineage matters.

Cross-reference: security findings at `../security/README.md`, product features at `../features/README.md`.

---

## Active

### OBS-19 — Integration and unit tests do not run in CI

**Status:** Active
**Discovered in:** Session 2026-05-11 — review of `.github/workflows/ci.yml`
**File:** `.github/workflows/ci.yml`

#### Description
CI runs only `pnpm typecheck` and `pnpm registry:check`. The Vitest unit suite (`tests/unit/`) and integration suite (`tests/integration/`) never run automatically on push or PR. A regression in access control, auth logic, or projection can merge to `main` without any automated signal.

#### Why deferred
Integration tests require a live Postgres instance. Adding one to GHA needs a `services: postgres` container block and `DATABASE_URI` wiring. Not complex but not done.

#### Suggested fix shape
Add a second job to `ci.yml` after `typecheck-and-registry-drift`:

```yaml
test:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:17-alpine
      env:
        POSTGRES_USER: payload
        POSTGRES_PASSWORD: ci-password
        POSTGRES_DB: payload
      options: >-
        --health-cmd pg_isready
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5
      ports:
        - 5432:5432
  steps:
    - uses: actions/checkout@v5
    - uses: pnpm/action-setup@v4
      with: { version: 10.28.2 }
    - uses: actions/setup-node@v4
      with: { node-version: 22, cache: pnpm }
    - run: pnpm install --frozen-lockfile
    - run: pnpm test
      env:
        PAYLOAD_SECRET: ci-test-secret
        DATABASE_URI: postgres://payload:ci-password@localhost:5432/payload
```

The test setup overrides `DATABASE_URI` to `payload_test` automatically — the Postgres service just needs to exist so the override can connect.

---

### OBS-28 — `pnpm lint` is non-functional (no ESLint config)

**Status:** Active
**Discovered in:** Session 2026-05-11 (during FE-1+FE-4+FE-8 verification gate)
**File:** `package.json` `scripts.lint`, no `.eslintrc*` / `eslint.config.*` at repo root

#### Description
`pnpm lint` invokes `next lint`, which prompts interactively to scaffold an ESLint config (the project has none). The command hangs waiting for input and exits 1 in non-TTY contexts. CLAUDE.md lists `pnpm lint` as a gate to run before completion claims, but the script currently cannot be run — the gate is dead.

#### Why deferred
Pre-existing. The CI workflow already skips lint (only `typecheck` + `registry:check` run), so production hasn't surfaced an actionable lint signal anywhere. Fixing requires choosing an ESLint config strategy (Next.js Strict vs Base vs custom) and aligning with the registry components.

#### Suggested fix shape
1. Decide: adopt Next.js Strict (recommended starting point) or roll a minimal `eslint.config.js`.
2. Run `pnpm dlx next-lint` once interactively to scaffold, then commit the generated config.
3. Add `--max-warnings 0` once the codebase passes clean.
4. Either remove the `lint` reference from CLAUDE.md's verification list or wire lint into CI alongside typecheck.

---

## Closed

*(none yet)*
