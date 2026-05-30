import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { currentPlatform } from '../../../src/common/platform';
import { IpcMainImpl } from '../../../src/main/api/ipc-main';
import { decodeEnvelope, encodeEnvelope } from '../../../src/main/ipc/ipc-protocol';
import { createMacOSApplication } from '../../../src/main/platform/macos/cocoa-backend';
import type { NativeApplication, NativeWindow } from '../../../src/main/platform/native';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

if (currentPlatform() === 'macos') {
  describe('IPC end-to-end over a real webview', () => {
    let app: NativeApplication;
    let win: NativeWindow;

    beforeAll(() => {
      app = createMacOSApplication();
      app.start();
      win = app.createWindow({ width: 400, height: 300, title: 'ipc', show: true });
    });

    afterAll(() => {
      app.quit();
    });

    /**
     * Re-run `injectJs` every poll until an envelope matching `predicate`
     * arrives. Re-injecting (rather than firing once after a fixed delay) makes
     * the test robust to load/preload timing on slow CI runners: an injection
     * that lands before `window.__sambar` exists simply gets retried.
     */
    const driveUntilEnvelope = async (
      received: readonly string[],
      injectJs: string,
      predicate: (env: ReturnType<typeof decodeEnvelope>) => boolean,
      timeoutMs = 5000,
    ): Promise<ReturnType<typeof decodeEnvelope> | undefined> => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        win.webContents.executeJavaScript(`if (window.__sambar) { ${injectJs} }`);
        await delay(100);
        for (const json of received) {
          const env = decodeEnvelope(json);
          if (predicate(env)) {
            return env;
          }
        }
      }
      return undefined;
    };

    test('renderer -> main: postMessage reaches the native script message handler', async () => {
      const received: string[] = [];
      win.webContents.onRendererEnvelope((json) => received.push(json));
      win.webContents.loadHTML('<html><body>ipc</body></html>', 'about:blank');

      const env = await driveUntilEnvelope(
        received,
        "window.__sambar.send('hello', 1, 2);",
        (e) => e.kind === 'send' && e.channel === 'hello',
      );
      expect(env).toMatchObject({ kind: 'send', channel: 'hello', args: [1, 2] });
    });

    test('invoke round-trip: page invoke -> ipcMain.handle -> reply settles the page promise', async () => {
      const ipc = new IpcMainImpl();
      ipc.handle('add', (_event, a, b) => (a as number) + (b as number));

      const received: string[] = [];
      win.webContents.onRendererEnvelope(async (json) => {
        received.push(json);
        const env = decodeEnvelope(json);
        if (env.kind === 'send' || env.kind === 'invoke') {
          const reply = await ipc.dispatch(env, { sender: win.webContents });
          if (reply !== undefined) {
            win.webContents.sendEnvelopeToRenderer(encodeEnvelope(reply));
          }
        }
      });
      win.webContents.loadHTML('<html><body>ipc</body></html>', 'about:blank');

      // Invoke 'add' once the bridge exists; post the resolved value back on
      // 'result'. A guard flag keeps the retry from invoking repeatedly.
      const env = await driveUntilEnvelope(
        received,
        "if (!window.__sentInvoke) { window.__sentInvoke = true; window.__sambar.invoke('add', 20, 22).then(function (r) { window.__sambar.send('result', r); }); }",
        (e) => e.kind === 'send' && e.channel === 'result',
      );
      expect(env).toMatchObject({ kind: 'send', channel: 'result', args: [42] });
    });
  });
}
