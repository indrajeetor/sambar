import { FFIType } from 'bun:ffi';
import { describe, expect, it } from 'bun:test';
import { UnsupportedPlatformError } from '../../../../../src/common/errors';
import { currentPlatform } from '../../../../../src/common/platform';
import { GLIB_FFI_SYMBOLS, loadGlibFFI } from '../../../../../src/main/platform/linux/glib-ffi';

describe('loadGlibFFI', () => {
  it('throws UnsupportedPlatformError on non-Linux platforms', () => {
    if (currentPlatform() === 'linux') {
      return;
    }
    expect(() => loadGlibFFI()).toThrow(UnsupportedPlatformError);
  });
});

describe('GLIB_FFI_SYMBOLS (shape-only ABI assertions)', () => {
  it('declares g_free as [ptr] -> void', () => {
    const sym = GLIB_FFI_SYMBOLS.g_free;
    expect(sym.args).toEqual([FFIType.pointer]);
    expect(sym.returns).toBe(FFIType.void);
  });

  it('declares g_bytes_new as [ptr (data), u64 (size)] -> pointer (GBytes*)', () => {
    const sym = GLIB_FFI_SYMBOLS.g_bytes_new;
    expect(sym.args).toEqual([FFIType.pointer, FFIType.u64]);
    expect(sym.returns).toBe(FFIType.pointer);
  });

  it('declares g_bytes_unref as [ptr (GBytes*)] -> void', () => {
    const sym = GLIB_FFI_SYMBOLS.g_bytes_unref;
    expect(sym.args).toEqual([FFIType.pointer]);
    expect(sym.returns).toBe(FFIType.void);
  });
});
