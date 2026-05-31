import { afterEach, describe, expect, test } from 'bun:test';
import { UnsupportedPlatformError } from '../../../../src/common/errors';
import { Tray, setTrayBackendForTesting } from '../../../../src/main/api/tray';

/**
 * The Linux Tray path is honestly DEFERRED: GTK4 removed GtkStatusIcon and the
 * modern StatusNotifierItem (D-Bus) / libayatana-appindicator backend is a
 * future effort. Constructing a Tray on a Linux host must therefore throw
 * {@link UnsupportedPlatformError} rather than silently no-op.
 *
 * Overriding `process.platform` drives the Linux dispatch branch on any host
 * without `mock.module` (mirrors `tests/unit/main/platform/index.test.ts`); the
 * Linux backend throws before any FFI, so this is safe to exercise off-Linux.
 */

const original = Object.getOwnPropertyDescriptor(process, 'platform');

const setPlatform = (value: string): void => {
  Object.defineProperty(process, 'platform', { value, configurable: true });
};

afterEach(() => {
  // Clear any backend override the dispatch may have cached and restore platform.
  setTrayBackendForTesting(undefined);
  if (original) {
    Object.defineProperty(process, 'platform', original);
  }
});

describe('Tray on Linux (deferred)', () => {
  test('constructing a Tray throws UnsupportedPlatformError', () => {
    setPlatform('linux');
    expect(() => new Tray('/tmp/icon.png')).toThrow(UnsupportedPlatformError);
  });

  test('the error message explains the GTK4 / StatusNotifierItem reason', () => {
    setPlatform('linux');
    let message = '';
    try {
      new Tray('/tmp/icon.png');
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/Linux/);
    expect(message).toMatch(/GtkStatusIcon|StatusNotifierItem|appindicator/i);
  });
});
