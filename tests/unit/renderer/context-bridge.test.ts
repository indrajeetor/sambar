import { afterEach, describe, expect, test } from 'bun:test';
import { createContextBridge } from '../../../src/renderer/api/context-bridge';

afterEach(() => {
  delete (globalThis as Record<string, unknown>).electronAPI;
  delete (globalThis as Record<string, unknown>).myApi;
});

describe('contextBridge.exposeInMainWorld', () => {
  test('installs the API object on the global under the given key', () => {
    createContextBridge().exposeInMainWorld('electronAPI', { ping: () => 'pong' });
    const api = (globalThis as Record<string, unknown>).electronAPI as { ping: () => string };
    expect(api.ping()).toBe('pong');
  });

  test('the exposed object is frozen', () => {
    createContextBridge().exposeInMainWorld('myApi', { value: 1 });
    expect(Object.isFrozen((globalThis as Record<string, unknown>).myApi)).toBe(true);
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
    (globalThis as Record<string, unknown>).myApi as { doThing: () => void };
    ((globalThis as Record<string, unknown>).myApi as { doThing: () => void }).doThing();
    expect(called).toBe(1);
  });
});
