import { nsString } from './cocoa-foundation';
import { msgSendPtr } from './cocoa-msgsend-variants';
import { cocoa } from './cocoa-runtime';
import type { Handle } from './objc';

/**
 * `WKContentWorld` accessors — the macOS half of context isolation.
 *
 * A `WKContentWorld` is a named JavaScript world that shares the page's DOM but
 * has its own global object. Injecting the `__sambar` bridge + user preload into
 * a dedicated named world (`SambarPreload`) keeps them invisible to page scripts
 * (Electron `contextIsolation: true`).
 *
 * The class resolves through the normal Objective-C class cache via
 * `objc_getClass('WKContentWorld')` once `WebKit.framework` is loaded (call
 * `loadWebKit()` first). Worlds are interned by WebKit — `+worldWithName:` with
 * the same name returns the same world — and we additionally memoise the handle
 * per process so repeated injections reuse one bigint.
 */

const worldCache = new Map<string, Handle>();

/**
 * Return the named `WKContentWorld` handle, creating it on first use and caching
 * it per process. Same name → same handle. Requires `loadWebKit()` to have run.
 */
export const getContentWorld = (name: string): Handle => {
  const cached = worldCache.get(name);
  if (cached !== undefined) {
    return cached;
  }
  const rt = cocoa();
  const world = msgSendPtr(
    rt.classes.get('WKContentWorld'),
    rt.selectors.get('worldWithName:'),
    nsString(name),
  );
  worldCache.set(name, world);
  return world;
};

/** Return the shared `+[WKContentWorld pageWorld]` (the page's main world). */
export const pageWorld = (): Handle => {
  const rt = cocoa();
  return rt.msgSend(rt.classes.get('WKContentWorld'), rt.selectors.get('pageWorld'));
};

/** Return `+[WKContentWorld defaultClientWorld]` (WebKit's default client world). */
export const defaultClientWorld = (): Handle => {
  const rt = cocoa();
  return rt.msgSend(rt.classes.get('WKContentWorld'), rt.selectors.get('defaultClientWorld'));
};

/** Clear the memoised world handles. Test-only. */
export const resetContentWorldCacheForTesting = (): void => {
  worldCache.clear();
};
