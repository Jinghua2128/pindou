# PinDou implementation plan

1. Foundation: Next.js App Router, TypeScript, Tailwind, logical project schema, Zustand, motion utilities.
2. First milestone: instanced hollow beads, pegboard, paint/erase, ghost, gesture history, camera transitions, local autosave, responsive studio.
3. Expand the verified core: fill, line, rectangle, mirror, templates, image import, fusion preview, export, project library.
4. Commerce foundations: centralized estimates, structural analysis and BOM; integrations require configured provider credentials.
5. Verify: unit tests, lint, typecheck, production build, actual browser journeys and responsive screenshots.

## Visual system
Reference: `studio-concept.png` (built-in Image Gen).
Warm off-white #f6f5f0 canvas, ivory-white panels, forest #243d32 typography and primary actions, lime #d9ef87 selected controls. Rounded sans typography, 16–22px panel corners, thin warm grey borders, soft shadows. Lucide outline icons, 18px utilities and 21px tools. App header, heading row, craft canvas + palette inspector, compact template rail. Mobile uses a horizontal tool strip and collapsible palette.

UI text remains DOM-native. The generated concept is a design reference only. User-requested interactive artwork is intentionally procedural Three.js geometry, not raster game artwork. Project thumbnails derive from real logical grids. The primary route opens the studio so the first milestone is immediately usable; a separate welcome surface will provide landing-page storytelling later.

## Motion ownership
Three.js owns scene matrices and camera. GSAP owns entrance wrapper opacity/position. Anime.js owns inner swatch/tool press scale. CSS owns simple colors/shadows. Reduced motion disables decorative movement.

## Verified milestone — 24 September 2026

The creation milestone and its local extensions are implemented. `npm run typecheck`, `npm run lint`, `npm run test` (21 tests), `npm run test:e2e` (6 journeys), and `npm run build` passed on the final source. The local development server remains on port 3000.

Browser evidence: the in-app browser initially rendered the live studio with no reported app console errors. Its large viewport screenshots were clipped, so the requested Playwright/Chrome workflow supplied the reliable screenshots. Final desktop viewport: 1536×1024, matching the concept's native viewport. Responsive overflow checks passed at 375, 390, 430, 768, 1024, 1440 and 1920 px. Screenshot evidence is temporary and kept outside source at `/tmp/pindou-desktop.png` and `/tmp/pindou-mobile.png`.

### Design comparison ledger

The reference and latest desktop/mobile captures were directly inspected with `view_image`.

| Comparison | Result and action |
| --- | --- |
| Main composition | Header, heading row, craft table, right inspector, and four-item inspiration rail retained. |
| Palette | Warm off-white, forest text/actions, and lime selected states retained; lighting reduced to restore bead-color saturation. |
| Type hierarchy | Large rounded heading, project title, tabs and compact tools retained; undersized mobile captions were increased. |
| Artwork framing | Replaced fixed camera assumptions with projected-corner fitting; phone board clipping fixed. Live procedural artwork intentionally differs from the raster rendering. |
| Inspector density | Increased desktop inspector width and compacted the fuse panel so project colors remain visible. |
| Responsive controls | Phone tools form a horizontal rail; palette expands below the board. Touch targets increased. |
| Above-the-fold copy | Primary heading, subtitle, navigation, project name, new/export/fuse actions and inspiration heading retained. Intentional differences: accurate device-local save text, real color names, settings in place of a fictional avatar, and additional requested tools/status. |
| Visual assets | All editable artwork and thumbnails derive from logical project cells. The generated reference is not shipped as a fake interactive canvas. |

The design system and composition are faithfully carried into the working studio; the real-time 3D rendering is not a pixel-identical reproduction of the generated photograph-like concept. No known clipped controls or horizontal page overflow remain in the tested widths.

### Concept prompt provenance

Built-in Image Gen, `ui-mockup`: premium full-screen “pindou” 3D fuse-bead studio, 1536×1024; warm off-white #f6f5f0, forest #243d32 and lime #d9ef87; modern rounded sans typography; thin brand/navigation header; “Little things, made by you.” and “A little color. A little patience. Something entirely yours.”; New creation; translucent pegboard with an original smiling green frog made of hollow plastic beads; tool rail, saved-state/export actions, Top/Isometric/3D and zoom; color inspector with Colors/Template/Stats, palette and project colors; “Made to leave the screen.” and Fuse creation; four original cherry/daisy/heart/mushroom inspiration tiles. The prompt explicitly required code-native controls and a later live Three.js implementation. Output is `studio-concept.png`.

## Co-op and tactile play — 24 September 2026

Added shared invitation rooms backed by a bounded, in-memory single Node process, with 250 ms snapshot reconciliation, atomic conditional cell/toy operations, idempotent sequence receipts, peer cursors, timeouts/reconnection, and local artwork backups. Invitations created on localhost use a LAN address. Plain HTTP LAN browsers use a cryptographic UUID helper that does not require `crypto.randomUUID()`.

The new play table has draggable bead boxes, spill/cleanup actions, individual loose bead pickup, and keyboard box movement. The Grab tool moves or swaps board beads. Every palette color supports drag-to-place; trays and spilled beads also support click/tap pickup and placement. Held beads have a floating cursor and a 3D peg preview; Escape cancels without removing the original bead. Keyboard coordinate placement supports pickup/drop. Undo skips a conflicting gesture atomically, including both ends of a swap.

Validation: production build, typecheck, lint, 31 unit tests, six existing browser journeys, and three new Playwright journeys passed. The co-op journey used two separate browser contexts and the actual generated LAN invitation, verified board edits in both directions, live box movement before pointer release, spills, tidy, and recovery of offline changes. Additional checks cover palette dragging, mobile pickup/placement, cancellation, and closed-room messaging. Desktop and 390 px phone screenshots were inspected; the existing responsive overflow matrix still passes. Reliable visual evidence remains in `/tmp/pindou-desktop.png`, `/tmp/pindou-mobile.png`, and `/tmp/pindou-coop.png`.

Rooms are deliberately transient, do not survive server restart, and expire after 12 inactive hours. Internet invitations require a public server; no tunnel or public deployment was created. Serverless/multiple-process deployments need shared durable room storage before enabling this implementation. Authentication, cloud project storage, and commerce integrations remain separate future work.
