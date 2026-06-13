# Electron API parity

Sambar implements Electron's **main-process** API on macOS and Linux in pure
`bun:ffi` (the renderer side is the system WebView). Parity is roughly **75–80%**
by weighted real-app surface; the architectural core is complete on **both**
platforms, and the full init → dev → build → update distribution loop ships. This
page tracks module-by-module status and what is still pending.

## Implemented modules

`app` · `autoUpdater` · `BrowserWindow` · `webContents` · `ipcMain` · `clipboard` ·
`dialog` · `globalShortcut` · `Menu` / `MenuItem` · `nativeImage` · `nativeTheme` ·
`Notification` · `powerMonitor` · `powerSaveBlocker` · `protocol` · `safeStorage` ·
`screen` · `session` · `shell` · `Tray`

Renderer side: `ipcRenderer` + `contextBridge` (context isolation via a dedicated
isolated world).

## CLI + distribution

`sambar init` scaffolds a project, `sambar dev` runs it with file-watch restart,
`sambar build` packages a macOS `.app`/`.dmg` or Linux AppDir/`.deb`, and
`sambar build --update` also emits the auto-update feed (`<name>-<channel>-<os>-<arch>.tar.zst`
+ `update.json`) that the runtime `autoUpdater` consumes. Projects are configured
via `sambar.config.ts` (`defineConfig`).

## Platform notes

- **Fully both platforms:** app, BrowserWindow, webContents (incl. zoom-level,
  getTitle/isLoading/stop/reloadIgnoringCache), ipcMain, clipboard (incl. HTML),
  dialog (filters, showErrorBox), globalShortcut, Menu/MenuItem (roles, checkbox/
  radio, popup, insert/getMenuItemById), nativeImage (path/buffer/dataURL/PNG/JPEG/
  template/resize/crop), nativeTheme (+ OS observer), Notification, protocol,
  powerMonitor, powerSaveBlocker, screen, session (user-agent), shell, Tray.
- **Linux live paths gated behind env flags** (compile + symbols verified in CI;
  the live D-Bus/keyring path is opt-in): `safeStorage` libsecret
  (`SAMBAR_ENABLE_LINUX_KEYRING`), `powerMonitor`/`powerSaveBlocker`
  (`SAMBAR_ENABLE_LINUX_POWER` / `_POWER_BLOCKER`), `Tray` StatusNotifierItem
  (`SAMBAR_ENABLE_LINUX_TRAY`). macOS equivalents are verified end to end.

## Deliberately NOT implemented (and why)

Chromium-internal or Windows-only surfaces are out of scope by design:
`desktopCapturer`, `net`/`netLog`, `crashReporter`, `contentTracing`,
`session.webRequest`/proxy, offscreen rendering, Chromium-internal `webContents`
events, `BrowserView`/`WebContentsView` (Sambar is single-process), `utilityProcess`,
`TouchBar`, `inAppPurchase`, and all Windows-only members.
`systemPreferences` / `pushNotifications` are deferred.

## Pending (the next-tier roadmap)

Method-level depth inside implemented modules, in rough priority:

- **BrowserWindow**: `setBounds`/`setPosition`/`getPosition` (needs macOS
  screen-coordinate handling) + `setMaximumSize`/`setContentSize`/`setIcon` and
  `will-resize`/`resized`/`move`/`enter`–`leave-full-screen` events.
  *(Done: `setResizable`/`isResizable`, `setOpacity`/`getOpacity`,
  `setMinimumSize`/`getMinimumSize`, `getSize`, `center`.)*
- **webContents**: `page-title-updated`, per-instance `ipc`; Linux `capturePage`
  (via `webkit_web_view_get_snapshot`). *(Done: `capturePage` + `printToPDF` on
  macOS — built on hand-built ObjC completion-handler Blocks (`cocoa-block.ts`),
  which also unblocks `session.cookies` and `clearCache`;
  `toggleDevTools`/`closeDevTools`/`isDevToolsOpened`, `isDestroyed`.)*
- **session**: `cookies` (get/set/remove), `clearCache`/`clearStorageData`.
- **dialog**: `showMessageBox` options (`type`, `defaultId`, `cancelId`, `title`,
  checkbox) + window-modal sheet.
- **clipboard**: `readImage`/`writeImage`, `availableFormats`.
- **Menu**: standard submenu-role expansions (appMenu/editMenu/viewMenu/windowMenu)
  + view roles; `MenuItem.visible`.
- **nativeTheme**: `prefersReducedTransparency` (+ macOS high-contrast/inverted).
- **powerMonitor**: `getSystemIdleTime`, `isOnBatteryPower`.
- **autoUpdater**: an OS-deterministic default installer for `quitAndInstall`
  (the check/download/verify/stage engine + Electron-shaped events already ship;
  the swap step is currently experimental). Preload **bundling** so preloads can
  use `import`/TypeScript instead of the injected `__sambar`/`contextBridge` globals.
