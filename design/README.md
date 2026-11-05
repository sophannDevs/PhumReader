# Toonwave V2 – design screens

Exported from the Claude Design canvas (page "V2 – shadcn/ui concept").
Desktop images are 1440 px wide; phone images are 390 px wide at 2x (780 px files).
Covers and comic panels are the placeholder artwork used in the canvas.

## Default screens
- 00-foundations-desktop – tokens, type, components, V1→V2 component map
- 01-home-desktop / -phone
- 02-series-desktop / -phone
- 03-episode-viewer-desktop / -phone
- 04-novel-reader-desktop / -phone
- 05-login-desktop / -phone
- 06-coins-desktop / -phone

## Key states
- 01-home-logged-in-menu-desktop – avatar menu open
- 01-home-search-open-desktop – ⌘K search with results
- 02-series-unlock-dialog-desktop – Fast Pass unlock, enough coins
- 02-series-unlock-not-enough-coins-phone – unlock, needs more coins
- 02-series-comments-tab-desktop – Comments tab
- 04-novel-reader-settings-dark-desktop – reading settings, dark theme
- 04-novel-reader-sepia-phone – sepia theme, serif font
- 05-signup-desktop – sign up with live password rules
- 05-verify-code-phone – 6-digit email code
- 05-forgot-password-desktop – reset password
- 05-login-error-phone – wrong email or password
- 06-coins-khqr-payment-desktop – KHQR pay step with countdown
- 06-coins-card-payment-phone – card step ([PAYMENT PROVIDER FORM] placeholder)
- 06-coins-success-desktop – coins added, back to episode
- 06-coins-failed-phone – expired KHQR code

## Design pack files
- foundations.md – colors, fonts, spacing, radius, shadows, shadcn component mapping, icons
- spec.md – every page, every button and state, demo behaviour, routes, key flows
- demo-data.json – 48 series, episode rules + 3 full episode lists, comic panels, novel chapter, comments, coin packs, payment methods, FAQ, login page strings in English and Khmer
- assets/covers, assets/panels – the placeholder artwork referenced by demo-data.json (copy into public/)

Put this folder in your project as design/ for Claude Code.
