import { CString, JSCallback, type Pointer } from 'bun:ffi';
import { cstr } from '../cstr';
import {
  DBUS_SIGNAL_CB_DEF,
  G_BUS_TYPE_SYSTEM,
  G_DBUS_SIGNAL_FLAGS_NONE,
  loadGDBusFFI,
} from './gdbus-ffi';

/**
 * Deadlock-safe GDBus signal-subscription primitive for the Linux backend.
 *
 * THE RULE (hard-won — a synchronous GIO read once hung CI for hours, see
 * gtk-clipboard.ts): never block Sambar's single pumped thread on a D-Bus reply that
 * only the GMainContext dispatch can deliver. So this module exposes ONLY subscription,
 * never a `*_call_sync`. A subscribed `GDBusSignalCallback` fires on the default
 * GMainContext during ordinary cooperative-pump iterations (gtk-run-loop.ts) — no thread
 * ever blocks for it.
 *
 * `getSystemBus()` is gated behind `SAMBAR_ENABLE_LINUX_POWER` (mirroring the libsecret
 * keyring gate): CI never sets it, so the bus is NEVER touched on the headless runner and
 * the backend is a guaranteed no-op there. When the flag IS set, it calls
 * `g_bus_get_sync(SYSTEM)`. That IS blocking socket I/O on the calling thread, but the
 * handshake is PUMP-INDEPENDENT (it does not need our GMainContext to turn), so unlike a
 * `*_call_sync` reply it cannot deadlock against the pump, and it returns NULL fast when no
 * bus is reachable. It is still blocking, hence gated and called AT MOST ONCE (the result
 * — including NULL — is cached; the connection is a process-wide singleton anyway).
 *
 * THREAD INVARIANT: a subscribed signal is dispatched on the thread-default GMainContext
 * of the thread that called `subscribeSignal`. The pump (gtk-run-loop.ts) iterates the
 * GLOBAL-default context, so subscriptions MUST be made on the pumped main thread with no
 * `g_main_context_push_thread_default` in effect (true at `onReady`) — otherwise signals
 * dispatch to a context the pump never iterates and silently never fire.
 *
 * JSCallback lifetime: a subscription here is PERMANENT (never unsubscribed in the live
 * backend), so its callback is retained forever in {@link retainedSubscriptionCallbacks}
 * — the gtk-native-theme.ts long-lived-connection pattern, NOT the gtk-clipboard one-shot
 * deferred-close dance. Because the callback never closes, the close-in-own-invocation
 * SIGSEGV class cannot occur here.
 */

/** A D-Bus signal match (each field omitted = match any). */
export type SignalMatch = {
  readonly sender?: string;
  readonly interface?: string;
  readonly member?: string;
  readonly path?: string;
  readonly arg0?: string;
};

/** What a decoded signal hands back to JS. */
export type SignalEvent = {
  readonly signalName: string;
  /** The BORROWED `parameters` GVariant tuple — read synchronously; do NOT unref it. */
  readonly parameters: Pointer;
};

/** Whether the live system-bus path is enabled. CI leaves this unset → no bus is touched. */
const liveSystemBusEnabled = (): boolean => process.env['SAMBAR_ENABLE_LINUX_POWER'] === '1';

/** Cached system-bus result: `undefined` = not probed, `null` = absent/disabled, else the connection. */
const cache: { systemBus: Pointer | null | undefined } = { systemBus: undefined };

/** Retain every subscription callback for the process lifetime (Bun must not GC the thunk). */
const retainedSubscriptionCallbacks: JSCallback[] = [];

/**
 * Call `g_bus_get_sync(SYSTEM)` directly, bypassing the env gate. Returns the connection
 * or null; never throws. Exposed so an integration test can verify the call resolves FAST
 * (it must not hang) on a runner regardless of whether a system bus is present.
 */
export const probeSystemBusUnchecked = (): Pointer | null => {
  const gdbus = loadGDBusFFI();
  try {
    // NULL GError**: a NULL return already means "no/failed bus".
    return gdbus.symbols.g_bus_get_sync(G_BUS_TYPE_SYSTEM, null, null);
  } catch {
    return null;
  }
};

/**
 * The system `GDBusConnection*`, or `null` when the env gate is off OR there is no bus.
 * NEVER throws and never deadlocks (the bus handshake is pump-independent blocking I/O —
 * see the module note). Cached (and caches `null` so a missing/disabled bus is probed at
 * most once).
 */
export const getSystemBus = (): Pointer | null => {
  if (cache.systemBus !== undefined) {
    return cache.systemBus;
  }
  const conn = liveSystemBusEnabled() ? probeSystemBusUnchecked() : null;
  cache.systemBus = conn;
  return conn;
};

/**
 * Subscribe `cb` to a D-Bus signal on `conn`. The callback fires on the GMainContext
 * during normal pump iterations. The JSCallback is retained for the process lifetime
 * (subscriptions here are permanent). Returns the `guint` subscription id.
 *
 * `cb` receives the BORROWED `parameters` GVariant (owned by GIO — read synchronously,
 * never unref). A faulty `cb` is swallowed so it cannot take down the pump dispatch.
 */
export const subscribeSignal = (
  conn: Pointer,
  match: SignalMatch,
  cb: (event: SignalEvent) => void,
): number => {
  const gdbus = loadGDBusFFI();
  const callback = new JSCallback(
    (
      _connection: Pointer,
      _senderName: Pointer,
      _objectPath: Pointer,
      _interfaceName: Pointer,
      signalName: Pointer,
      parameters: Pointer,
      _userData: Pointer,
    ): void => {
      try {
        cb({
          signalName: signalName === null ? '' : new CString(signalName).toString(),
          parameters,
        });
      } catch {
        // A faulty handler must not crash the GMainContext dispatch.
      }
    },
    DBUS_SIGNAL_CB_DEF,
  );
  const cbPtr = callback.ptr;
  if (cbPtr === null) {
    throw new Error('Failed to allocate a GDBusSignalCallback thunk');
  }
  retainedSubscriptionCallbacks.push(callback);
  return gdbus.symbols.g_dbus_connection_signal_subscribe(
    conn,
    match.sender === undefined ? null : cstr(match.sender),
    match.interface === undefined ? null : cstr(match.interface),
    match.member === undefined ? null : cstr(match.member),
    match.path === undefined ? null : cstr(match.path),
    match.arg0 === undefined ? null : cstr(match.arg0),
    G_DBUS_SIGNAL_FLAGS_NONE,
    cbPtr,
    null,
    null,
  );
};

/** Reset the system-bus probe cache. Test-only. */
export const resetSystemBusCacheForTesting = (): void => {
  cache.systemBus = undefined;
};
