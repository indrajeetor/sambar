import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { ipcMain } from '../../../../src/main/api/ipc-main';
import { resetWebContentsIdsForTesting, WebContents } from '../../../../src/main/api/web-contents';
import { decodeEnvelope, encodeEnvelope } from '../../../../src/main/ipc/ipc-protocol';
import type { NativeWebContents } from '../../../../src/main/platform/native';

const makeFakeNative = (): {
  native: NativeWebContents;
  sent: string[];
  execs: string[];
  fireRenderer: (json: string) => void;
  fireDidFinishLoad: () => void;
} => {
  const sent: string[] = [];
  const execs: string[] = [];
  let onEnvelope: ((json: string) => void) | undefined;
  let onLoad: (() => void) | undefined;
  const native: NativeWebContents = {
    loadURL: () => undefined,
    loadHTML: () => undefined,
    getURL: () => '',
    reload: () => undefined,
    goBack: () => undefined,
    goForward: () => undefined,
    canGoBack: () => false,
    canGoForward: () => false,
    executeJavaScript: (code) => {
      execs.push(code);
      return Promise.resolve(undefined);
    },
    openDevTools: () => undefined,
    sendEnvelopeToRenderer: (json) => sent.push(json),
    onRendererEnvelope: (cb) => {
      onEnvelope = cb;
    },
    onDidFinishLoad: (cb) => {
      onLoad = cb;
    },
  };
  return {
    native,
    sent,
    execs,
    fireRenderer: (json) => onEnvelope?.(json),
    fireDidFinishLoad: () => onLoad?.(),
  };
};

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

const reset = (): void => {
  resetWebContentsIdsForTesting();
  ipcMain.removeAllListeners();
  ipcMain.removeHandler('add');
  ipcMain.removeHandler('boom');
};

beforeEach(reset);
afterEach(reset);

describe('WebContents.insertCSS / removeInsertedCSS', () => {
  test('insertCSS injects the css and resolves to a key', async () => {
    const { native, execs } = makeFakeNative();
    const key = await new WebContents(native).insertCSS('body { color: red; }');
    expect(typeof key).toBe('string');
    expect(execs).toHaveLength(1);
    expect(execs[0]).toContain('body { color: red; }');
    expect(execs[0]).toContain(key);
  });

  test('insertCSS returns a distinct key per call', async () => {
    const { native } = makeFakeNative();
    const wc = new WebContents(native);
    const a = await wc.insertCSS('a {}');
    const b = await wc.insertCSS('b {}');
    expect(a).not.toBe(b);
  });

  test('removeInsertedCSS runs a script referencing the key', async () => {
    const { native, execs } = makeFakeNative();
    const wc = new WebContents(native);
    const key = await wc.insertCSS('a {}');
    await wc.removeInsertedCSS(key);
    expect(execs).toHaveLength(2);
    expect(execs[1]).toContain(key);
    expect(execs[1]).toContain('remove');
  });
});

describe('WebContents.send', () => {
  test('sends a send envelope to the renderer', () => {
    const { native, sent } = makeFakeNative();
    new WebContents(native).send('news', 'hi', 1);
    expect(decodeEnvelope(sent[0] ?? '')).toEqual({
      kind: 'send',
      channel: 'news',
      args: ['hi', 1],
    });
  });
});

