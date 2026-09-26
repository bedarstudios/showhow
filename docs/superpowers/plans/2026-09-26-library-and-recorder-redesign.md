# Library and recorder bar redesign — implementation plan

> Design source of truth: `design/showhow.pen` (screens 23–40, `ds-*` variables, components).
> Reference page: `design/showhow-design-system.html`. Steps use checkbox syntax.

**Goal:** Showhow opens on a redesigned library, recording runs from a redesigned recorder bar,
and saving in the editor brings you back to the library on that recording — with Remake,
Export PDF and Copy for agent on the inline guide. Light and dark themes.

**Out of scope (next build):** the Laya + Whisper guide engine and the Settings → Guide engine
screen. The editor (screens 41–46) keeps its current look. The existing guide generator stays.
Nothing here may close the door on a later `steps.json`-driven guide or video renderer.

## Decisions (signed off 2026-09-26)

| # | Decision |
|---|---|
| Scope | Look + flow only; current guide generator stays |
| Surfaces | Library (23–35) and recorder bar (36–40); editor unchanged |
| Theme | Light + Dark, follows macOS, manual override in Settings |
| Guide actions | Add Remake, Export PDF, Copy for agent |
| New recording from library | Hide library → recorder bar → editor → save → library reopens on that recording |
| Settings | Appearance only (System / Light / Dark) |
| Copy for agent | Prompt with bundle path; exact wording reviewed by Mohamed during build |
| PDF | Mirrors inline guide in cream/charcoal; save dialog picks location |
| Launch | App launch and Dock click → library. Menu-bar icon and global shortcut → straight to recording |
| Old bundles | Shown as-is with their existing guide; no migration |
| Storage | Unchanged: `~/Showhow/Recordings/<bundle>/` (see `docs/architecture/showhow-bundles.md`) |

## Current state (facts)

- `electron/main.ts:104` `createWindow()` opens the HUD (`createHudOverlayWindow`) at launch;
  the library is a separate window via `createLibraryWindowWrapper()` (`main.ts:443`) and
  `switchToLibrary` IPC. `app.on("activate")` at `main.ts:496`.
- Tray click handlers at `main.ts:321–374`; global shortcut in `electron/globalShortcut.ts`.
- Library UI: `src/components/library/RecordingLibrary.tsx` (1,194 lines, inline styles).
  Has create/retry doc, copy path, title edit, step edit/delete, reveal blurred text.
- Recorder bar: `src/components/launch/LaunchWindow.tsx` + `LaunchWindow.module.css`,
  `SourceSelector.tsx`, `CountdownOverlay.tsx`.
- Theme: legacy `[data-sh-theme="dark"]` tokens in `src/index.css:334+`; shadcn UI in
  `src/components/ui/`; Tailwind in `tailwind.config.cjs`.

## Phase 1 — Foundations

- [ ] **1.1 Tokens.** Add all 52 `ds-*` variables to `src/index.css` as CSS custom properties
  (Light on `:root`, Dark under `[data-sh-theme="dark"]`), values copied from the .pen
  (`Print(GetVariables())`). Map them in `tailwind.config.cjs` (`colors.ds.*`, `fontFamily`).
  Keep legacy `sh-*` tokens until Phase 5 removes their last user.
- [ ] **1.2 Fonts.** Bundle Inter, Inter Tight, JetBrains Mono, Instrument Serif (OFL) as local
  `woff2` under `src/assets/fonts/` with `@font-face`. No Google Fonts at runtime.
- [ ] **1.3 Theme.** `src/lib/showhow/theme.ts`: preference `system | light | dark`, persisted
  with the Showhow-first/legacy-fallback key rule; `system` follows
  `nativeTheme.shouldUseDarkColors` via IPC and live updates. Applies `data-sh-theme` to every
  renderer window. Test: preference resolution + persistence fallback.
- [ ] **1.4 Components** in `src/components/showhow/` (one file each, with tests):
  `Button` (variants primary/secondary/ghost/dark/sidebar/toolbar, optional lucide icon),
  `Tag`, `Logo` (V1 Pointer SVG from `design/brand` / .pen `XXi60`), `LibraryRow`, `Sidebar`,
  `VideoPlayer`, `GuideStep`, `Card`, `Toast` (reuse `sonner`), `EmptyState`.
  Match the .pen: 4px button radius, 11px mono uppercase labels, 3px tags, 8px cards.

