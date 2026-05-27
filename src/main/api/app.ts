import { TypedEmitter } from '../../common/typed-emitter';

/**
 * Events emitted by the application lifecycle.
 *
 * Mirrors Electron's `app` event surface for the events Sambar implements today.
 * Additional events (`activate`, `web-contents-created`, etc.) land in later phases.
 */
export type AppEventMap = {
  ready: readonly [];
  'before-quit': readonly [];
  'will-quit': readonly [];
  'window-all-closed': readonly [];
};

/**
 * Controls the application lifecycle.
 *
 * In normal use, consumers interact with the {@link app} singleton, not with
 * the class directly. The class is exported primarily to make testing easier.
 */
export class App extends TypedEmitter<AppEventMap> {
  #ready = false;

  /** Whether the `ready` event has already fired at least once. */
  get isReady(): boolean {
    return this.#ready;
  }

  /**
   * Resolves once the app has signalled `ready`. Resolves immediately if the
   * app is already in the ready state.
   */
  whenReady(): Promise<void> {
    if (this.#ready) {
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => {
      this.once('ready', () => resolve());
    });
  }

  /**
   * Mark the app as ready and emit the `ready` event. Idempotent: subsequent
   * calls are no-ops.
   *
   * @internal Called by the platform bootstrap layer once the native runtime
   *           is up. Not part of the public API surface.
   */
  markReady(): void {
    if (this.#ready) {
      return;
    }
    this.#ready = true;
    this.emit('ready');
  }
}

/**
 * The application lifecycle singleton. Drop-in equivalent of Electron's `app`.
 */
export const app = new App();
