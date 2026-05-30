# Sambar

> Electron's leaner, meaner, much-less-bundled cousin. Built on [Bun](https://bun.sh) and your operating system's own WebKit, because shipping Chromium with every app is how we ended up with 14 GB of RAM disappearing into a chat window.

## What

A **drop-in replacement for Electron** that does not bundle 100 MB of Chromium with every desktop app you build.

Same `app`, `BrowserWindow`, `ipcMain`, `ipcRenderer` API you already know. Different runtime (Bun, not Node). Different renderer (system WebKit, not Chromium). Same vibe. Smaller fan noise.

## Why

Because your laptop fan deserves a break, and your users deserve apps under 25 MB.

## Status

**Alpha. Held together with optimism, `strict: true`, and 300+ passing tests.**

It genuinely works: it opens native windows, renders pages in your system's own
WebKit, and does Electron-style IPC end to end — all on [Bun](https://bun.sh) via
FFI, with **zero compiled native code**. macOS today; Linux next.

If you are using this in production, we admire your courage and decline all responsibility. If you are a billion-dollar company evaluating this for your next desktop app, talk to us — but read the word "alpha" again first. If you are reading this in 2027 and we still say "alpha," please file an issue titled "are you OK."

## Platforms

| OS | Status |
|---|---|
| macOS | actively developed |
| Linux | actively developed |
| Windows | deferred until WebKit on Windows is a thing humans can actually use. **We will not ship Chromium.** Yes, we are aware this is a hill. Yes, we are willing to die on it. |

## Install

```sh
bun add sambar
```

You will need [Bun](https://bun.sh). Yes, that is the point.

## Hello world

It opens a real window now. We are as surprised as you are.

```ts
import { app, BrowserWindow } from 'sambar';

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 960, height: 720, title: 'Hello Sambar' });
  win.loadURL('https://example.com');
});
```

Run it with `bun run main.ts`. A native window appears, rendered by your operating
system's own WebKit — no 100 MB of Chromium in sight.

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

`window.api.add(20, 22)` resolves to `42`, round-tripped through real WebKit.

> **macOS only, for now.** Linux (WebKitGTK) is next; Windows waits for a WebKit
> it can stand on. We will not ship Chromium. Yes, this is a hill. Yes, we are
> willing to die on it.

## Contributing

If you have somehow found this repo before we invited anyone — hi. Open an issue, lower your expectations, and try not to be a jerk. The full contributing guide will appear once we have a working build to contribute to.

## License

[MIT](./LICENSE). Go wild.
