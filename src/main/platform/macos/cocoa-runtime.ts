import { cstr } from '../cstr';
import { ClassCache } from './cocoa-class-cache';
import { loadCocoaFFI } from './cocoa-ffi';
import { SelectorCache } from './cocoa-selector-cache';
import { bigIntOut, type Handle, ptrIn } from './objc';

/**
 * The live Cocoa runtime — caches backed by the real `libobjc` symbols.
 *
 * Sambar uses {@link cocoa} as a process-wide singleton. The first call opens
 * `libobjc.A.dylib` + `Foundation.framework` via `bun:ffi`, builds the selector
 * and class caches with the live registrar / resolver, and returns the shared
 * runtime object. Subsequent calls return the same instance.
 *
 * Handles are exposed as `bigint` throughout Sambar (D016); the `Pointer`
 * conversion is isolated in {@link ptrIn} / {@link bigIntOut} from `./objc`.
 */
export type CocoaRuntime = {
  readonly selectors: SelectorCache;
  readonly classes: ClassCache;
  readonly msgSend: (receiver: Handle, selector: Handle) => Handle;
};

let cached: CocoaRuntime | undefined;

/**
 * Return the shared Cocoa runtime. Lazy — `libobjc` and `Foundation` are
 * opened on first call. Throws {@link UnsupportedPlatformError} (via
 * `loadCocoaFFI`) on any non-macOS platform.
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
      bigIntOut(ffi.symbols.objc_msgSend(ptrIn(receiver), ptrIn(selector))),
  };
  return cached;
};
