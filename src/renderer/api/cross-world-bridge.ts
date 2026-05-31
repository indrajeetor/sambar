/**
 * The cross-world DOM bridge that makes `contextBridge.exposeInMainWorld` work
 * after context isolation moved the preload (and `__sambar`) into a separate JS
 * world the page cannot see.
 *
 * Page world ↔ isolated world share the same `document` but have separate
 * globals, so they communicate via `document` CustomEvents (the Chrome
 * content-script pattern). Two scripts cooperate over a per-window random
 * channel id:
 *  - the PAGE-world stub ({@link generatePageWorldStub}), injected into the page
 *    world, materialises `window[key]` whose async methods dispatch request
 *    events and return Promises;
 *  - the ISOLATED-world side ({@link installCrossWorldHost}), run by the preload
 *    inside `contextBridge.exposeInMainWorld`, holds the real `api`, answers
 *    request events, and announces each exposed surface to the page stub.
 *
 * LIMITATIONS (by construction — do not paper over them):
 *  - Exposed functions are ASYNC-ONLY: every method on the page object returns a
 *    Promise, regardless of whether the real handler is synchronous.
 *  - Arguments and return values cross via CustomEvent `detail`, i.e. they are
 *    STRUCTURED-CLONE copied. No functions as arguments, no callbacks, no live
 *    object references, no class instances with behaviour — data only.
 *  - Non-function values on `api` are deep-cloned + frozen into the page object
 *    once at expose time; later mutations on the isolated side are NOT reflected.
 *  - The DOM channel is page-observable: a hostile page can see the events and
 *    forge requests. This is weaker than Electron's V8-level boundary. The
 *    random channel id only deters accidental collisions, not a determined page.
 */

/** The shared globalThis key the isolated side reads the channel id from. */
export const CHANNEL_GLOBAL_KEY = '__sambarBridgeChannel';

/**
 * Generate a per-window random channel id. Used to name the cross-world DOM
 * events so distinct windows (and accidental page listeners) do not collide.
 * Not a security boundary — the page can still observe the events.
 */
