import { dlopen, FFIType } from 'bun:ffi';
import { SambarError } from '../../../common/errors';
import { currentPlatform } from '../../../common/platform';

const FOUNDATION_PATH = '/System/Library/Frameworks/Foundation.framework/Foundation';
const LIBOBJC_PATH = 'libobjc.A.dylib';

const FOUNDATION_SYMBOLS = {
  NSGetSizeAndAlignment: {
    args: [FFIType.cstring, FFIType.pointer, FFIType.pointer],
    returns: FFIType.cstring,
  },
};

let foundationLib: unknown;

/**
 * Open `libobjc.A.dylib` plus `Foundation.framework` and expose the three
 * foundational Objective-C runtime symbols Sambar relies on:
 *
 * - `sel_registerName(const char *name) -> SEL`
 * - `objc_getClass(const char *name) -> Class`
 * - `objc_msgSend(id receiver, SEL selector) -> id` — the zero-extra-arg variant
 *
 * `objc_msgSend` is variadic in C; Bun's FFI cannot express that directly, so
 * we declare the simplest two-arg form here and add typed variants in later
 * modules as the call sites require them.
 *
 * Foundation is loaded for the side-effect of registering its classes
 * (`NSString`, `NSNumber`, `NSDictionary`, etc.) with the Objective-C runtime
 * so that subsequent `objc_getClass(...)` calls resolve them. Bun requires at
 * least one symbol per `dlopen`, so we declare `NSGetSizeAndAlignment` as an
 * anchor. The handle is kept at module scope to prevent GC from closing the
 * library.
 *
 * Only callable on macOS — throws {@link SambarError} on any other platform so
 * that this module remains safely *importable* on Linux/Windows (the failure
 * happens at call time, not at module load).
 */
export const loadCocoaFFI = () => {
  const platform = currentPlatform();
  if (platform !== 'macos') {
    throw new SambarError(
      `loadCocoaFFI() is only supported on macOS; current platform is ${platform}`,
    );
  }

  if (foundationLib === undefined) {
    foundationLib = dlopen(FOUNDATION_PATH, FOUNDATION_SYMBOLS);
  }

  return dlopen(LIBOBJC_PATH, {
    sel_registerName: {
      args: [FFIType.cstring],
      returns: FFIType.pointer,
    },
    objc_getClass: {
      args: [FFIType.cstring],
      returns: FFIType.pointer,
    },
    objc_msgSend: {
      args: [FFIType.pointer, FFIType.pointer],
      returns: FFIType.pointer,
    },
  });
};
