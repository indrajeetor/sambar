import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createContextBridge } from '../../../src/renderer/api/context-bridge';

const KEYS = ['electronAPI', 'myApi'] as const;

const clear = (): void => {
  for (const key of KEYS) {
    Reflect.deleteProperty(globalThis, key);
  }
};

beforeEach(clear);
afterEach(clear);

const read = (key: string): unknown => Reflect.get(globalThis, key);

describe('contextBridge.exposeInMainWorld', () => {
  test('installs the API object on the global under the given key', () => {
    createContextBridge().exposeInMainWorld('electronAPI', { ping: () => 'pong' });
    const api = read('electronAPI') as { ping: () => string };
    expect(api.ping()).toBe('pong');
  });

  test('the exposed object is frozen', () => {
    createContextBridge().exposeInMainWorld('myApi', { value: 1 });
    expect(Object.isFrozen(read('myApi'))).toBe(true);
  });

  test('throws if the key is already taken', () => {
    const bridge = createContextBridge();
    bridge.exposeInMainWorld('myApi', { a: 1 });
    expect(() => bridge.exposeInMainWorld('myApi', { b: 2 })).toThrow(/already/i);
  });

  test('preserves functions so the renderer can call them', () => {
    let called = 0;
    createContextBridge().exposeInMainWorld('myApi', {
      doThing: () => {
        called += 1;
      },
    });
    (read('myApi') as { doThing: () => void }).doThing();
    expect(called).toBe(1);
  });
});