export const generateChannelId = (): string =>
  `__sambar_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;

/**
 * The isolated-world snippet that records the channel id on the isolated global
 * so `contextBridge` can read it. Injected into the isolated world BEFORE the
 * bridge bootstrap. Plain JS (no TS syntax).
 */
export const generateIsolatedChannelSetup = (channelId: string): string =>
  `globalThis[${JSON.stringify(CHANNEL_GLOBAL_KEY)}] = ${JSON.stringify(channelId)};`;

/** Build the reply-event name paired with a request channel id. */
export const replyChannel = (channelId: string): string => `${channelId}:reply`;

/** Build the page-stub "ready" announce-request event name for a channel id. */
export const readyChannel = (channelId: string): string => `${channelId}:ready`;

/** Build the isolated-side "announce" event name for a channel id. */
export const announceChannel = (channelId: string): string => `${channelId}:announce`;

/**
 * Generate the page-world user-script source that installs the cross-world
 * receiver. It listens for `announce` events (a key, its method names, and its
 * deep-cloned data values) and materialises a frozen `window[key]` whose methods
 * are async proxies over the DOM channel. It dispatches a `ready` event on load
 * so a host that exposed before the page existed re-announces.
 *
 * `channelId` is baked in at inject time and must match the isolated host's id.
 * Authored as plain JS (no TS syntax) so it reaches the page engine verbatim.
 */
export const generatePageWorldStub = (channelId: string): string => {
  const REQ = JSON.stringify(channelId);
  const REPLY = JSON.stringify(replyChannel(channelId));
  const READY = JSON.stringify(readyChannel(channelId));
  const ANNOUNCE = JSON.stringify(announceChannel(channelId));
  return `(function () {
  var doc = document;
  var nextCallId = 1;
  var pending = new Map();

  doc.addEventListener(${REPLY}, function (e) {
    var detail = e.detail || {};
    var slot = pending.get(detail.callId);
    if (!slot) {
      return;
    }
    pending.delete(detail.callId);
    if (detail.ok === true) {
      slot.resolve(detail.result);
    } else {
      slot.reject(new Error(detail.error || 'contextBridge call failed'));
    }
  });

  function makeMethod(key, method) {
    return function () {
      var args = Array.prototype.slice.call(arguments);
      var callId = nextCallId;
      nextCallId += 1;
      return new Promise(function (resolve, reject) {
        pending.set(callId, { resolve: resolve, reject: reject });
        doc.dispatchEvent(
          new CustomEvent(${REQ}, {
            detail: { callId: callId, key: key, method: method, args: args },
          })
        );
      });
    };
  }

  function materialise(detail) {
    var key = detail.key;
    if (Object.prototype.hasOwnProperty.call(window, key)) {
      return;
    }
    var target = {};
    var methods = detail.methods || [];
    for (var i = 0; i < methods.length; i += 1) {
      target[methods[i]] = makeMethod(key, methods[i]);
    }
    var values = detail.values || {};
    var valueKeys = Object.keys(values);
    for (var j = 0; j < valueKeys.length; j += 1) {
      target[valueKeys[j]] = values[valueKeys[j]];
    }
    Object.defineProperty(window, key, {
      value: Object.freeze(target),
      writable: false,
      configurable: false,
      enumerable: true,
    });
  }

  doc.addEventListener(${ANNOUNCE}, function (e) {
    materialise(e.detail || {});
  });

  // Tell the isolated host the page is ready so it can (re)announce.
  doc.dispatchEvent(new CustomEvent(${READY}));
})();`;
};

/** A DOM-event-bearing object the isolated host can attach to (the document). */
export type EventScope = {
  addEventListener(type: string, listener: (event: { detail?: unknown }) => void): void;
  dispatchEvent(event: { type: string; detail?: unknown }): boolean;
};

/** Minimal CustomEvent constructor shape, satisfied by the DOM's global. */
export type CustomEventCtor = new (
  type: string,
  init?: { detail?: unknown },
) => { type: string; detail?: unknown };

type RequestDetail = {
  readonly callId: number;
  readonly key: string;
  readonly method: string;
  readonly args: readonly unknown[];
};

/** Deep-clone a structured-clone-copyable value; falls back to JSON for hosts without it. */
const clone = <T>(value: T): T => {
  const sc = (globalThis as { structuredClone?: (v: unknown) => unknown }).structuredClone;
  if (typeof sc === 'function') {
    return sc(value) as T;
  }
  return JSON.parse(JSON.stringify(value)) as T;
};

/**
 * Install the ISOLATED-world host for one exposed surface. Registers the real
 * handlers, answers page-world request events for `key`, and announces the
 * surface (method names + cloned data values) so the page stub materialises
 * `window[key]`. Re-announces when the page stub signals `ready`.
 *
 * `scope` is the shared `document`; `CustomEventImpl` is the DOM `CustomEvent`.
 * Returns nothing — the listeners live for the page's lifetime (matching
 * Electron, where an exposed surface is permanent).
 */
export const installCrossWorldHost = (
  channelId: string,
  key: string,
  api: Record<string, unknown>,
  scope: EventScope,
  CustomEventImpl: CustomEventCtor,
): void => {
  const methods: string[] = [];
  const values: Record<string, unknown> = {};
  for (const [name, value] of Object.entries(api)) {
    if (typeof value === 'function') {
      methods.push(name);
    } else {
      values[name] = clone(value);
    }
  }

  scope.addEventListener(channelId, (event) => {
    const detail = event.detail as RequestDetail | undefined;
    if (detail === undefined || detail.key !== key) {
      return;
    }
    const handler = api[detail.method];
    const reply = (payload: { callId: number; ok: boolean; result?: unknown; error?: string }) => {
      scope.dispatchEvent(new CustomEventImpl(replyChannel(channelId), { detail: payload }));
    };
    if (typeof handler !== 'function') {
      reply({
        callId: detail.callId,
        ok: false,
        error: `contextBridge: no method "${detail.method}"`,
      });
      return;
    }
    Promise.resolve()
      .then(() => (handler as (...a: unknown[]) => unknown)(...detail.args))
      .then((result) => {
        reply({ callId: detail.callId, ok: true, result: clone(result) });
      })
      .catch((error: unknown) => {
        reply({
          callId: detail.callId,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      });
  });

  const announce = (): void => {
    scope.dispatchEvent(
      new CustomEventImpl(announceChannel(channelId), {
        detail: { key, methods, values: clone(values) },
      }),
    );
  };

  // Re-announce whenever the page stub (re)loads, then announce now in case the
  // stub is already listening.
  scope.addEventListener(readyChannel(channelId), () => {
    announce();
  });
  announce();
};
