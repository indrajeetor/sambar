import type { Pointer } from 'bun:ffi';
import { ClassCache } from './cocoa-class-cache';
import { loadCocoaFFI } from './cocoa-ffi';
import { SelectorCache } from './cocoa-selector-cache';
import { cstr } from './cstr';

/**
 * The live Cocoa runtime — caches backed by the real `libobjc` symbols.
 *
 * Sambar uses {@link cocoa} as a process-wide singleton. The first call opens
 * `libobjc.A.dylib` + `Foundation.framework` via `bun:ffi`, builds the selector
 * and class caches with the live registrar / resolver, and returns the shared
 * runtime object. Subsequent calls return the same instance.
 *
 * Pointers are exposed as `bigint` throughout Sambar so that downstream code
 * has a single uniform handle type. We pay a tiny conversion cost at the FFI
 * boundary (Bun's pointer args want `Pointer`, which is a branded `number`).
 */
export type CocoaRuntime = {
  readonly selectors: SelectorCache;
  readonly classes: ClassCache;
  readonly msgSend: (receiver: bigint, selector: bigint) => bigint;
};

let cached: CocoaRuntime | undefined;

const pointerIn = (n: bigint): Pointer => Number(n) as Pointer;
const bigIntOut = (p: Pointer | null): bigint => (p === null ? 0n : BigInt(p));

/**
 * Return the shared Cocoa runtime. Lazy — `libobjc` and `Foundation` are
 * opened on first call. Throws {@link SambarError} (via `loadCocoaFFI`) on any
 * non-macOS platform.
 */
export const cocoa = (): CocoaRuntime => {
  if (cached !== undefined) {
    return cached;
  }

  const ffi = loadCocoaFFI();

  cached = {
    selectors: new SelectorCache((name) => bigIntOut(ffi.symbols.sel_registerName(cstr(name)))),
    classes: new ClassCache((name) => bigIntOut(ffi.symbols.objc_getClass(cstr(name)))),
    msgSend: (receiver, selector) =>
      bigIntOut(ffi.symbols.objc_msgSend(pointerIn(receiver), pointerIn(selector))),
  };
  return cached;
};
