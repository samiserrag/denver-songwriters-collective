# Event Ops Agent — Technical Lessons

## Valid event_type values (API contract)
The AI interpreter often generates invalid event types like "gig_performance". The API only accepts these exact strings:
`open_mic`, `showcase`, `song_circle`, `workshop`, `other`, `gig`, `meetup`, `jam_session`, `poetry`, `irish`, `blues`, `bluegrass`, `comedy`

Source: `web/src/lib/events/eventTypeContract.ts`

**Fix**: In the conversational description, explicitly state the event_type value to use, e.g.:
> Event type: gig (use exactly "gig" as the event_type value)

## Chrome MCP limitations
- **zoom action crashes the extension** — avoid entirely. Use regular screenshots instead.
- **upload_image tool** cannot transfer images across tabs or sessions. Screenshot IDs are lost on Chrome restart. "Unable to access message history to retrieve image" is the typical error.
- **Cross-origin image transfer** is blocked by browser security. Cannot fetch Instagram images from CSC page, cannot use BroadcastChannel cross-origin, cannot serve via localhost HTTP (mixed content blocking on HTTPS pages).
- **Clipboard write** is denied on Instagram (permission policy).

## Chrome MCP "Navigation to this domain is not allowed" — diagnosis & fix

This error means the Chrome extension's native bridge cannot communicate with Claude Code. The most common cause is a **stale version path** in the native host wrapper script.

### Root cause
Claude Code upgrades install new versions under `~/.local/share/claude/versions/` and delete old ones. The native host wrapper at `~/.claude/chrome/chrome-native-host` hardcodes a specific version path. After an upgrade, the old binary is gone and the bridge silently fails, causing ALL domains to be rejected.

### Quick diagnosis checklist
1. **Check the wrapper script:**
   ```bash
   cat ~/.claude/chrome/chrome-native-host
   ```
   Look at the `exec` line — does the version path actually exist?

2. **Check available versions:**
   ```bash
   ls ~/.local/share/claude/versions/
   ```

3. **If the version in the wrapper doesn't exist** — that's the problem.

### Fix
The wrapper has been patched to auto-resolve the latest version dynamically (no hardcoded path). If it ever gets overwritten by a Claude Code update back to a hardcoded path, re-apply this fix:

```sh
cat > ~/.claude/chrome/chrome-native-host << 'WRAPPER'
#!/bin/sh
VERSIONS_DIR="$HOME/.local/share/claude/versions"
LATEST=$(ls -v "$VERSIONS_DIR" 2>/dev/null | tail -n 1)
if [ -z "$LATEST" ]; then
  echo '{"error":"No Claude Code version found"}' >&2
  exit 1
fi
exec "$VERSIONS_DIR/$LATEST" --chrome-native-host
WRAPPER
chmod +x ~/.claude/chrome/chrome-native-host
```

### After fixing
- Fully quit Chrome (Cmd+Q) and reopen it.
- Start a new Claude Code conversation.

### Other causes of this error
- **Playwright/Codex conflict**: If Codex is using Playwright to debug the same Chrome instance, the extension's `turnApprovedDomains` set can get poisoned. The extension's `follow_a_plan` permission mode locks navigation to only explicitly approved domains for that session. Close Playwright/Codex, quit Chrome, and restart.
- **Extension permission mode**: The extension stores `lastPermissionModePreference` in local storage. If set to `"follow_a_plan"` or `"allow_for_site"` instead of `"skip_all_permission_checks"`, domain access is more restrictive. Check the extension's sidepanel settings.

## Cover image upload — what works
- Extract image from Instagram via canvas: `drawImage()` on a `<canvas>`, then `canvas.toDataURL()` — this works because Instagram serves images from same-origin CDN.
- Save locally via bash using the extracted data URL or direct CDN URL download.
- **Manual upload by user** is currently the only reliable way to get the image into the CSC cover photo field.
- Always save the flyer to both `~/Downloads/` and `flyers/` with descriptive name: `{venue-slug}-{event-slug}-{date}.jpg`

## Instagram image extraction
```javascript
// Find the post image
const imgs = document.querySelectorAll('img');
const postImg = Array.from(imgs).find(i => i.src && i.src.includes('instagram') && i.width > 400);
// Draw to canvas for data URL
const canvas = document.createElement('canvas');
canvas.width = postImg.naturalWidth || postImg.width;
canvas.height = postImg.naturalHeight || postImg.height;
canvas.getContext('2d').drawImage(postImg, 0, 0);
const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
```

## Venue creation
- When user says "new venue" — use "+ Add new venue..." option in the venue selector, NOT "Custom location (this happening only)"
- Fill all fields: name, address, city/state, phone, website
- The venue selector dropdown may need scrolling to find "+ Add new venue..."
- Host capability and event role are separate:
  - Platform host capability: `approved_hosts` (and some legacy surfaces still read `profiles.is_host`)
  - Event role: `events.host_id` + `event_hosts.role`
- If an account can see/edit an event but cannot create venue, treat as role/capability mismatch and report it clearly.

## Gig events
- No signup time for gigs (user confirmed: "No signup for a gig")
- No performer slots for gigs unless explicitly stated

## Title format
- Use "Venue Name - Event Title" format (e.g., "Rocker Spirits - Songwriters in the Barrel Room")

## Conversational create flow
- Navigate to `/dashboard/my-events/new/conversational`
- Fill description with ALL known details including explicit event_type value
- Click "Generate Draft" button on first turn; use "Send Answer" on clarification turns
- If confidence is sufficient, click "Confirm & Create"
- Then navigate to edit page to fix venue, category, and other fields
- Save changes on edit page

## Category selection
- "Music" is the typical category for songwriter/music events
- Categories: Music, Comedy, Poetry, Variety, Other
