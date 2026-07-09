# sushicode — Color Palette

These tokens mirror `dashboard/src/app/globals.css` so brand assets and the
shipped product stay consistent. Values are the canonical hex references.

## Core

| Token | Hex | Role |
| --- | --- | --- |
| `nori-dark` | `#0f1412` | Primary background (base) |
| `nori-1` | `#17201c` | Background gradient stop |
| `nori-2` | `#1e2a24` | Raised surfaces / inputs |
| `rice-ink` | `#e8f0ea` | Primary text |
| `muted` | `#9bb0a3` | Secondary text |
| `line` | `rgba(232, 240, 234, 0.12)` | Hairline borders |

## Accent

| Token | Hex | Role |
| --- | --- | --- |
| `wasabi` | `#c4f082` | Primary accent, CTAs, brand highlight |
| `wasabi-ink` | `#14200f` | Text on wasabi surfaces |

## Status / semantic

| Token | Hex | Role |
| --- | --- | --- |
| `feature` | `#7ec8ff` | Feature agent |
| `debug` | `#ffb454` | Debug agent |
| `pass` | `#7dffb3` | Passing / success |
| `fail` | `#ff7d7d` | Failing / error |
| `pending` | `#d6c48a` | Pending / in-progress |

## Usage notes

- Keep wasabi as an **accent**, not a background fill — it reads best as small
  highlights against the dark nori base.
- Maintain AA contrast: `rice-ink` on `nori-dark` and `wasabi-ink` on `wasabi`.
- Prefer the semantic status colors for state, never the raw accent.
