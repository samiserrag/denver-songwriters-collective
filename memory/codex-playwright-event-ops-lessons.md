# Codex Playwright Event Ops - Technical Lessons

## Valid event_type values (API contract)
The AI interpreter can generate invalid values like "gig_performance". The API only accepts these exact strings:
`open_mic`, `showcase`, `song_circle`, `workshop`, `other`, `gig`, `meetup`, `jam_session`, `poetry`, `irish`, `blues`, `bluegrass`, `comedy`

Source: `web/src/lib/events/eventTypeContract.ts`

Fix: In the conversational description, explicitly state the event_type value to use, for example:
> Event type: gig (use exactly "gig" as the event_type value)

## Codex + Playwright extension mode
- Use `@playwright/mcp` with `--extension --browser chrome`.
- Requires the Playwright MCP Bridge extension to be installed and approved.
- Keep Chrome open in the intended profile and approve the extension session when prompted.
- If handshake fails, restart Codex session and reapprove extension connection.

## Why live profile launch fails without extension
- Launching Chrome automation directly against an already-open live profile triggers Chrome ProcessSingleton lock protection.
- Result: automation launch fails to prevent profile corruption.
- Extension mode avoids this by connecting to running Chrome rather than launching a second conflicting profile process.

## Cover image upload realities
- Cross-origin restrictions can block automatic image transfer from external sites into CSC form fields.
- Browser/session resets can invalidate temporary image handles.
- Manual cover upload remains the reliable fallback.
- Always save flyer to both `~/Downloads/` and `flyers/`:
  - `{venue-slug}-{event-slug}-{date}.jpg`

## Instagram image extraction pattern
```javascript
const imgs = document.querySelectorAll('img');
const postImg = Array.from(imgs).find((i) => i.src && i.src.includes('instagram') && i.width > 400);
const canvas = document.createElement('canvas');
canvas.width = postImg.naturalWidth || postImg.width;
canvas.height = postImg.naturalHeight || postImg.height;
canvas.getContext('2d').drawImage(postImg, 0, 0);
const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
```

## Venue creation rules
- When user wants a new permanent venue, choose "+ Add new venue..." in venue selector.
- Do not use "Custom location (this happening only)" for permanent venues.
- Fill all fields: name, address, city/state, phone, website.
- If venue create is blocked but event edit works, report role/capability mismatch explicitly.

## Gig event rules
- No signup time for gigs unless explicitly requested.
- No performer slots for gigs unless explicitly requested.

## Title format
- Use "Venue Name - Event Title".

## Conversational create flow reminders
- Route: `/dashboard/my-events/new/conversational`
- First turn action: "Generate Draft"
- Clarification turns: "Send Answer"
- Confirm create when confidence is acceptable.
- Immediately validate/fix on edit page, then save and reload.

## Category defaults
- Use "Music" for songwriter/music events unless clearly another type.
- Available categories: Music, Comedy, Poetry, Variety, Other.
