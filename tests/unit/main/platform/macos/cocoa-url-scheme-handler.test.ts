import { afterEach, describe, expect, test } from 'bun:test';
import {
  createUrlSchemeHandler,
  handleStartTask,
  setUrlSchemeDispatcherForTesting,
} from '../../../../../src/main/platform/macos/cocoa-url-scheme-handler';

/**
 * Host-safe unit tests for the macOS `WKURLSchemeHandler` module.
 *
 * The IMP cannot be invoked without a real `WKURLSchemeTask`, so the end-to-end
 * serve path is proven by the macOS integration test. Here we assert the module
 * exports the expected seam and that the injectable dispatcher is wired (so a
 * test can substitute the serve/decline decision).
 */

afterEach(() => {
  setUrlSchemeDispatcherForTesting(undefined);
});

describe('cocoa-url-scheme-handler exports', () => {
  test('createUrlSchemeHandler is a function', () => {
    expect(typeof createUrlSchemeHandler).toBe('function');
  });

  test('handleStartTask is a function', () => {
    expect(typeof handleStartTask).toBe('function');
  });

  test('setUrlSchemeDispatcherForTesting is a function', () => {
    expect(typeof setUrlSchemeDispatcherForTesting).toBe('function');
  });
});

describe('dispatcher injection seam', () => {
  test('a substituted dispatcher receiving a null task url declines without throwing', () => {
    let seen: string | undefined;
    setUrlSchemeDispatcherForTesting((url) => {
      seen = url;
      return undefined;
    });
    // task = 0n means requestUrlOf returns '' without touching real ObjC; the
    // decline path (failTask) is best-effort and swallows on a null task.
    expect(() => handleStartTask(0n)).not.toThrow();
    expect(seen).toBe('');
  });
});
