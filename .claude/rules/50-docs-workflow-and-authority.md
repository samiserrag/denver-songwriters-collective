---
paths:
  - "docs/**"
---

# Docs Workflow and Authority

This file contains documentation authority and reading-order rules.

## Documentation Hierarchy & Reading Order

**Required reading order for agents:**
1. `.claude/CLAUDE.md` — Repo operations index
2. `docs/PRODUCT_NORTH_STAR.md` — Philosophy & UX laws
3. `docs/CONTRACTS.md` — Enforceable UI/data contracts
4. `docs/theme-system.md` — Tokens & visual system

| Document | Purpose | Authority |
|----------|---------|-----------|
| `docs/PRODUCT_NORTH_STAR.md` | Philosophy & UX laws | Wins on philosophy |
| `docs/CONTRACTS.md` | Enforceable UI behavior | Wins on testable rules |
| `docs/theme-system.md` | Tokens & surfaces | Wins on styling |
| `.claude/CLAUDE.md` | Repo operations index | Wins on workflow |

If something conflicts, resolve explicitly—silent drift is not allowed.

---
