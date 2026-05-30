import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { createIpcRenderer } from '../../../src/renderer/api/ipc-renderer';

type FakeBridge = {
  send: (channel: string, ...args: unknown[]) => void;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, listener: (...args: unknown[]) => void) => void;
};

let sent: Array<{ channel: string; args: unknown[] }>;
let invoked: Array<{ channel: string; args: unknown[] }>;
let registered: Map<string, Array<(...args: unknown[]) => void>>;

beforeEach(() => {
  sent = [];
  invoked = [];
  registered = new Map();
  const bridge: FakeBridge = {
    send: (channel, ...args) => sent.push({ channel, args }),
    invoke: (channel, ...args) => {
      invoked.push({ channel, args });
      return Promise.resolve(`result:${channel}`);
    },
    on: (channel, listener) => {
      const list = registered.get(channel) ?? [];
      list.push(listener);
      registered.set(channel, list);
    },
  };
  Reflect.set(globalThis, '__sambar', bridge);
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, '__sambar');
});

describe('ipcRenderer.send', () => {
  test('forwards channel and args to the bridge', () => {
    createIpcRenderer().send('ping', 1, 2);
    expect(sent).toEqual([{ channel: 'ping', args: [1, 2] }]);
  });
});

describe('ipcRenderer.invoke', () => {
  test('forwards to the bridge and returns its promise', async () => {
    const result = await createIpcRenderer().invoke('compute', 41);
    expect(invoked).toEqual([{ channel: 'compute', args: [41] }]);
    expect(result).toBe('result:compute');
  });
});

describe('ipcRenderer.on', () => {
  test('registers a listener that receives an event object plus args', () => {
    const received: unknown[] = [];
    createIpcRenderer().on('news', (event, ...args) => received.push({ event, args }));
    registered.get('news')?.[0]?.('hello', 7);
    expect(received).toEqual([{ event: {}, args: ['hello', 7] }]);
  });
});

describe('ipcRenderer without a bridge', () => {
  test('throws a clear error if the preload bridge is absent', () => {
    Reflect.deleteProperty(globalThis, '__sambar');
    expect(() => createIpcRenderer().send('x')).toThrow(/preload/i);
  });
});
