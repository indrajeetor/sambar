/**
 * Session — a drop-in subset of Electron's `session` / `Session`.
 *
 * v1 covers the default session's User-Agent override. `setUserAgent(ua)` stores
 * a process-wide default that every {@link BrowserWindow} created AFTERWARD
 * applies to its web contents at construction (before the first navigation).
 * Existing views keep their current UA — change a live one with
 * `webContents.setUserAgent(ua)`. `getUserAgent()` returns the override, or `''`
 * when none is set (the platform WebKit default is then used).
 *
 * Kept a dependency-free leaf (no `BrowserWindow` import) so it can be read at
 * window construction without an import cycle. Cookies / cache / storage / proxy
 * / partitions are a follow-up.
 */

export class Session {
  #userAgent = '';

  /** The session's User-Agent override, or `''` when none is set. */
  getUserAgent(): string {
    return this.#userAgent;
  }

  /** Set the default User-Agent applied to web contents created after this call. */
  setUserAgent(userAgent: string): void {
    this.#userAgent = userAgent;
  }

  /** Clear the override (revert to the platform default). Test-only convenience. */
  resetForTesting(): void {
    this.#userAgent = '';
  }
}

/** The `session` module — exposes the default session (Electron's `session.defaultSession`). */
export const session: { readonly defaultSession: Session } = {
  defaultSession: new Session(),
};
