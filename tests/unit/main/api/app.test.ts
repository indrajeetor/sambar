import { describe, expect, test } from 'bun:test';
import { App, app } from '../../../../src/main/api/app';

describe('App.isReady', () => {
  test('is false on a fresh instance', () => {
    expect(new App().isReady).toBe(false);
  });

  test('is true after markReady', () => {
    const a = new App();
    a.markReady();
    expect(a.isReady).toBe(true);
  });
});

describe('App.markReady', () => {
  test('emits ready exactly once when called multiple times', () => {
    const a = new App();
    const calls: number[] = [];
    a.on('ready', () => calls.push(1));
    a.markReady();
    a.markReady();
    a.markReady();
    expect(calls).toHaveLength(1);
  });

  test('fires handlers registered before markReady', () => {
    const a = new App();
    const calls: number[] = [];
    a.on('ready', () => calls.push(1));
    a.markReady();
    expect(calls).toHaveLength(1);
  });

  test('does not fire handlers registered after markReady', () => {
    const a = new App();
    a.markReady();
    const calls: number[] = [];
    a.on('ready', () => calls.push(1));
    expect(calls).toHaveLength(0);
  });
});

describe('App.whenReady', () => {
  test('resolves immediately when already ready', async () => {
    const a = new App();
    a.markReady();
    await a.whenReady();
  });

  test('resolves after markReady when called before', async () => {
    const a = new App();
    const promise = a.whenReady();
    a.markReady();
    await promise;
  });
});

describe('App event surface', () => {
  test('before-quit handlers can be registered', () => {
    const a = new App();
    a.on('before-quit', () => undefined);
    expect(a.listenerCount('before-quit')).toBe(1);
  });

  test('will-quit handlers can be registered', () => {
    const a = new App();
    a.on('will-quit', () => undefined);
    expect(a.listenerCount('will-quit')).toBe(1);
  });

  test('window-all-closed handlers can be registered', () => {
    const a = new App();
    a.on('window-all-closed', () => undefined);
    expect(a.listenerCount('window-all-closed')).toBe(1);
  });
});

describe('app singleton', () => {
  test('is an instance of App', () => {
    expect(app).toBeInstanceOf(App);
  });
});
