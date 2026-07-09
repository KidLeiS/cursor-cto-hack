# sushicode — Branding

Shared brand assets and guidelines for **sushicode**. This folder is
self-contained: it does not affect the `dashboard/` frontend or the
`supabase/` / `scripts/` backend at runtime. Use it as the single source of
truth for how the brand looks, sounds, and feels.

## Contents

| Path | What it is |
| --- | --- |
| [`BRAND_GUIDELINES.md`](BRAND_GUIDELINES.md) | Voice, logo usage, spacing, do / don't |
| [`palette.md`](palette.md) | Color tokens (hex + usage) mirroring the dashboard theme |
| [`logo/sushicode-mark.svg`](logo/sushicode-mark.svg) | Standalone icon / app mark |
| [`logo/sushicode-wordmark.svg`](logo/sushicode-wordmark.svg) | Mark + "sushicode" lockup |

## Quick reference

- **Name:** always lowercase — `sushicode` (one word, no space, no camel case).
- **Tagline:** _sushicode is code._
- **Accent:** `#c4f082` (wasabi green) on deep `#0f1412` (nori dark).
- **Display font:** Fraunces · **Body:** IBM Plex Sans · **Mono:** IBM Plex Mono.

The color and font values here intentionally match
`dashboard/src/app/globals.css` so design and product stay in sync. If the
product theme changes, update [`palette.md`](palette.md) to match.
