# Contributing to Showhow

Thank you for helping improve Showhow. The project is free, local-first, MIT licensed, and pre-1.x;
please keep changes focused and expect some rough edges.

## Get started

1. Fork [bedarstudios/showhow](https://github.com/bedarstudios/showhow).
2. Clone your fork and install the pinned toolchain dependencies:

   ```bash
   git clone https://github.com/your-username/showhow.git
   cd showhow
   npm install
   ```

3. Create a focused branch:

   ```bash
   git checkout -b feature/short-description
   ```

4. Make the change, add same-package tests for new behavior, and run the relevant verification.
5. Push the branch and open a pull request against
   [bedarstudios/showhow](https://github.com/bedarstudios/showhow/pulls).

## Local macOS desktop build

Use a Mac running macOS 13 or newer with Node 22.22.1 and full Xcode selected. Build the native
capture helpers and the packaged application together:

```bash
npm run build:mac
```

The command writes a versioned `Showhow.app` and DMG below `release/<version>/`. It builds the
native helpers for the host architecture, so build on the Mac architecture that will run the app.
This is a packaged snapshot of the current checkout; it is separate from the checkout itself and
from `npm run dev`, but the development and installed copies share the same user-data profile.

Local artifacts are not notarized (`notarize: false`) and may be unsigned when no local signing
identity is available. Gatekeeper can require an explicit approval before opening one. Only approve
a build you made or otherwise trust; this procedure is not a public distribution or auto-update
path.

## Install and launch

Before fresh installed-app acceptance, quit development and all other Showhow processes. The source
checkout and installed app share the same user-data profile, so a running development copy can
otherwise affect the installed app's state. Then copy the generated bundle to
`/Applications/Showhow.app`:

```bash
VERSION="$(node -p "require('./package.json').version")"
case "$(uname -m)" in
  arm64) APP_BUNDLE="release/$VERSION/mac-arm64/Showhow.app" ;;
  x86_64) APP_BUNDLE="release/$VERSION/mac/Showhow.app" ;;
  *) echo "Unsupported macOS host architecture: $(uname -m)"; exit 1 ;;
esac
test -d "$APP_BUNDLE" || { echo "Showhow.app was not produced for this architecture"; exit 1; }
sudo ditto "$APP_BUNDLE" /Applications/Showhow.app
open -a Showhow
```

After the installed app opens, use its Dock icon's **Options → Keep in Dock** command if you want a
persistent Dock launcher. Launching with `npm run dev` still runs the source checkout, not the
installed snapshot.

On first installed launch, grant **Screen Recording** and **Accessibility** in System Settings →
Privacy & Security when requested or needed. macOS evaluates those grants using the installed app's
identity. Keep `productName` and `appId` unchanged when rebuilding; changing either can move the
app's data location, and changing the bundle identifier resets TCC grants. Even with the same
identity, an unsigned or differently signed replacement can make macOS ask for permission again,
so re-check the installed app's permission toggles before diagnosing recording failures.

## Replace a local installation

Build from the updated source checkout, quit the installed app, then repeat the install commands
above. Replacing `/Applications/Showhow.app` replaces only that bundle; do not delete user data to
perform an update.

The installed application's preferences and scratch data live outside the app bundle in
`~/Library/Application Support/Showhow/`. The deliverable bundles in `~/Showhow/Recordings`, and
saved `.showhow` and `.openscreen` projects wherever you chose to save them, also remain outside the
app bundle. They survive replacement and must not be deleted while updating or removing the app.
The development and installed copies share that user-data profile, so quit every other Showhow
process before switching between them or verifying a fresh installed launch.

## Remove a local installation

Quit Showhow, then remove only the installed bundle:

```bash
sudo rm -rf /Applications/Showhow.app
```

Remove its Dock item from the Dock if desired. This does not remove preferences, user data,
`~/Showhow/Recordings` bundles, or `.showhow` / `.openscreen` projects; delete those separately only
when you explicitly intend to discard them.

## Verification

Use the checks that cover your change. Before a broad pull request, run:

```bash
npm run test
npm run test:browser
npx tsc --noEmit
npm run lint
npm run i18n:check
npm run branding:check
```

Install browser-test dependencies once with `npm run test:browser:install`. Native capture changes
also require a manual smoke test on the affected operating system.

## Reporting issues

Open bugs and feature requests in
[Showhow Issues](https://github.com/bedarstudios/showhow/issues). Include reproduction steps,
operating system, expected behavior, actual behavior, and relevant logs or sample files. Do not
attach secrets or private recordings.

An issue closes when its fix reaches `main`, which may be earlier than its first packaged release.
Use `Fixes #123`, `Closes #123`, or `Resolves #123` only when a pull request fully resolves the
issue; use `Refs #123` or `Part of #123` for partial work.

## Pull-request expectations

- Keep the scope narrow and explain the user-facing reason for the change.
- Use clear, imperative commit subjects and a Conventional Commit PR title.
- Preserve legacy `.openscreen` reads while new project writes move to `.showhow`.
- Do not overwrite or delete legacy user data during a migration.
- Do not import the source ancestor through a full merge. Follow [UPSTREAM.md](./UPSTREAM.md) for
  one focused, reviewed change and document its attribution.
- Keep recorder/editor behavior intact when changing the Showhow documentation layer.

## License

By contributing, you agree that your contributions are licensed under the [MIT License](./LICENSE).
