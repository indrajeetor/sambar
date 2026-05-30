import { createContextBridge } from './api/context-bridge';
import { createIpcRenderer } from './api/ipc-renderer';

export { createIpcRenderer, type IpcRenderer, type IpcRendererEvent } from './api/ipc-renderer';
export { createContextBridge, type ContextBridge } from './api/context-bridge';
export { generatePreloadBootstrap } from './preload-bootstrap';

/** The `ipcRenderer` singleton. Drop-in equivalent of Electron's `ipcRenderer`. */
export const ipcRenderer = createIpcRenderer();

/** The `contextBridge` singleton. Drop-in equivalent of Electron's `contextBridge`. */
export const contextBridge = createContextBridge();
