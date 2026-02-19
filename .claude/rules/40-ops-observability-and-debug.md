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

**Axiom Field Names (vercel-runtime dataset):**

The dataset uses `proxy.*` prefixed field names. **Always use bracket notation** for dotted fields:

| Field | Description | Example |
|-------|-------------|---------|
| `['proxy.method']` | HTTP method | `'PATCH'` |
| `['proxy.path']` | Full request URL path | `'/api/my-events/...'` |
| `['proxy.statusCode']` | HTTP response status | `403` |
| `['proxy.host']` | Request hostname | `'coloradosongwriterscollective.org'` |
| `['proxy.referer']` | Referer URL | `'https://...'` |
| `['proxy.userAgent']` | User agent (array) | `['Mozilla/...']` |
| `['proxy.clientIp']` | Client IP address | `'174.51.68.5'` |
| `path` | Vercel route pattern or `/_middleware` | `'/api/my-events/[id]'` |
| `deploymentId` | Vercel deployment ID | `'dpl_...'` |
| `message` | Function stdout: START/END/REPORT + `console.log`/`console.error` output | |
| `level` | `'info'`, `'warning'`, `'error'` | |
| `statusCode` | Same as `proxy.statusCode` | `403` |

**Common Axiom Queries:**

```bash
# 403/500 errors on a specific API route
axiom query "['vercel-runtime'] | where ['proxy.method'] == 'PATCH' and ['proxy.path'] contains 'my-events' and ['proxy.statusCode'] == 403 | sort by _time desc | limit 5" --format json

# All requests from a specific deployment
axiom query "['vercel-runtime'] | where deploymentId == 'dpl_xxx' | sort by _time desc | limit 10" --format json

# Check if middleware is intercepting a route
axiom query "['vercel-runtime'] | where path == '/_middleware' and ['proxy.path'] contains 'my-events' | sort by _time desc | limit 5" --format json

# Console output from a specific function invocation
axiom query "['vercel-runtime'] | where message contains 'PATCH /api/my-events' | sort by _time desc | limit 5" --format json
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
| Status codes | `where ['proxy.statusCode'] >= 400 and ['proxy.statusCode'] < 500` |
| Dotted fields | Always use bracket notation: `['proxy.method']` |

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

### Chrome MCP for API Debugging (IMPORTANT)

When a user reports a client-side error (e.g., 403, 500) and you can't determine the cause from server logs:

1. Use `javascript_tool` to execute `fetch()` from the user's authenticated browser session
2. This captures the **full response body** which often contains the actual error message
3. Server logs may only show the status code, not which guard returned it

**Example — diagnosing a 403:**
```javascript
// Execute in the browser via javascript_tool
(async () => {
  const res = await fetch('/api/my-events/EVENT_ID', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title: 'test' })
  });
  const body = await res.text();
  window.__debugResult = { status: res.status, body: body.substring(0, 1000) };
  return window.__debugResult;
})()
```

This approach revealed the Feb 2026 403 bug: the response was `{"error":"Only admins can update media embed fields."}` — a completely different guard from what the investigation assumed.

---

## Supabase Direct DB Access

The agent can query the production database directly via the Supabase Management API:

```bash
# Get and decode the token
RAW_TOKEN=$(security find-generic-password -s "Supabase CLI" -a "supabase" -w)
DECODED=$(echo "$RAW_TOKEN" | sed 's/go-keyring-base64://' | base64 -d)

# Query production DB
curl -s -X POST "https://api.supabase.com/v1/projects/oipozdbfxyskoscsgbfq/database/query" \
  -H "Authorization: Bearer ${DECODED}" \
  -H "Content-Type: application/json" \
  -d '{"query": "SELECT id, host_id, visibility FROM events WHERE id = '\''EVENT_UUID'\'' "}'
```

Use this to verify data state when debugging permission/RLS issues — don't guess what the DB contains.

---

## Known Debugging Pitfalls

### Multiple 403 guards in the same route

API routes may have **multiple points** that return `{ status: 403 }`. When debugging a 403:
1. **Do NOT assume** which guard is returning the error
2. **Read the response body** — each guard returns a different error message
3. Use Chrome MCP `javascript_tool` + `fetch()` to see the actual response body from the user's session
4. Check Axiom `message` field for console.log/console.error output

**Example (Feb 2026 incident):** `/api/my-events/[id]` PATCH handler had TWO 403 paths:
- `canManageEvent()` → `{ error: "Forbidden" }`
- Media embed admin guard → `{ error: "Only admins can update media embed fields." }`

The investigation spent hours debugging `canManageEvent` when the actual 403 came from the media embed guard (which triggers when the form sends empty `youtube_url`/`spotify_url` strings).

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