## Phase 2 — Window flow

- [ ] **2.1 Launch → library.** `createWindow()` opens the library window instead of the HUD.
  `activate` (Dock click) shows/focuses the library. Tray click and global shortcut keep opening
  the recorder bar directly.
- [ ] **2.2 New recording from library.** Library "New recording" hides the library and shows the
  recorder bar (existing `switchToHud`). Cancel on the recorder bar returns to the library.
- [ ] **2.3 Save → library on that recording.** On every save-completion path listed in
  `showhow-bundles.md` (all three macOS paths), after the editor save succeeds, close/hide the
  editor, show the library and select the saved bundle, marked **New** until viewed. Bundle
  failure must still fall back to the flat save and open the library without selection.
- [ ] **2.4 Tests.** Unit tests for the window-routing decisions (pure function of event →
  target window); e2e smoke: launch shows library.

## Phase 3 — Library redesign (screens 23–35)

- [ ] **3.1 Layout.** Rebuild `RecordingLibrary.tsx` as sidebar + detail using Phase 1
  components; split into `LibrarySidebar`, `RecordingDetail`, `GuidePanel` files so no file
  exceeds ~400 lines. Preserve all existing behaviour and its tests.
- [ ] **3.2 States.** Launch (nothing selected — empty state), just saved / no guide, making
  guide (inline progress Card with Cancel), guide ready, guide error with Retry, empty library.
- [ ] **3.3 Guide view.** Inline under the video: summary, `GuideStep` list with screenshot,
  step title, quoted narration (Instrument Serif), timestamp seek, edit/delete, blurred-step
  reveal (keep the current reveal behaviour; restyle only).
- [ ] **3.4 Copy.** "Workflow doc" → "guide" in UI strings and all 13 locales; run
  `npm run i18n:check`.

## Phase 4 — Guide actions

- [ ] **4.1 Remake.** Reruns the current generator; confirm dialog when the guide has user edits.
- [ ] **4.2 Export PDF.** Main-process handler renders the guide to an offscreen window using the
  library's print stylesheet and `webContents.printToPDF`; save dialog defaults to
  `<bundle>/guide.pdf`. Test the HTML builder; smoke-test the PDF on macOS.
- [ ] **4.3 Copy for agent.** Builds a prompt with the bundle path and file list
  (`steps.md`/transcript/screenshots as present). Draft wording goes to Mohamed for review
  before merge. Toast: "Copied for agent".
- [ ] **4.4 Settings view.** Sidebar Settings → Appearance: System / Light / Dark (Phase 1.3).

## Phase 5 — Recorder bar redesign (screens 36–40)

- [ ] **5.1** Restyle `LaunchWindow` (idle, source picker, countdown, recording, paused per
  the .pen) using the `ds-hud-*` palette and Phase 1 components; keep every control, shortcut
  and IPC call unchanged. Update `LaunchWindow.test.tsx`/`SourceSelector.test.tsx` selectors only
  where markup changes.
- [ ] **5.2** Remove legacy `sh-*` tokens once nothing references them.

## Phase 6 — Verification

- [ ] `npx tsc --noEmit`, `npm run lint`, `npm run test`, `npm run test:browser`,
  `npm run i18n:check`, `npm run branding:check`.
- [ ] Manual macOS smoke (Herdr/Codex computer-use handoff if needed), screenshots of: launch
  library (light + dark), full record → edit → save → library-on-recording loop, recorder bar
  states, PDF output, Copy for agent clipboard.
- [ ] Compare screenshots against `.pen` screens 23–40; note any deliberate differences.

## Risks

- Window-flow changes touch all three macOS save paths — missing one leaves the user in the editor.
- `RecordingLibrary.tsx` rewrite could drop existing behaviour; keep its tests green throughout.
- Recorder bar is captured-screen-adjacent; verify it stays excluded from recordings after restyle.
