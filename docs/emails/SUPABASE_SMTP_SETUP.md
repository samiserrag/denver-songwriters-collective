# Supabase Custom SMTP Setup

Configure Supabase Auth emails (verification, password reset, magic links) to use Fastmail SMTP for instant delivery instead of Supabase's default email service (which can have 5+ minute delays).

## Current Configuration

DSC already uses Fastmail SMTP for transactional emails (RSVP confirmations, host approvals, etc.). The same credentials should be used for Supabase Auth emails.

### SMTP Credentials (Vercel Environment)

| Variable | Value |
|----------|-------|
| `SMTP_HOST` | `smtp.fastmail.com` |
| `SMTP_PORT` | `465` (SSL) |
| `SMTP_USER` | *(configured in Vercel)* |
| `SMTP_PASSWORD` | *(configured in Vercel)* |
| `SMTP_FROM_EMAIL` | `admin@denversongwriterscollective.org` |
| `SMTP_FROM_NAME` | `Denver Songwriters Collective` |

---

## Step-by-Step: Configure Supabase Dashboard

### 1. Access SMTP Settings

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select project: `oipozdbfxyskoscsgbfq`
3. Navigate to: **Project Settings** → **Authentication** → **SMTP Settings**

### 2. Enable Custom SMTP

Toggle **"Enable Custom SMTP"** to ON

### 3. Enter SMTP Configuration

| Field | Value |
|-------|-------|
| **Sender email** | `admin@denversongwriterscollective.org` |
| **Sender name** | `Denver Songwriters Collective` |
| **Host** | `smtp.fastmail.com` |
| **Port** | `465` |
| **Minimum interval** | `60` (seconds between emails to same address) |
| **Username** | *(same as SMTP_USER in Vercel)* |
| **Password** | *(same as SMTP_PASSWORD in Vercel)* |

### 4. Save Changes

Click **"Save"** at the bottom of the SMTP Settings section.

---

## Fastmail-Specific Notes

### App-Specific Password
Fastmail requires an **app-specific password** for SMTP, not your main account password.

To generate one:
1. Go to [Fastmail Settings](https://www.fastmail.com/settings/security/devicekeys)
2. Click **"New App Password"**
3. Name: `Supabase Auth` (or similar)
4. Access: **SMTP only**
5. Copy the generated password

### Domain Already Configured
The domain `denversongwriterscollective.org` is already configured in Fastmail with:
- ✅ SPF record
- ✅ DKIM record
- ✅ Custom sending identity

No additional DNS changes needed.

---

## Testing

After configuring:

1. **Sign up a new test user** at `/signup`
2. **Check inbox** - verification email should arrive within 30 seconds
3. **Check spam folder** if not in inbox
4. **Verify sender** shows as `Denver Songwriters Collective <admin@denversongwriterscollective.org>`

### Test Magic Link

1. Go to `/login/magic`
2. Enter email
3. Check inbox - magic link email should arrive within 30 seconds

### Test Password Reset

1. Go to `/auth/reset-request`
2. Enter email
3. Check inbox - reset email should arrive within 30 seconds

---

## Troubleshooting

### Emails Still Delayed
- Verify SMTP settings saved correctly in Supabase Dashboard
- Check Supabase logs for SMTP errors
- Confirm app-specific password is correct

### Emails Going to Spam
- Verify SPF/DKIM records are set up for the domain
- Consider using a different sender address
- Check email content for spam triggers

### "Invalid credentials" Error
- Regenerate app-specific password in Fastmail
- Ensure username is the full email address (e.g., `user@fastmail.com`)

---

## Related Documentation

- [EMAIL_INVENTORY.md](./EMAIL_INVENTORY.md) - All email templates and use cases
- [EMAIL_STYLE_GUIDE.md](./EMAIL_STYLE_GUIDE.md) - Voice and tone guidelines
- [mailer.ts](../../web/src/lib/email/mailer.ts) - SMTP transport implementation
