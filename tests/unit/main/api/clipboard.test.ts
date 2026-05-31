import { afterEach, describe, expect, test } from 'bun:test';
import { UnsupportedPlatformError } from '../../../../src/common/errors';
import { currentPlatform } from '../../../../src/common/platform';
import {
  type ClipboardBackend,
  clipboard,
  setClipboardBackendForTesting,
} from '../../../../src/main/api/clipboard';

describe('clipboard export', () => {
  test('exposes readText, writeText and clear', () => {
    expect(typeof clipboard.readText).toBe('function');
    expect(typeof clipboard.writeText).toBe('function');
    expect(typeof clipboard.clear).toBe('function');
  });
});

describe('clipboard API with an injected backend (async readText contract)', () => {
  afterEach(() => {
    setClipboardBackendForTesting(undefined);
  });

  test('readText awaits the backend and resolves its value (Promise contract)', async () => {
    const fake: ClipboardBackend = {
      readText: () => Promise.resolve('from-backend'),
      writeText: () => undefined,
      clear: () => undefined,
    };
    setClipboardBackendForTesting(fake);
    const result = clipboard.readText();
    expect(result).toBeInstanceOf(Promise);
    expect(await result).toBe('from-backend');
  });

  test('readText flattens a synchronously-returned string from the backend', async () => {
    const fake: ClipboardBackend = {
      readText: () => 'sync-value',
      writeText: () => undefined,
      clear: () => undefined,
    };
    setClipboardBackendForTesting(fake);
    expect(await clipboard.readText()).toBe('sync-value');
  });

  test('writeText delegates synchronously to the backend', () => {
    const writes: string[] = [];
    const fake: ClipboardBackend = {
      readText: () => Promise.resolve(''),
      writeText: (text) => {
        writes.push(text);
      },
      clear: () => undefined,
    };
    setClipboardBackendForTesting(fake);
    const ret = clipboard.writeText('hello');
    expect(ret).toBeUndefined();
    expect(writes).toEqual(['hello']);
  });

  test('clear delegates synchronously to the backend', () => {
    let cleared = 0;
    const fake: ClipboardBackend = {
      readText: () => Promise.resolve(''),
      writeText: () => undefined,
      clear: () => {
        cleared += 1;
      },
    };
    setClipboardBackendForTesting(fake);
    const ret = clipboard.clear();
    expect(ret).toBeUndefined();
    expect(cleared).toBe(1);
  });
});

if (currentPlatform() !== 'macos' && currentPlatform() !== 'linux') {
  describe('clipboard on platforms without a backend', () => {
    test('readText rejects with UnsupportedPlatformError', async () => {
      await expect(clipboard.readText()).rejects.toBeInstanceOf(UnsupportedPlatformError);
    });

    test('writeText throws UnsupportedPlatformError', () => {
      expect(() => clipboard.writeText('x')).toThrow(UnsupportedPlatformError);
    });

    test('clear throws UnsupportedPlatformError', () => {
      expect(() => clipboard.clear()).toThrow(UnsupportedPlatformError);
    });
  });
}