describe('WebContents <-> ipcMain auto-wiring', () => {
  test('a renderer send envelope reaches an ipcMain listener with sender set', async () => {
    const { native, fireRenderer } = makeFakeNative();
    const wc = new WebContents(native);
    const calls: Array<{ sender: unknown; args: readonly unknown[] }> = [];
    ipcMain.on('greet', (event, ...args) => calls.push({ sender: event.sender, args }));

    fireRenderer(encodeEnvelope({ kind: 'send', channel: 'greet', args: ['yo'] }));
    await flush();

    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toEqual(['yo']);
    expect(calls[0]?.sender).toBe(wc);
  });

  test('a renderer invoke is handled and a reply is sent back', async () => {
    const { native, sent, fireRenderer } = makeFakeNative();
    new WebContents(native);
    ipcMain.handle('add', (_event, a, b) => (a as number) + (b as number));

    fireRenderer(encodeEnvelope({ kind: 'invoke', id: 99, channel: 'add', args: [2, 3] }));
    await flush();

    expect(sent).toHaveLength(1);
    expect(decodeEnvelope(sent[0] ?? '')).toEqual({ kind: 'reply', id: 99, ok: true, result: 5 });
  });

  test('a throwing handler sends an error reply', async () => {
    const { native, sent, fireRenderer } = makeFakeNative();
    new WebContents(native);
    ipcMain.handle('boom', () => {
      throw new Error('nope');
    });

    fireRenderer(encodeEnvelope({ kind: 'invoke', id: 1, channel: 'boom', args: [] }));
    await flush();

    expect(decodeEnvelope(sent[0] ?? '')).toEqual({
      kind: 'reply',
      id: 1,
      ok: false,
      error: 'nope',
    });
  });

  test('a malformed renderer envelope is dropped without throwing', async () => {
    const { native, sent, fireRenderer } = makeFakeNative();
    new WebContents(native);
    expect(() => fireRenderer('not json{')).not.toThrow();
    await flush();
    expect(sent).toHaveLength(0);
  });
});

describe('WebContents did-finish-load', () => {
  test('re-emits the native load completion as a did-finish-load event', () => {
    const { native, fireDidFinishLoad } = makeFakeNative();
    const wc = new WebContents(native);
    let loads = 0;
    wc.on('did-finish-load', () => {
      loads += 1;
    });
    fireDidFinishLoad();
    fireDidFinishLoad();
    expect(loads).toBe(2);
  });
});

describe('WebContents.openDevTools', () => {
  test('delegates to the native view', () => {
    let opened = 0;
    const { native } = makeFakeNative();
    const wc = new WebContents({
      ...native,
      openDevTools: () => {
        opened += 1;
      },
    });
    wc.openDevTools();
    expect(opened).toBe(1);
  });
});

describe('WebContents.executeJavaScript', () => {
  test('returns the native eval Promise resolving to the script result', async () => {
    const { native } = makeFakeNative();
    const wc = new WebContents({
      ...native,
      executeJavaScript: (code) => Promise.resolve(`evaluated:${code}`),
    });
    const promise = wc.executeJavaScript('1 + 1');
    expect(promise).toBeInstanceOf(Promise);
    expect(await promise).toBe('evaluated:1 + 1');
  });

  test('propagates a native eval rejection', async () => {
    const { native } = makeFakeNative();
    const wc = new WebContents({
      ...native,
      executeJavaScript: () => Promise.reject(new Error('boom')),
    });
    await expect(wc.executeJavaScript('throw 1')).rejects.toThrow('boom');
  });
});

describe('WebContents navigation', () => {
  test('delegates reload, goBack and goForward to the native view', () => {
    const calls: string[] = [];
    const native: NativeWebContents = {
      loadURL: () => undefined,
      loadHTML: () => undefined,
      getURL: () => '',
      reload: () => calls.push('reload'),
      goBack: () => calls.push('goBack'),
      goForward: () => calls.push('goForward'),
      canGoBack: () => true,
      canGoForward: () => false,
      executeJavaScript: () => Promise.resolve(undefined),
      openDevTools: () => undefined,
      sendEnvelopeToRenderer: () => undefined,
      onRendererEnvelope: () => undefined,
      onDidFinishLoad: () => undefined,
    };
    const wc = new WebContents(native);
    wc.reload();
    wc.goBack();
    wc.goForward();
    expect(calls).toEqual(['reload', 'goBack', 'goForward']);
    expect(wc.canGoBack()).toBe(true);
    expect(wc.canGoForward()).toBe(false);
  });
});
