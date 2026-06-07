import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import type { NativeMenuItemSpec } from '../../../../src/main/platform/macos/cocoa-menu';
import {
  Menu,
  MenuItem,
  type MenuRealizer,
  resetApplicationMenuForTesting,
  setMenuRealizerForTesting,
} from '../../../../src/main/api/menu';

let realized: ReadonlyArray<NativeMenuItemSpec> | undefined;
let installed = 0;

beforeEach(() => {
  realized = undefined;
  installed = 0;
  const fake: MenuRealizer = {
    realize: (items) => {
      realized = items;
      return 1n;
    },
    setApplicationMenu: () => {
      installed += 1;
    },
  };
  setMenuRealizerForTesting(fake);
  resetApplicationMenuForTesting();
});

afterEach(() => {
  setMenuRealizerForTesting(undefined);
  resetApplicationMenuForTesting();
});

describe('MenuItem', () => {
  test('defaults type to normal when no submenu', () => {
    expect(new MenuItem({ label: 'X' }).type).toBe('normal');
  });

  test('infers submenu type from a submenu array', () => {
    const item = new MenuItem({ label: 'File', submenu: [{ label: 'New' }] });
    expect(item.type).toBe('submenu');
    expect(item.submenu?.items).toHaveLength(1);
  });

  test('defaults enabled to true', () => {
    expect(new MenuItem({ label: 'X' }).enabled).toBe(true);
  });

  test('honours enabled: false', () => {
    expect(new MenuItem({ label: 'X', enabled: false }).enabled).toBe(false);
  });

  test('defaults checked to false and honours checked: true', () => {
    expect(new MenuItem({ label: 'X' }).checked).toBe(false);
    expect(new MenuItem({ label: 'X', type: 'checkbox', checked: true }).checked).toBe(true);
  });
});

describe('Menu checkbox/radio items', () => {
  test('a checkbox item realizes with its type, checked state, and click', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Wrap', type: 'checkbox', checked: true, click: () => undefined },
    ]);
    menu.realize();
    expect(realized?.[0]).toMatchObject({ label: 'Wrap', type: 'checkbox', checked: true });
    expect(typeof realized?.[0]?.onClick).toBe('function');
  });

  test('a radio item realizes with type radio', () => {
    const menu = Menu.buildFromTemplate([
      { label: 'Left', type: 'radio', checked: false, click: () => undefined },
    ]);
    menu.realize();
    expect(realized?.[0]).toMatchObject({ type: 'radio', checked: false });
  });
});

describe('Menu.buildFromTemplate', () => {
  test('creates a MenuItem per template entry, in order', () => {
    const menu = Menu.buildFromTemplate([{ label: 'A' }, { label: 'B' }]);
    expect(menu.items.map((i) => i.label)).toEqual(['A', 'B']);
  });

  test('append adds to the end', () => {
    const menu = new Menu();
    menu.append(new MenuItem({ label: 'A' }));
    menu.append(new MenuItem({ label: 'B' }));
    expect(menu.items.map((i) => i.label)).toEqual(['A', 'B']);
  });
});

describe('Menu realization spec', () => {
  test('setApplicationMenu realizes the tree and installs it once', () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'App' }]));
    expect(installed).toBe(1);
    expect(realized).toHaveLength(1);
    expect(realized?.[0]?.label).toBe('App');
  });

  test('maps an accelerator down to its key equivalent', () => {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ label: 'Quit', accelerator: 'CmdOrCtrl+Q' }]),
    );
    expect(realized?.[0]?.keyEquivalent).toBe('q');
  });

  test('carries the click handler through to the spec', () => {
    const click = (): void => undefined;
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ label: 'Go', click }]));
    expect(realized?.[0]?.onClick).toBe(click);
  });

  test('nests submenu specs', () => {
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([{ label: 'File', submenu: [{ label: 'New' }, { label: 'Open' }] }]),
    );
    expect(realized?.[0]?.type).toBe('submenu');
    expect(realized?.[0]?.submenu).toHaveLength(2);
  });

  test('separators become separator specs', () => {
    Menu.setApplicationMenu(Menu.buildFromTemplate([{ type: 'separator' }]));
    expect(realized?.[0]?.type).toBe('separator');
  });
});

describe('Menu.getApplicationMenu', () => {
  test('returns null before any menu is set', () => {
    expect(Menu.getApplicationMenu()).toBeNull();
  });

  test('returns the menu after setApplicationMenu', () => {
    const menu = Menu.buildFromTemplate([{ label: 'App' }]);
    Menu.setApplicationMenu(menu);
    expect(Menu.getApplicationMenu()).toBe(menu);
  });
});
