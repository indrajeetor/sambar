import { dlopen, FFIType } from 'bun:ffi';
import { describe, expect, test } from 'bun:test';
import { currentPlatform } from '../../../src/common/platform';
import { cocoa } from '../../../src/main/platform/macos/cocoa-runtime';

if (currentPlatform() === 'macos') {
  describe('NSWindow initWithContentRect:styleMask:backing:defer: via msgSend struct-as-doubles', () => {
    test('returns a non-zero window when CGRect is decomposed into four f64 args', () => {
      const rt = cocoa();

      const variant = dlopen('libobjc.A.dylib', {
        objc_msgSend: {
          args: [
            FFIType.pointer,
            FFIType.pointer,
            FFIType.f64,
            FFIType.f64,
            FFIType.f64,
            FFIType.f64,
            FFIType.u64,
            FFIType.u64,
            FFIType.u8,
          ],
          returns: FFIType.pointer,
        },
      });

      const nsWindow = rt.classes.get('NSWindow');
      const allocSel = rt.selectors.get('alloc');
      const initSel = rt.selectors.get('initWithContentRect:styleMask:backing:defer:');
      const releaseSel = rt.selectors.get('release');

      const allocated = rt.msgSend(nsWindow, allocSel);
      expect(allocated).not.toBe(0n);

      const initialized = variant.symbols.objc_msgSend(
        Number(allocated) as never,
        Number(initSel) as never,
        100,
        100,
        400,
        300,
        15n,
        2n,
        0,
      );

      expect(initialized).not.toBeNull();
      expect(initialized).not.toBe(0);

      if (initialized !== null) {
        rt.msgSend(BigInt(initialized), releaseSel);
      }
    });
  });
}
