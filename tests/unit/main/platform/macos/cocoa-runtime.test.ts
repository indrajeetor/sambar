import { describe, expect, test } from 'bun:test';
import { SambarError } from '../../../../../src/common/errors';
import { currentPlatform } from '../../../../../src/common/platform';
import { cocoa } from '../../../../../src/main/platform/macos/cocoa-runtime';

describe('cocoa export', () => {
  test('is a function', () => {
    expect(typeof cocoa).toBe('function');
  });
});

if (currentPlatform() !== 'macos') {
  describe('cocoa() on non-macOS hosts', () => {
    test('throws SambarError (inherited from loadCocoaFFI)', () => {
      expect(() => cocoa()).toThrow(SambarError);
    });
  });
}
