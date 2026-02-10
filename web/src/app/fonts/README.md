# Local Font Assets

These font files are vendored for build reliability in restricted environments.

Source families:
- Geist
- Geist Mono
- Inter
- Playfair Display
- Fraunces

Files were downloaded from Google Fonts static asset URLs (`fonts.gstatic.com`) and are used via `next/font/local`.

If updating fonts, keep file names stable or update paths in:
- `web/src/app/layout.tsx`
- `web/src/lib/fonts.ts`
