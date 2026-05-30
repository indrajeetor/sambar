import { describe, expect, test } from 'bun:test';
import { currentPlatform } from '../../../src/common/platform';
import { cocoa } from '../../../src/main/platform/macos/cocoa-runtime';
import { defineObjcClass } from '../../../src/main/platform/macos/cocoa-runtime-class';

if (currentPlatform() === 'macos') {
  describe('defineObjcClass', () => {
    test('creates a registered subclass of NSObject', () => {
      expect(defineObjcClass('SambarTestClassA', 'NSObject', [])).not.toBe(0n);
    });

    test('an instance can be allocated and initialized', () => {
      const rt = cocoa();
      const cls = defineObjcClass('SambarTestClassB', 'NSObject', []);
      const instance = rt.msgSend(
        rt.msgSend(cls, rt.selectors.get('alloc')),
        rt.selectors.get('init'),
      );
      expect(instance).not.toBe(0n);
    });

    test('an added method fires its JSCallback when the selector is sent', () => {
      const rt = cocoa();
      let fired = 0;
      const cls = defineObjcClass('SambarTestClassC', 'NSObject', [
        {
          selector: 'sambarPing',
          typeEncoding: 'v@:',
          args: [],
          impl: () => {
            fired += 1;
          },
        },
      ]);
      const instance = rt.msgSend(
        rt.msgSend(cls, rt.selectors.get('alloc')),
        rt.selectors.get('init'),
      );
      rt.msgSend(instance, rt.selectors.get('sambarPing'));
      expect(fired).toBe(1);
    });
  });
}
