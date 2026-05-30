import { SambarError } from '../../common/errors';

/**
 * Renderer-side `contextBridge` — the drop-in equivalent of Electron's.
 *
 * `exposeInMainWorld(key, api)` installs `api` on the page's global under `key`
 * and freezes it, so page scripts can call into the preload-defined surface
 * without being able to mutate it. (Full cross-world isolation arrives when
 * preload runs in a dedicated `WKContentWorld`; the API contract is stable now.)
 */

export type ContextBridge = {
  exposeInMainWorld(key: string, api: Record<string, unknown>): void;
};

/** Create the `contextBridge` object bound to the current page's global. */
export const createContextBridge = (): ContextBridge => ({
  exposeInMainWorld(key, api) {
    if (Object.hasOwn(globalThis, key)) {
      throw new SambarError(`contextBridge: "${key}" is already defined in the main world`);
    }
    Reflect.set(globalThis, key, Object.freeze({ ...api }));
  },
});
