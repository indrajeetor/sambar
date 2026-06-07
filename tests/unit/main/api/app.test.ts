import { EventEmitter } from 'node:events';
import { describe, expect, test } from 'bun:test';
import { App, app } from '../../../../src/main/api/app';
import {
  type AppEnvironment,
  buildAppEnvironment,
  type EnvironmentDeps,
} from '../../../../src/main/api/app-environment';

const fakeEnv = (overrides: Partial<EnvironmentDeps> = {}): AppEnvironment =>
  buildAppEnvironment({
    platform: 'macos',
    home: '/Users/ada',
    temp: '/tmp',
    execPath: '/opt/homebrew/bin/bun',
    mainScript: '/proj/src/main.ts',
    cwd: '/proj',
    env: {},
    locale: 'en-US',
    readFile: (path) =>
      path === '/proj/package.json'
        ? JSON.stringify({ productName: 'Demo App', name: 'demo', version: '4.2.0' })
        : undefined,
    exit: () => undefined,
    ...overrides,
  });

/** A fresh App with an injected fake environment. */
const appWith = (overrides: Partial<EnvironmentDeps> = {}): App => {
  const a = new App();
  a.setEnvironmentForTesting(fakeEnv(overrides));
  return a;
};

describe('App singleton', () => {
  test('is an instance of App', () => {
    expect(app).toBeInstanceOf(App);
  });

  test('is a Node EventEmitter for Electron compatibility', () => {
    expect(app).toBeInstanceOf(EventEmitter);
  });
});

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
    let calls = 0;
    a.on('ready', () => {
      calls += 1;
    });
    a.markReady();
    a.markReady();
    a.markReady();
    expect(calls).toBe(1);
  });

  test('fires handlers registered before markReady', () => {
    const a = new App();
    let fired = false;
    a.on('ready', () => {
      fired = true;
    });
    a.markReady();
    expect(fired).toBe(true);
  });

  test('does not fire handlers registered after markReady', () => {
    const a = new App();
    a.markReady();
    let fired = false;
    a.on('ready', () => {
      fired = true;
    });
    expect(fired).toBe(false);
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

  test('invokes the start hook on first call when not ready', () => {
    const a = new App();
    let started = 0;
    a.setStartHook(() => {
      started += 1;
    });
    void a.whenReady();
    expect(started).toBe(1);
  });

  test('a start hook that marks ready resolves whenReady', async () => {
    const a = new App();
    a.setStartHook(() => a.markReady());
    await a.whenReady();
    expect(a.isReady).toBe(true);
  });
});

describe('App event surface', () => {
  test('before-quit handlers can be registered', () => {
    const a = new App();
    a.on('before-quit', () => undefined);
    expect(a.listenerCount('before-quit')).toBe(1);
  });

  test('window-all-closed handlers can be registered', () => {
    const a = new App();
    a.on('window-all-closed', () => undefined);
    expect(a.listenerCount('window-all-closed')).toBe(1);
  });

  test('supports the Electron addListener/removeListener alias surface', () => {
    const a = new App();
    const handler = (): void => undefined;
    a.addListener('will-quit', handler);
    expect(a.listenerCount('will-quit')).toBe(1);
    a.removeListener('will-quit', handler);
    expect(a.listenerCount('will-quit')).toBe(0);
  });
});

