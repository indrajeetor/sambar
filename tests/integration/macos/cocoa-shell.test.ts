import { describe, expect, test } from 'bun:test';
import { currentPlatform } from '../../../src/common/platform';
import { beep, openExternal, showItemInFolder } from '../../../src/main/platform/macos/cocoa-shell';

/**
 * `openExternal`/`openPath` have real side effects (launching apps), so we only
 * assert the call path returns a boolean without crashing — not that something
 * actually opened. `beep` and `showItemInFolder` are safe no-ops on CI.
 */
if (currentPlatform() === 'macos') {
  describe('cocoa-shell', () => {
    test('openExternal returns a boolean for a well-formed URL', () => {
      // about:blank does not launch a visible app but exercises the NSWorkspace path.
      expect(typeof openExternal('about:blank')).toBe('boolean');
    });

    test('beep does not throw', () => {
      expect(() => beep()).not.toThrow();
    });

    test('showItemInFolder does not throw for a path', () => {
      expect(() => showItemInFolder('/tmp')).not.toThrow();
    });
  });
}
