---
paths:
  - "web/**"
  - "components/**"
  - "hooks/**"
  - "lib/**"
  - "types/**"
---

# Web Quality Gates

This file contains non-negotiable quality gates for merge readiness.

## Quality Gates (Non-Negotiable)

All must pass before merge:

| Check | Requirement |
|-------|-------------|
| Lint | 0 errors, 0 warnings |
| Tests | All passing |
| Build | Success |

**Current Status (GTM-3):** Lint warnings = 0. All tests passing (3650). Intentional `<img>` uses (ReactCrop, blob URLs, markdown/user uploads) have documented eslint suppressions.

## Codex Vitest Workaround

In Codex sandbox sessions, Vitest's default isolation mode may fail before tests load with an error like:

```text
EPERM: operation not permitted, mkdir '.../web/.tmp/<random>/client'
```

Use this command shape for focused test runs:

```bash
cd web
CODEX_CI= TMPDIR="$PWD/.tmp" npm run test -- --run --pool=threads --isolate=false <test files>
```

Example:

```bash
cd web
CODEX_CI= TMPDIR="$PWD/.tmp" npm run test -- --run --pool=threads --isolate=false \
  src/__tests__/media-embed-normalization.test.ts
```

`--pool=threads --isolate=false` avoids the denied temp `client` directory path while preserving a real Vitest run. Do not treat the default EPERM failure as a repo test failure.

## TypeScript Check Notes

In this repo, `npx tsc --noEmit` may attempt to write `web/tsconfig.tsbuildinfo` because `incremental` is enabled. In sandboxed sessions, prefer:

```bash
cd web
npx tsc --noEmit --incremental false
```

If TypeScript reports duplicate identifiers from `.next/types/routes.d 2.ts`, `.next/types/routes.d 3.ts`, or similar files, remove the generated `.next` directory and rebuild/regenerate types before interpreting those errors as source-code failures:

```bash
rm -rf web/.next
```

### Lighthouse Targets

| Metric | Target |
|--------|--------|
| Performance | ≥85 |
| Accessibility | ≥90 |
| TBT | ≤100ms |
| CLS | 0 |

---
