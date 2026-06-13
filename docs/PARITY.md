# Electron API parity

Sambar implements Electron's **main-process** API on macOS and Linux in pure
`bun:ffi` (the renderer side is the system WebView). Parity is roughly **70–75%**
by weighted real-app surface; the architectural core is complete on **both**
platforms. This page tracks module-by-module status and what is still pending.

## Implemented modules

`app` · `BrowserWindow` · `webContents` · `ipcMain` · `clipboard` · `dialog` ·
`globalShortcut` · `Menu` / `MenuItem` · `nativeImage` · `nativeTheme` ·
`Notification` · `powerMonitor` · `powerSaveBlocker` · `protocol` · `safeStorage` ·
`screen` · `session` · `shell` · `Tray`

Renderer side: `ipcRenderer` + `contextBridge` (context isolation via a dedicated
isolated world).

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
`TouchBar`, `inAppPurchase`, and all Windows-only members. `autoUpdater` is planned
(packaging already exists). `systemPreferences` / `pushNotifications` are deferred.

## Pending (the next-tier roadmap)

Method-level depth inside implemented modules, in rough priority:

- **BrowserWindow** runtime setters: `setBounds`/`setPosition`/`getPosition`/`center`/
  `setResizable`/`setMinimumSize`/`setMaximumSize`/`setContentSize`/`setOpacity`/
  `setIcon` + `will-resize`/`resized`/`move`/`enter`–`leave-full-screen` events.
  (Linux `setPosition` is a documented Wayland no-op.)
- **webContents**: `capturePage()`, `printToPDF()`, devtools toggles
  (`toggleDevTools`/`isDevToolsOpened`), `isDestroyed`, `page-title-updated`,
  per-instance `ipc`.
- **session**: `cookies` (get/set/remove), `clearCache`/`clearStorageData`.
- **dialog**: `showMessageBox` options (`type`, `defaultId`, `cancelId`, `title`,
  checkbox) + window-modal sheet.
- **clipboard**: `readImage`/`writeImage`, `availableFormats`.
- **Menu**: standard submenu-role expansions (appMenu/editMenu/viewMenu/windowMenu)
  + view roles; `MenuItem.visible`.
- **nativeTheme**: `prefersReducedTransparency` (+ macOS high-contrast/inverted).
- **powerMonitor**: `getSystemIdleTime`, `isOnBatteryPower`.
- **autoUpdater**: full-download self-update (packaging exists; updater is next).

Renderer/distribution roadmap (the "complete framework" leap): `sambar init`
scaffold, `sambar dev` file-watch, a `sambar.config.ts` manifest, and the
auto-updater.
