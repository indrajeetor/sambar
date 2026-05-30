import { describe, expect, test } from 'bun:test';
import { generatePreloadBootstrap } from '../../../src/renderer/preload-bootstrap';

type Bridge = {
  send: (channel: string, ...args: unknown[]) => void;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, listener: (...args: unknown[]) => void) => void;
  _dispatch: (raw: string) => void;
};

const evalBootstrap = (): { bridge: Bridge; posted: string[] } => {
  const posted: string[] = [];
  const scope: Record<string, unknown> = {};
  scope['webkit'] = {
    messageHandlers: { sambar: { postMessage: (msg: string) => posted.push(msg) } },
  };
  const fn = new Function('globalThis', generatePreloadBootstrap());
  fn(scope);
  return { bridge: scope['__sambar'] as Bridge, posted };
};

describe('generatePreloadBootstrap output', () => {
  test('returns a non-empty string', () => {
    expect(generatePreloadBootstrap().length).toBeGreaterThan(0);
  });

  test('contains no TypeScript syntax (it ships to a raw JS engine)', () => {
    const src = generatePreloadBootstrap();
    expect(src).not.toMatch(/:\s*(string|number|void|unknown|boolean)\b/);
    expect(src).not.toMatch(/\bas\s+(Record|string|number|unknown)\b/);
  });

  test('installs a __sambar object on the global', () => {
    expect(evalBootstrap().bridge).toBeDefined();
  });
});

describe('__sambar.send', () => {
  test('posts a send envelope through the message handler', () => {
    const { bridge, posted } = evalBootstrap();
    bridge.send('ping', 1, 'two');
    expect(JSON.parse(posted[0] ?? '')).toEqual({
      kind: 'send',
      channel: 'ping',
      args: [1, 'two'],
    });
  });
});

describe('__sambar.invoke', () => {
  test('posts an invoke envelope with a numeric id and returns a promise', () => {
    const { bridge, posted } = evalBootstrap();
    const promise = bridge.invoke('compute', 41);
    expect(promise).toBeInstanceOf(Promise);
    const env = JSON.parse(posted[0] ?? '');
    expect(env.kind).toBe('invoke');
    expect(env.channel).toBe('compute');
    expect(env.args).toEqual([41]);
    expect(typeof env.id).toBe('number');
  });

  test('resolves on a matching ok reply', async () => {
    const { bridge, posted } = evalBootstrap();
    const promise = bridge.invoke('compute', 41);
    const id = JSON.parse(posted[0] ?? '').id as number;
    bridge._dispatch(JSON.stringify({ kind: 'reply', id, ok: true, result: 42 }));
    expect(await promise).toBe(42);
  });

  test('rejects on an error reply', async () => {
    const { bridge, posted } = evalBootstrap();
    const promise = bridge.invoke('compute', 41);
    const id = JSON.parse(posted[0] ?? '').id as number;
    bridge._dispatch(JSON.stringify({ kind: 'reply', id, ok: false, error: 'nope' }));
    await expect(promise).rejects.toThrow('nope');
  });

  test('assigns distinct ids to concurrent invokes', () => {
    const { bridge, posted } = evalBootstrap();
    void bridge.invoke('a');
    void bridge.invoke('b');
    expect(JSON.parse(posted[0] ?? '').id).not.toBe(JSON.parse(posted[1] ?? '').id);
  });
});

describe('__sambar.on', () => {
  test('delivers a send envelope from main to a registered listener', () => {
    const { bridge } = evalBootstrap();
    const received: unknown[][] = [];
    bridge.on('news', (...args) => received.push(args));
    bridge._dispatch(JSON.stringify({ kind: 'send', channel: 'news', args: ['hello', 7] }));
    expect(received).toEqual([['hello', 7]]);
  });

  test('ignores send envelopes with no listener', () => {
    const { bridge } = evalBootstrap();
    expect(() =>
      bridge._dispatch(JSON.stringify({ kind: 'send', channel: 'nobody', args: [] })),
    ).not.toThrow();
  });
});