describe('App.quit', () => {
  /** An app whose env records exit codes instead of killing the process. */
  const quittableApp = (): { app: App; exits: number[] } => {
    const exits: number[] = [];
    const a = new App();
    a.setEnvironmentForTesting(
      fakeEnv({
        exit: (code) => {
          exits.push(code);
        },
      }),
    );
    return { app: a, exits };
  };

  test('emits before-quit, will-quit, then quit in order, then exits', () => {
    const { app: a, exits } = quittableApp();
    const order: string[] = [];
    a.on('before-quit', () => order.push('before-quit'));
    a.on('will-quit', () => order.push('will-quit'));
    a.on('quit', () => order.push('quit'));
    a.quit();
    expect(order).toEqual(['before-quit', 'will-quit', 'quit']);
    expect(exits).toEqual([0]);
  });

  test('before-quit preventDefault aborts the quit', () => {
    const { app: a, exits } = quittableApp();
    let willQuitFired = false;
    a.on('before-quit', (event: { preventDefault(): void }) => event.preventDefault());
    a.on('will-quit', () => {
      willQuitFired = true;
    });
    a.quit();
    expect(willQuitFired).toBe(false);
    expect(exits).toEqual([]);
  });

  test('will-quit preventDefault aborts the quit before quit/exit', () => {
    const { app: a, exits } = quittableApp();
    let quitFired = false;
    a.on('will-quit', (event: { preventDefault(): void }) => event.preventDefault());
    a.on('quit', () => {
      quitFired = true;
    });
    a.quit();
    expect(quitFired).toBe(false);
    expect(exits).toEqual([]);
  });

  test('emits quit with the exit code and exits with it', () => {
    const { app: a, exits } = quittableApp();
    let quitCode = -1;
    a.on('quit', (code: number) => {
      quitCode = code;
    });
    a.quit(5);
    expect(quitCode).toBe(5);
    expect(exits).toEqual([5]);
  });

  test('a prevented quit can be retried', () => {
    const { app: a, exits } = quittableApp();
    let prevent = true;
    a.on('before-quit', (event: { preventDefault(): void }) => {
      if (prevent) {
        event.preventDefault();
      }
    });
    a.quit();
    expect(exits).toEqual([]);
    prevent = false;
    a.quit();
    expect(exits).toEqual([0]);
  });
});

describe('App name & version', () => {
  test('getName prefers productName from the manifest', () => {
    expect(appWith().getName()).toBe('Demo App');
  });

  test('setName overrides getName and the name accessor mirrors it', () => {
    const a = appWith();
    a.setName('Renamed');
    expect(a.getName()).toBe('Renamed');
    expect(a.name).toBe('Renamed');
    a.name = 'Again';
    expect(a.getName()).toBe('Again');
  });

  test('getVersion returns the manifest version', () => {
    expect(appWith().getVersion()).toBe('4.2.0');
  });
});

describe('App paths', () => {
  test('getAppPath returns the resolved app root', () => {
    expect(appWith().getAppPath()).toBe('/proj');
  });

  test('getPath(userData) is appData/<name> using the resolved name', () => {
    expect(appWith().getPath('userData')).toBe('/Users/ada/Library/Application Support/Demo App');
  });

  test('getPath reflects a setName override in userData', () => {
    const a = appWith();
    a.setName('Renamed');
    expect(a.getPath('userData')).toBe('/Users/ada/Library/Application Support/Renamed');
  });

  test('setPath overrides a specific path', () => {
    const a = appWith();
    a.setPath('userData', '/custom/data');
    expect(a.getPath('userData')).toBe('/custom/data');
  });
});

describe('App locale', () => {
  test('getLocale returns the normalized locale', () => {
    expect(appWith({ locale: 'en_US.UTF-8' }).getLocale()).toBe('en-US');
  });

  test('getSystemLocale matches getLocale', () => {
    const a = appWith({ locale: 'fr-FR' });
    expect(a.getSystemLocale()).toBe('fr-FR');
  });

  test('getLocaleCountryCode derives the region', () => {
    expect(appWith({ locale: 'en-US' }).getLocaleCountryCode()).toBe('US');
  });

  test('getPreferredSystemLanguages reflects the environment', () => {
    expect(appWith({ env: { LANGUAGE: 'fr_FR:en_US' } }).getPreferredSystemLanguages()).toEqual([
      'fr-FR',
      'en-US',
    ]);
  });
});

describe('App.isPackaged', () => {
  test('is false under the dev runner', () => {
    expect(appWith({ execPath: '/opt/homebrew/bin/bun' }).isPackaged).toBe(false);
  });

  test('is true inside a packaged bundle', () => {
    expect(appWith({ execPath: '/Applications/Demo.app/Contents/MacOS/Demo' }).isPackaged).toBe(
      true,
    );
  });
});

describe('App.exit', () => {
  test('calls the environment exit with the given code', () => {
    let code = -1;
    const a = new App();
    a.setEnvironmentForTesting(
      fakeEnv({
        exit: (c) => {
          code = c;
        },
      }),
    );
    a.exit(7);
    expect(code).toBe(7);
  });

  test('defaults the exit code to 0', () => {
    let code = -1;
    const a = new App();
    a.setEnvironmentForTesting(
      fakeEnv({
        exit: (c) => {
          code = c;
        },
      }),
    );
    a.exit();
    expect(code).toBe(0);
  });
});
