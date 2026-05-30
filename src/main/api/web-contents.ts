import { EventEmitter } from 'node:events';
import { isAbsolute, resolve } from 'node:path';
import type { NativeWebContents } from '../platform/native';

/**
 * Controls and observes the content rendered inside a {@link BrowserWindow} —
 * the drop-in equivalent of Electron's `webContents`. Content methods on
 * `BrowserWindow` delegate here (D025). Extends Node {@link EventEmitter}.
 */

let nextId = 1;

/** Reset the id counter. Test-only. */
export const resetWebContentsIdsForTesting = (): void => {
  nextId = 1;
};

export class WebContents extends EventEmitter {
  /** Process-unique id, matching Electron's `webContents.id`. */
  readonly id: number;
  readonly #native: NativeWebContents;

  constructor(native: NativeWebContents) {
    super();
    this.id = nextId;
    nextId += 1;
    this.#native = native;
  }

  /** Navigate to a URL. */
  loadURL(url: string): void {
    this.#native.loadURL(url);
  }

  /** Load a local file by path. */
  loadFile(filePath: string): void {
    const absolute = isAbsolute(filePath) ? filePath : resolve(filePath);
    this.#native.loadURL(`file://${absolute}`);
  }

  /** The current page URL, or `''` before the first navigation. */
  getURL(): string {
    return this.#native.getURL();
  }

  /** Evaluate JavaScript in the page (fire-and-forget, D022). */
  executeJavaScript(code: string): void {
    this.#native.executeJavaScript(code);
  }
}
