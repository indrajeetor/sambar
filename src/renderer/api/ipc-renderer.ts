import { SambarError } from '../../common/errors';

/**
 * Renderer-side IPC — the drop-in equivalent of Electron's `ipcRenderer`.
 *
 * A thin, typed wrapper over the `globalThis.__sambar` bridge installed by the
 * preload bootstrap. `on` listeners receive an event object as their first
 * argument to match Electron's `(event, ...args)` shape (the event is a
 * placeholder for now; sender/port details arrive in a later phase).
 */

type RendererBridge = {
  send: (channel: string, ...args: unknown[]) => void;
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>;
  on: (channel: string, listener: (...args: unknown[]) => void) => void;
};

export type IpcRendererEvent = Record<string, never>;

export type IpcRenderer = {
  send(channel: string, ...args: unknown[]): void;
  invoke(channel: string, ...args: unknown[]): Promise<unknown>;
  on(channel: string, listener: (event: IpcRendererEvent, ...args: unknown[]) => void): void;
};

const getBridge = (): RendererBridge => {
  const bridge = Reflect.get(globalThis, '__sambar') as RendererBridge | undefined;
  if (bridge === undefined) {
    throw new SambarError(
      'Sambar preload bridge is not available; ensure a preload script ran before renderer code',
    );
  }
  return bridge;
};

/** Create the `ipcRenderer` object bound to the current page's bridge. */
export const createIpcRenderer = (): IpcRenderer => ({
  send(channel, ...args) {
    getBridge().send(channel, ...args);
  },
  invoke(channel, ...args) {
    return getBridge().invoke(channel, ...args);
  },
  on(channel, listener) {
    getBridge().on(channel, (...args) => listener({}, ...args));
  },
});
