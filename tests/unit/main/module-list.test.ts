import { describe, expect, test } from 'bun:test';
import {
  IMPLEMENTED_MODULES,
  isImplemented,
  KNOWN_ELECTRON_MODULES,
  notImplementedMessage,
} from '../../../src/main/module-list';

describe('KNOWN_ELECTRON_MODULES', () => {
  const known: readonly string[] = KNOWN_ELECTRON_MODULES;
  test('includes the headline Electron main-process modules', () => {
    for (const name of ['app', 'BrowserWindow', 'ipcMain', 'Menu', 'Tray', 'dialog']) {
      expect(known).toContain(name);
    }
  });
});

describe('IMPLEMENTED_MODULES', () => {
  const implemented: readonly string[] = IMPLEMENTED_MODULES;
  const known: readonly string[] = KNOWN_ELECTRON_MODULES;

  test('contains the modules Sambar ships today', () => {
    for (const name of ['app', 'BrowserWindow', 'WebContents', 'ipcMain']) {
      expect(implemented).toContain(name);
    }
  });

  test('every implemented module is also a known Electron module', () => {
    for (const name of implemented) {
      expect(known).toContain(name);
    }
  });

  test('does not yet claim Tier-3 modules like Menu or Tray', () => {
    expect(implemented).not.toContain('Menu');
    expect(implemented).not.toContain('Tray');
  });
});

describe('isImplemented', () => {
  test('is true for a shipped module', () => {
    expect(isImplemented('app')).toBe(true);
  });

  test('is false for a known-but-unshipped module', () => {
    expect(isImplemented('Menu')).toBe(false);
  });

  test('is false for an unknown name', () => {
    expect(isImplemented('TotallyMadeUp')).toBe(false);
  });
});

describe('notImplementedMessage', () => {
  test('names the module and the project', () => {
    const message = notImplementedMessage('Menu');
    expect(message).toMatch(/Menu/);
    expect(message).toMatch(/Sambar/);
    expect(message).toMatch(/not yet implemented/i);
  });
});
