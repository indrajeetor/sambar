import { describe, expect, test } from 'bun:test';
import { SambarError } from '../../../../../src/common/errors';
import { currentPlatform } from '../../../../../src/common/platform';
import {
  msgSendF64,
  msgSendI64,
  msgSendI64Ptr,
  msgSendInitWithContentRect,
  msgSendPtr,
  msgSendPtr4,
  msgSendPtrI64,
  msgSendPtrI64Ptr,
  msgSendPtrI64U8Ptr,
  msgSendPtrPtrI64Ptr,
  msgSendReturnsU8,
  msgSendU8,
} from '../../../../../src/main/platform/macos/cocoa-msgsend-variants';

describe('msgSendInitWithContentRect export', () => {
  test('is a function', () => {
    expect(typeof msgSendInitWithContentRect).toBe('function');
  });
});

describe('msgSendPtr export', () => {
  test('is a function', () => {
    expect(typeof msgSendPtr).toBe('function');
  });
});

describe('msgSendU8 export', () => {
  test('is a function', () => {
    expect(typeof msgSendU8).toBe('function');
  });
});

describe('msgSendF64 export', () => {
  test('is a function', () => {
    expect(typeof msgSendF64).toBe('function');
  });
});

describe('msgSendI64 export', () => {
  test('is a function', () => {
    expect(typeof msgSendI64).toBe('function');
  });
});

describe('msgSendI64Ptr export', () => {
  test('is a function', () => {
    expect(typeof msgSendI64Ptr).toBe('function');
  });
});

describe('msgSendReturnsU8 export', () => {
  test('is a function', () => {
    expect(typeof msgSendReturnsU8).toBe('function');
  });
});

describe('msgSendPtr4 export', () => {
  test('is a function', () => {
    expect(typeof msgSendPtr4).toBe('function');
  });
});

describe('msgSendPtrI64U8Ptr export', () => {
  test('is a function', () => {
    expect(typeof msgSendPtrI64U8Ptr).toBe('function');
  });
});

describe('msgSendPtrI64 export', () => {
  test('is a function', () => {
    expect(typeof msgSendPtrI64).toBe('function');
  });
});

describe('msgSendPtrI64Ptr export', () => {
  test('is a function', () => {
    expect(typeof msgSendPtrI64Ptr).toBe('function');
  });
});

describe('msgSendPtrPtrI64Ptr export', () => {
  test('is a function', () => {
    expect(typeof msgSendPtrPtrI64Ptr).toBe('function');
  });
});

if (currentPlatform() !== 'macos') {
  describe('msgSendInitWithContentRect on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendInitWithContentRect(0n, 0n, [0, 0, 0, 0], 0n, 0n, false)).toThrow(
        SambarError,
      );
    });
  });

  describe('msgSendPtr on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendPtr(0n, 0n, 0n)).toThrow(SambarError);
    });
  });

  describe('msgSendU8 on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendU8(0n, 0n, 0)).toThrow(SambarError);
    });
  });

  describe('msgSendF64 on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendF64(0n, 0n, 0)).toThrow(SambarError);
    });
  });

  describe('msgSendI64 on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendI64(0n, 0n, 0n)).toThrow(SambarError);
    });
  });

  describe('msgSendI64Ptr on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendI64Ptr(0n, 0n, 0n, 0n)).toThrow(SambarError);
    });
  });

  describe('msgSendReturnsU8 on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendReturnsU8(0n, 0n)).toThrow(SambarError);
    });
  });

  describe('msgSendPtr4 on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendPtr4(0n, 0n, 0n, 0n, 0n, 0n)).toThrow(SambarError);
    });
  });

  describe('msgSendPtrI64U8Ptr on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendPtrI64U8Ptr(0n, 0n, 0n, 0n, 0, 0n)).toThrow(SambarError);
    });
  });

  describe('msgSendPtrI64 on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendPtrI64(0n, 0n, 0n, 0n)).toThrow(SambarError);
    });
  });

  describe('msgSendPtrI64Ptr on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendPtrI64Ptr(0n, 0n, 0n, 0n, 0n)).toThrow(SambarError);
    });
  });

  describe('msgSendPtrPtrI64Ptr on non-macOS hosts', () => {
    test('throws SambarError', () => {
      expect(() => msgSendPtrPtrI64Ptr(0n, 0n, 0n, 0n, 0n, 0n)).toThrow(SambarError);
    });
  });
}
