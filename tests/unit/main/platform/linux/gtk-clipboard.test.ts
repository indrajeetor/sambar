import type { Pointer } from 'bun:ffi';
import { describe, expect, it } from 'bun:test';
import {
  CLIPBOARD_READ_CB_DEF,
  linuxClipboardBackend,
  settleReadText,
} from '../../../../../src/main/platform/linux/gtk-clipboard';

describe('CLIPBOARD_READ_CB_DEF (GAsyncReadyCallback ABI, shape-only)', () => {
  it('is (source, result, user_data) -> void', () => {
    expect(CLIPBOARD_READ_CB_DEF.args).toEqual(['ptr', 'ptr', 'ptr']);
    expect(CLIPBOARD_READ_CB_DEF.returns).toBe('void');
  });
});

describe('linuxClipboardBackend shape', () => {
  it('exposes readText, writeText and clear', () => {
    expect(typeof linuxClipboardBackend.readText).toBe('function');
    expect(typeof linuxClipboardBackend.writeText).toBe('function');
    expect(typeof linuxClipboardBackend.clear).toBe('function');
  });
});

describe('settleReadText (injected finish-fn, no real clipboard)', () => {
  it('returns the read string when the injected finish-fn yields a non-null char*', () => {
    const fakeResult = 7 as unknown as Pointer;
    const value = settleReadText({
      result: fakeResult,
      finish: (r) => {
        expect(r).toBe(fakeResult);
        return 99 as unknown as Pointer;
      },
      readString: (ptr) => {
        expect(ptr).toBe(99 as unknown as Pointer);
        return 'clipboard text';
      },
    });
    expect(value).toBe('clipboard text');
  });

  it('returns empty string when the injected finish-fn yields null (empty/none)', () => {
    const value = settleReadText({
      result: 0 as unknown as Pointer,
      finish: () => null,
      readString: () => {
        throw new Error('readString must not be called on a null char*');
      },
    });
    expect(value).toBe('');
  });

  it('returns empty string when finish throws (GError path)', () => {
    const value = settleReadText({
      result: 0 as unknown as Pointer,
      finish: () => {
        throw new Error('read failed');
      },
      readString: () => '/should/not/return',
    });
    expect(value).toBe('');
  });
});
