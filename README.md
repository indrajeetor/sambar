# Sambar

> Electron's leaner, meaner, much-less-bundled cousin. Built on [Bun](https://bun.sh) and your operating system's own WebKit, because shipping Chromium with every app is how we ended up with 14 GB of RAM disappearing into a chat window.

## What

A **drop-in replacement for Electron** that does not bundle 100 MB of Chromium with every desktop app you build.

Same `app`, `BrowserWindow`, `ipcMain`, `ipcRenderer` API you already know. Different runtime (Bun, not Node). Different renderer (system WebKit, not Chromium). Same vibe. Smaller fan noise.

## Why

Because your laptop fan deserves a break, and your users deserve apps under 25 MB.

## Status

**Alpha. Held together with optimism, `strict: true`, and ~980 passing tests.**

It genuinely works on **both macOS and Linux**: native windows, pages rendered by
your system's own WebKit (WKWebView / WebKitGTK 6), Electron-style IPC end to end,
application + context menus, tray icons, dialogs, clipboard, `nativeImage`,
`safeStorage`, `powerMonitor`, and more — all on [Bun](https://bun.sh) via FFI, with
**zero compiled native code and zero runtime dependencies**. There is also a CLI
that runs your app and packages it into real distributables (`.app`/`.dmg` on
macOS, AppDir/`.deb` on Linux).

If you are using this in production, we admire your courage and decline all responsibility. If you are a billion-dollar company evaluating this for your next desktop app, talk to us — but read the word "alpha" again first. If you are reading this in 2027 and we still say "alpha," please file an issue titled "are you OK."

## Platforms

| OS | Status |
|---|---|
| macOS | actively developed — AppKit + WKWebView via `objc_msgSend` |
| Linux | actively developed — GTK 4 + WebKitGTK 6 + GIO/GDBus + libsecret via `dlopen` |
| Windows | deferred until WebKit on Windows is a thing humans can actually use. **We will not ship Chromium.** Yes, we are aware this is a hill. Yes, we are willing to die on it. |

## Install

Not on npm yet (it really is alpha). For now, use it from a clone:

```sh
git clone https://github.com/indrajeetor/sambar.git
cd sambar && bun install
```

You will need [Bun](https://bun.sh) ≥ 1.3. Yes, that is the point.

## Hello world

It opens a real window now. We are as surprised as you are.

```ts
import { app, BrowserWindow } from 'sambar';

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 960, height: 720, title: 'Hello Sambar' });
  win.loadURL('https://example.com');
});
```

Run it with `bun run main.ts` (or `sambar run main.ts` — see below). A native
window appears, rendered by your operating system's own WebKit — no 100 MB of
Chromium in sight.

### IPC, the way you remember it

```ts
// main process
import { ipcMain } from 'sambar';
ipcMain.handle('add', (_event, a, b) => a + b);
```

```ts
// preload
import { contextBridge, ipcRenderer } from 'sambar/renderer';
contextBridge.exposeInMainWorld('api', {
  add: (a, b) => ipcRenderer.invoke('add', a, b),
});
```

`window.api.add(20, 22)` resolves to `42`, round-tripped through real WebKit — in a
dedicated isolated world, the way `contextIsolation: true` works in Electron.

## Shipping an app

Sambar ships a CLI (`sambar`) that runs and packages your app — pure Bun, no Xcode
project, no `electron-builder`:

```sh
sambar run main.ts          # run your app
sambar build                # produce distributables for the current OS
```

`sambar build` compiles your app with `bun build --compile`, bundles it next to the
Bun runtime (it `dlopen`s system WebKit, so there is no Chromium to ship), and emits:

- **macOS** — a `.app` bundle (with a `.icns` converted from your PNG), optional
  code-signing/notarization, and a `.dmg`.
- **Linux** — an AppDir `.tar.gz` and a `.deb`.

## Migrating from Electron

Point your existing Electron imports at Sambar's drop-in shim:

```ts
import { app, BrowserWindow } from 'sambar/electron';
```

Implemented modules behave like Electron's; anything not yet implemented throws an
actionable error naming the module (rather than failing silently), so you find the
gaps immediately. Sambar covers the architectural core (windows, web contents, IPC,
context isolation, menus, dialog, clipboard, tray, protocol, power, safeStorage,
nativeImage) on both platforms; see [docs/PARITY.md](./docs/PARITY.md) for the
module-by-module status and what is still pending.

## Contributing

If you have somehow found this repo before we invited anyone — hi. Open an issue, lower your expectations, and try not to be a jerk. The full contributing guide will appear once we have a working build to contribute to.

## License

[MIT](./LICENSE). Go wild.
