# PinDou brand kit

**Small beads. Big good days.**

PinDou is a playful digital bead studio for making little colorful things, alone or with friends. Pick a color, place a bead, see what takes shape.

## Identity

- **Name:** PinDou in prose; `pindou.` in the lowercase wordmark.
- **Main tagline:** Small beads. Big good days.
- **Product line:** Little things, made by you.
- **Co-op line:** Little things, made together.
- **Description:** A playful 3D bead studio.
- **Audience:** casual creators, cozy-game fans, pixel-art hobbyists and friends looking for something creative to do together.

## Palette

| Color | Hex | Use |
| --- | --- | --- |
| Forest | `#203D32` | Text, wordmark, primary buttons |
| Paper | `#F6F5F0` | Backgrounds and reversed text |
| Lime | `#D9EF87` | Selected states and co-op graphics |
| Leaf | `#48952F` | Frog and bead imagery |
| Bubblegum | `#F47CAA` | Playful accents |
| Sunshine | `#F6C842` | Small bursts of color |

Let forest and paper dominate. Use lime to draw attention; pink and yellow support the artwork. Use forest text on light backgrounds and paper text on forest. Avoid pastel body text on paper.

## Logo and typography

The lowercase wordmark extends the existing application identity. The flower becomes the standalone social avatar and app icon. Keep at least the height of the final dot clear around the logo. Minimum wordmark width: 120 px. Minimum icon width: 24 px. Never stretch the wordmark or put it over busy imagery.

Use the supplied forest wordmark on paper and paper wordmark on forest. The avatar is centered to survive a circular crop.

The editable source uses **Avenir Next**, with Arial/system sans-serif fallback. No proprietary font files are distributed. SVG wordmarks retain editable text; the exported PNGs preserve the rendered appearance. Keep headlines short, bold and closely spaced; supporting copy stays calm and readable.

## Voice and imagery

Warm, playful and specific. “Pick a color.” “Pull up a chair.” “One more bead.” Celebrate the pleasure of making something without promising wellness results or perfection.

Use ivory tabletops, hollow plastic beads, soft shadows and generous space. Original frog, daisy and heart motifs fit the identity. The campaign scene is AI-generated illustration, not a product photograph. The separate Pocket frog SVG derives from the application's actual starter pattern.

Do not present the current prototype as a worldwide live service or a physical-product shop. Co-op requires a reachable running server; the commerce flow currently provides estimates and production briefs.

## Files and editing

- `public/brand/index.html`: visual kit overview.
- `public/brand/wordmark.svg`, `wordmark-light.svg`: editable wordmarks.
- `public/brand/avatar.svg`, `avatar.png`: social avatar, PNG 1080 × 1080.
- `public/brand/icon.svg`: app icon.
- `public/brand/github-banner.png`: repository/link-preview banner, 1200 × 630.
- `public/brand/social/`: six 1080 × 1350 feed images and four 1080 × 1920 vertical images.
- `public/brand/social-source.html`, `assets.json`: editable layouts and asset list.
- `scripts/create-brand.mjs`: rebuild vector assets and layout source.
- `scripts/render-brand.mjs`: export PNG files using Google Chrome through Playwright.

Run the creation script before the rendering script when changing the generated layouts. The campaign artwork is copied unchanged from the built-in Image Gen output. Its exact generation prompt is recorded in `IMAGE-PROVENANCE.md`.

Vertical assets are still-image covers, not completed videos. Preview the actual crop and platform overlays before posting. A name/trademark review has not been performed. Proposed social handles have not been registered or verified. No social accounts or posts were created by this kit.
