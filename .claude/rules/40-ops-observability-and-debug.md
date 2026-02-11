---
paths:
  - "scripts/**"
  - "docs/ops/**"
  - "docs/runbooks/**"
  - "web/vercel.json"
  - "web/src/app/api/cron/**"
  - "web/src/lib/digest/**"
  - "web/src/lib/email/**"
---

# Ops, Observability, and Debug Rules

This file contains production debugging, observability, and operator command guidance.

## Vercel API Access (IMPORTANT)

**The repo agent has direct access to Vercel deployment logs and status via the Vercel REST API.**

### Available Capabilities

| Capability | API Endpoint | Status |
|------------|--------------|--------|
| List deployments | `GET /v6/deployments` | ✅ Working |
| Deployment status | `GET /v13/deployments/{id}` | ✅ Working |
| Build logs | `GET /v3/deployments/{id}/events` | ✅ Working |
| Project info | `GET /v9/projects` | ✅ Working |
| Runtime logs | Axiom CLI (`axiom query`) | ✅ Working (via Axiom) |

### How to Use

The agent can query Vercel directly to debug production issues:

```bash
# Get latest deployment
curl -s "https://api.vercel.com/v6/deployments?limit=1" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '.deployments[0]'

# Get deployment status
curl -s "https://api.vercel.com/v13/deployments/{deployment_id}" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '{readyState, url, createdAt}'

# Get build logs
curl -s "https://api.vercel.com/v3/deployments/{deployment_id}/events" \
  -H "Authorization: Bearer $VERCEL_TOKEN" | jq '.[].text'
```

### Token Location

The Vercel API token is available in the conversation context. If the agent needs to debug production issues:
1. Query deployment status to confirm latest deploy
2. Check build logs for compilation errors
3. Test endpoints directly with `curl`
4. Query runtime logs via `axiom query` for function errors, request details, and console output

### Runtime Logs (via Axiom Drain)

Runtime logs (function invocations, errors, console output) are available via Axiom.

**Infrastructure:**
- Vercel Log Drain → Axiom dataset `vercel-runtime` (configured in Vercel Dashboard → Project Settings → Log Drains)
- Dataset receives: function invocations, edge requests, build logs, static file requests
- Retention: dataset policy (currently 7 days on `vercel-runtime`)

**Verified working (2026-02-11):**
- `axiom auth status axiom` returns active login.
- `axiom query "['vercel-runtime'] | limit 1" --format table` returns runtime rows.
- Direct drain ingest returned `HTTP 200` with `{"ingested":1,"failed":0}` and query confirmed the record.

**How to Query (CLI-first):**

```bash
# Authenticate (one-time, token stored in ~/.axiom/auth)
axiom auth login

# List available datasets
axiom dataset list

# Recent errors (last 1 hour)
axiom query "['vercel-runtime'] | where level == 'error' | sort by _time desc | take 50"

# Specific route errors
axiom query "['vercel-runtime'] | where path == '/api/my-events' and status >= 500 | sort by _time desc | take 20"

# Search by request ID (from Vercel dashboard or error reports)
axiom query "['vercel-runtime'] | where ['vercel.request_id'] == 'iad1::xxxxx' | sort by _time desc"

# Tail logs in real-time (streaming)
axiom query "['vercel-runtime'] | where _time > ago(5m)" --stream

# Function duration analysis
axiom query "['vercel-runtime'] | where type == 'function' | summarize avg(duration) by path | sort by avg_duration desc | take 10"
```

**Drain token smoke test (copy/paste safe):**

```bash
setopt interactivecomments
AXIOM_DRAIN_DATASET='vercel-runtime'
AXIOM_ORG_ID='denver-songwriters-collective-q71x'
export AXIOM_DRAIN_DATASET AXIOM_ORG_ID
read -s AXIOM_DRAIN_TOKEN
echo
export AXIOM_DRAIN_TOKEN
printf '{"source":"local-terminal","message":"axiom drain token smoke test","_time":"%s"}\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > /tmp/axiom-smoke.ndjson
curl -i -sS "https://api.axiom.co/v1/datasets/${AXIOM_DRAIN_DATASET}/ingest" -H "Authorization: Bearer ${AXIOM_DRAIN_TOKEN}" -H "X-AXIOM-ORG-ID: ${AXIOM_ORG_ID}" -H "Content-Type: application/x-ndjson" --data-binary @/tmp/axiom-smoke.ndjson
axiom query "['${AXIOM_DRAIN_DATASET}'] | where source == 'local-terminal' and message == 'axiom drain token smoke test' | sort by _time desc | limit 5" --format table
```

