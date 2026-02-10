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

### Lighthouse Targets

| Metric | Target |
|--------|--------|
| Performance | ≥85 |
| Accessibility | ≥90 |
| TBT | ≤100ms |
| CLS | 0 |

---

