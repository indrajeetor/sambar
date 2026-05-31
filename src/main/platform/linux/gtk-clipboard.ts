import { CString, JSCallback, type Pointer, ptr } from 'bun:ffi';
import type { ClipboardBackend } from '../../api/clipboard';
import { cstr } from '../cstr';
import { loadGdkFFI } from './gdk-ffi';
import { loadGlibFFI } from './glib-ffi';

/**
 * Linux clipboard backend — the GDK 4 equivalent of the macOS `cocoa-clipboard`
 * module. The display's `GdkClipboard*` (from
 * `gdk_display_get_clipboard(gdk_display_get_default())`) owns plain-text
 * read/write against the system selection.
 *
 * Unlike Cocoa's synchronous `NSPasteboard stringForType:`, GDK's clipboard read
 * is asynchronous-only: `gdk_clipboard_read_text_async` kicks off the read and
 * invokes a `GAsyncReadyCallback` when it completes; `gdk_clipboard_read_text_finish`
 * extracts the transfer-full `char*` (NULL on empty/none). `readText` therefore
 * returns a Promise. Writes are synchronous: a `GdkContentProvider` wrapping the
 * UTF-8 bytes is installed via `gdk_clipboard_set_content` (a NULL provider
 * clears the clipboard).
 *
 * JSCallback lifecycle safety (a past SIGSEGV regression — mirrors gtk-dialog's
 * `runAsyncDialog`): the `GAsyncReadyCallback` thunk MUST stay reachable until
 * GDK fires it, and it MUST NOT be `close()`d synchronously inside its own
 * invocation (that frees the native trampoline the GDK caller is about to return
 * into). Each in-flight callback is retained in the module-level {@link inFlight}
 * set and its `close()` is deferred to a later tick via `setTimeout(..., 0)`.
 */

/** ABI shape for `GAsyncReadyCallback`: `(source, result, user_data) -> void`. */
export const CLIPBOARD_READ_CB_DEF = { args: ['ptr', 'ptr', 'ptr'], returns: 'void' } as const;

/** The MIME type GDK uses for UTF-8 plain text on the clipboard. */
const TEXT_MIME = 'text/plain;charset=utf-8';

/** Every JSCallback awaiting a GDK clipboard read. Retained so Bun can't GC it. */
const inFlight = new Set<JSCallback>();

/** Resolve the display's `GdkClipboard*`, throwing if there is no default display. */
const getClipboard = (): Pointer => {
  const gdk = loadGdkFFI();
  const display = gdk.symbols.gdk_display_get_default();
  if (display === null) {
    throw new Error('gdk_display_get_default() returned null (no display / GTK not initialised)');
  }
  const clipboard = gdk.symbols.gdk_display_get_clipboard(display);
  if (clipboard === null) {
    throw new Error('gdk_display_get_clipboard() returned null');
  }
  return clipboard;
};

/** Settle inputs for `gdk_clipboard_read_text_finish`, with finish + reader injectable. */
export type SettleReadTextArgs = {
  readonly result: Pointer;
  /** Calls `gdk_clipboard_read_text_finish`; returns a `char*` or null; may throw. */
  readonly finish: (result: Pointer) => Pointer | null;
  /** Reads (and frees) the string out of a non-null `char*`. */
  readonly readString: (text: Pointer) => string;
};

/**
 * Produce the clipboard text from a `GAsyncResult`. A null `char*` (empty/none)
 * or a thrown `finish` (GError path) yields `''`. Pure but for the injected
 * functions, so it is unit-testable without a real clipboard.
 */
export const settleReadText = (args: SettleReadTextArgs): string => {
  let text: Pointer | null;
  try {
    text = args.finish(args.result);
  } catch {
    return '';
  }
  return text === null ? '' : args.readString(text);
};

/** Read the transfer-full `char*` into a JS string, then `g_free` it. */
const readGString = (text: Pointer): string => {
  const glib = loadGlibFFI();
  const value = new CString(text).toString();
  glib.symbols.g_free(text);
  return value;
};

const readText = (): Promise<string> => {
  const gdk = loadGdkFFI();
  const clipboard = getClipboard();
  return new Promise<string>((resolve) => {
    const callback = new JSCallback((_source: Pointer, result: Pointer, _userData: Pointer) => {
      const value = settleReadText({
        result,
        finish: (r) => gdk.symbols.gdk_clipboard_read_text_finish(clipboard, r, null),
        readString: readGString,
      });
      resolve(value);
      setTimeout(() => {
        inFlight.delete(callback);
        callback.close();
      }, 0);
    }, CLIPBOARD_READ_CB_DEF);
    inFlight.add(callback);
    const cbPtr = callback.ptr;
    if (cbPtr === null) {
      inFlight.delete(callback);
      throw new Error('Failed to allocate a GAsyncReadyCallback thunk for the clipboard read');
    }
    gdk.symbols.gdk_clipboard_read_text_async(clipboard, null, cbPtr, null);
  });
};

const writeText = (text: string): void => {
  const gdk = loadGdkFFI();
  const glib = loadGlibFFI();
  const clipboard = getClipboard();
  // Exact UTF-8 bytes (no trailing NUL — GBytes carries an explicit length).
  // `g_bytes_new` copies, so `bytes` need only outlive that call; keep it
  // referenced until then.
  const bytes = new TextEncoder().encode(text);
  const gbytes = glib.symbols.g_bytes_new(ptr(bytes), bytes.length);
  if (gbytes === null) {
    throw new Error('g_bytes_new() returned null');
  }
  const provider = gdk.symbols.gdk_content_provider_new_for_bytes(cstr(TEXT_MIME), gbytes);
  // The provider took its own ref on the GBytes; drop the local one. The provider
  // itself is owned by the clipboard once set_content takes a ref.
  glib.symbols.g_bytes_unref(gbytes);
  if (provider === null) {
    throw new Error('gdk_content_provider_new_for_bytes() returned null');
  }
  gdk.symbols.gdk_clipboard_set_content(clipboard, provider);
};

const clear = (): void => {
  const gdk = loadGdkFFI();
  const clipboard = getClipboard();
  gdk.symbols.gdk_clipboard_set_content(clipboard, null);
};

/** The Linux native clipboard backend (plain text via GDK 4). */
export const linuxClipboardBackend: ClipboardBackend = {
  readText,
  writeText,
  clear,
};