**APL (Axiom Processing Language) Quick Reference:**

| Operation | Syntax |
|-----------|--------|
| Filter | `where field == 'value'` |
| Time range | `where _time > ago(1h)` |
| Sort | `sort by _time desc` |
| Limit | `take 50` |
| Aggregate | `summarize count() by path` |
| String match | `where path contains '/api/'` |
| Status codes | `where status >= 400 and status < 500` |

**Security Notes:**
- The Axiom API token is stored in `~/.axiom/auth` after `axiom auth login`
- NEVER commit or display the Axiom token in logs/output
- NEVER include the Axiom ingest endpoint URL in code or docs (it's configured in Vercel Dashboard only)
- Dataset is read-only for debugging; write access is via the drain only

**When to Use:**
1. Production 500 errors — query by path + status
2. Silent failures — search for specific request IDs
3. Performance issues — aggregate duration by route
4. User-reported bugs — filter by time window + path

---

## Chrome Browser Integration (for Production Testing)

**The repo agent can control a Chrome browser to test production websites, verify deployments, and debug UI issues.**

### Prerequisites

| Requirement | Minimum Version |
|-------------|-----------------|
| Claude Code CLI | 2.0.73+ |
| Claude in Chrome extension | 1.0.36+ |
| Google Chrome | Latest |
| Claude Plan | Pro, Team, or Enterprise |

### How to Launch

```bash
# Start Claude Code with Chrome integration
claude --chrome

# Or enable within an existing session
/chrome
```

### Available Capabilities

| Capability | Description |
|------------|-------------|
| Navigate pages | Open URLs, click links, use back/forward |
| Click & type | Interact with buttons, forms, inputs |
| Read console | Access browser console logs and errors |
| Take screenshots | Capture current page state |
| Record GIFs | Create recordings of browser interactions |
| Read DOM | Extract text, check for elements, verify content |
| Multi-tab | Work across multiple browser tabs |
| Authenticated sites | Access sites you're logged into (Gmail, Notion, etc.) |

### Common Investigation Patterns

**Verify a deployment is live:**
```
Go to https://coloradosongwriterscollective.org/events/words-open-mic/display?tv=1
Check if the page contains "SCAN FOR HAPPENING DETAILS"
Report PASS if found, FAIL if not
```

**Test a specific user flow:**
```
1. Go to https://coloradosongwriterscollective.org/happenings
2. Click on the first event card
3. Find and click the "RSVP" button
4. Report any console errors
```

**Check link generation:**
```
Go to https://coloradosongwriterscollective.org/events/words-open-mic/lineup
Find the "Open TV Display" button
Click it and report the exact URL it navigates to
Confirm whether the URL includes tv=1 parameter
```

**Debug with console logs:**
```
Open the event detail page and check the console for any errors
Filter for warnings containing "hydration" or "undefined"
```

### When to Use Chrome Integration

| Scenario | Use Chrome? |
|----------|-------------|
| Verify client-rendered content | ✅ Yes (WebFetch only sees initial HTML) |
| Test button/link behavior | ✅ Yes |
| Check authenticated pages | ✅ Yes |
| Debug JavaScript errors | ✅ Yes |
| Verify API responses | ❌ No (use curl) |
| Check static HTML content | ❌ No (use WebFetch) |
| Read server logs | ❌ No (use Axiom) |

### Limitations

- **Chrome only** — Not supported on Brave, Arc, or other browsers
- **No headless mode** — Requires visible browser window
- **Modal blockers** — JS alerts/confirms block commands (dismiss manually)
- **WSL not supported** — Use native macOS/Windows/Linux

### Troubleshooting

| Issue | Solution |
|-------|----------|
| "Extension not detected" | Verify extension v1.0.36+, restart Chrome, run `/chrome` → "Reconnect" |
| Commands not working | Check for modal dialogs blocking the page |
| Version too old | Run `claude update` (requires 2.0.73+) |

**Documentation:** https://code.claude.com/docs/en/chrome

---

## Commands

```bash
# Development
cd web && npm run dev

# Build
cd web && npm run build

# Lint
cd web && npm run lint

# Test
cd web && npm run test -- --run

# Full verification (required before merge)
cd web && npm run lint && npm run test -- --run && npm run build

# Generate Supabase types (after schema changes)
npx supabase gen types typescript --project-id oipozdbfxyskoscsgbfq > web/src/lib/supabase/database.types.ts

# Deploy
git add . && git commit -m "your message" && git push
```

---
