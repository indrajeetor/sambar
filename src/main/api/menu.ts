import { UnsupportedPlatformError } from '../../common/errors';
import { currentPlatform } from '../../common/platform';
import type { NativeMenuItemSpec } from '../platform/macos/cocoa-menu';
import * as cocoaMenu from '../platform/macos/cocoa-menu';

/**
 * Application and context menus — the drop-in equivalent of Electron's `Menu` /
 * `MenuItem`.
 *
 * The classes hold the menu tree in plain JS; turning it into native `NSMenu`
 * objects is delegated to an injectable realizer (defaulting to the macOS
 * backend) so the tree logic is unit-testable without any FFI, and Linux can
 * supply its own realizer later.
 */

export type MenuItemType = 'normal' | 'separator' | 'submenu';

export type MenuItemOptions = {
  readonly label?: string;
  readonly type?: MenuItemType;
  readonly enabled?: boolean;
  /** A single-key accelerator like `'CmdOrCtrl+Q'`; only the final key is used today. */
  readonly accelerator?: string;
  readonly click?: () => void;
  readonly submenu?: Menu | ReadonlyArray<MenuItemOptions>;
};

/** Extract the bare key character from an accelerator string (e.g. `'CmdOrCtrl+Q'` → `'q'`). */
const acceleratorKey = (accelerator: string | undefined): string => {
  if (accelerator === undefined || accelerator.length === 0) {
    return '';
  }
  const parts = accelerator.split('+');
  const key = parts[parts.length - 1] ?? '';
  return key.length === 1 ? key.toLowerCase() : '';
};

export class MenuItem {
  readonly label: string;
  readonly type: MenuItemType;
  readonly enabled: boolean;
  readonly accelerator: string | undefined;
  readonly click: (() => void) | undefined;
  readonly submenu: Menu | undefined;

  constructor(options: MenuItemOptions) {
    this.label = options.label ?? '';
    this.enabled = options.enabled ?? true;
    this.accelerator = options.accelerator;
    this.click = options.click;
    this.submenu =
      options.submenu === undefined
        ? undefined
        : options.submenu instanceof Menu
          ? options.submenu
          : Menu.buildFromTemplate(options.submenu);
    this.type = options.type ?? (this.submenu !== undefined ? 'submenu' : 'normal');
  }
}

/** Realizes a spec tree into a native menu handle (bigint) and installs it. */
export type MenuRealizer = {
  realize(items: ReadonlyArray<NativeMenuItemSpec>): bigint;
  setApplicationMenu(menu: bigint): void;
};

const macosRealizer: MenuRealizer = {
  realize: (items) => cocoaMenu.realizeMenu(items),
  setApplicationMenu: (menu) => cocoaMenu.setApplicationMenu(menu),
};

let realizer: MenuRealizer | undefined;

const getRealizer = (): MenuRealizer => {
  if (realizer !== undefined) {
    return realizer;
  }
  if (currentPlatform() === 'macos') {
    return macosRealizer;
  }
  throw new UnsupportedPlatformError(`Menu is not supported on ${currentPlatform()} yet`);
};

/** Override the native realizer. Test-only. */
export const setMenuRealizerForTesting = (fake: MenuRealizer | undefined): void => {
  realizer = fake;
};

const toSpec = (item: MenuItem): NativeMenuItemSpec => {
  const base = {
    label: item.label,
    type: item.type,
    enabled: item.enabled,
    keyEquivalent: acceleratorKey(item.accelerator),
  };
  if (item.type === 'submenu' && item.submenu !== undefined) {
    return { ...base, submenu: item.submenu.items.map(toSpec) };
  }
  if (item.type === 'normal' && item.click !== undefined) {
    return { ...base, onClick: item.click };
  }
  return base;
};

export class Menu {
  /** The items in this menu, in order. */
  readonly items: MenuItem[] = [];

  /** Append an item to the end of the menu. */
  append(item: MenuItem): void {
    this.items.push(item);
  }

  /** Build a menu from a template of plain option objects. */
  static buildFromTemplate(template: ReadonlyArray<MenuItemOptions | MenuItem>): Menu {
    const menu = new Menu();
    for (const entry of template) {
      menu.append(entry instanceof MenuItem ? entry : new MenuItem(entry));
    }
    return menu;
  }

  /** Realize this menu to a native handle. @internal */
  realize(): bigint {
    return getRealizer().realize(this.items.map(toSpec));
  }

  /** Set `menu` as the application menu bar, or clear it with `null`. */
  static setApplicationMenu(menu: Menu | null): void {
    applicationMenu = menu;
    if (menu !== null) {
      getRealizer().setApplicationMenu(menu.realize());
    }
  }

  /** The current application menu, or `null` if none is set. */
  static getApplicationMenu(): Menu | null {
    return applicationMenu;
  }
}

let applicationMenu: Menu | null = null;

/** Reset the stored application menu. Test-only. */
export const resetApplicationMenuForTesting = (): void => {
  applicationMenu = null;
};
