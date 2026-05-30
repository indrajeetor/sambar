import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { currentPlatform } from '../../../src/common/platform';
import { IpcMainImpl } from '../../../src/main/api/ipc-main';
import { decodeEnvelope, encodeEnvelope } from '../../../src/main/ipc/ipc-protocol';
import { createMacOSApplication } from '../../../src/main/platform/macos/cocoa-backend';
import type { NativeApplication, NativeWindow } from '../../../src/main/platform/native';

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Full IPC round-trip over a real WKWebView: the preload bootstrap runs in the
 * page, the page calls `__sambar.*`, the envelope reaches the native script
 * message handler, ipcMain handles it, and replies are delivered back via
 * `evaluateJavaScript`. We observe page-side results by having the page post
 * them back on another channel; assertions poll rather than assume fixed timing.
 */
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

    /** Resolve once `predicate` sees a delivered envelope, or after `timeoutMs`. */
    const waitForEnvelope = async (
      received: string[],
      predicate: (env: ReturnType<typeof decodeEnvelope>) => boolean,
      timeoutMs = 3000,
    ): Promise<ReturnType<typeof decodeEnvelope> | undefined> => {
      const deadline = Date.now() + timeoutMs;
      while (Date.now() < deadline) {
        for (const json of received) {
          const env = decodeEnvelope(json);
          if (predicate(env)) {
            return env;
          }
        }
        await delay(50);
      }
      return undefined;
    };

    test('renderer -> main: postMessage reaches the native script message handler', async () => {
      const received: string[] = [];
      win.webContents.onRendererEnvelope((json) => received.push(json));

      win.webContents.loadHTML('<html><body>ipc</body></html>', 'about:blank');
      await delay(300);
      win.webContents.executeJavaScript("window.__sambar.send('hello', 1, 2);");

      const env = await waitForEnvelope(
        received,
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
      await delay(300);

      // Page invokes 'add', then posts the resolved value back on 'result'.
      win.webContents.executeJavaScript(
        "window.__sambar.invoke('add', 20, 22).then(function (r) { window.__sambar.send('result', r); });",
      );

      const env = await waitForEnvelope(
        received,
        (e) => e.kind === 'send' && e.channel === 'result',
      );
      expect(env).toMatchObject({ kind: 'send', channel: 'result', args: [42] });
    });
  });
}
