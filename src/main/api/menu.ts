import { UnsupportedPlatformError } from '../../common/errors';
import { currentPlatform } from '../../common/platform';
import { linuxMenuRealizer } from '../platform/linux/gtk-menu';
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

export type MenuItemType = 'normal' | 'separator' | 'submenu' | 'checkbox' | 'radio';

/**
 * A predefined item role (Electron's `MenuItem.role`). A role gives the item a
 * default label + accelerator + native behavior with no explicit `click`. On
 * macOS each role maps to a standard first-responder selector, routed up the
 * responder chain to the focused web view / window / app (exactly like the
 * native shortcut). Linux wiring (per-window editing commands) is a follow-up —
 * role items render as labels there today, and their keyboard shortcuts work
 * natively via WebKit.
 */
export type MenuRole =
  | 'undo'
  | 'redo'
  | 'cut'
  | 'copy'
  | 'paste'
  | 'pasteAndMatchStyle'
  | 'delete'
  | 'selectAll'
  | 'minimize'
  | 'close'
  | 'zoom'
  | 'quit'
  | 'togglefullscreen'
  | 'about'
  | 'hide'
  | 'hideOthers'
  | 'unhide';

export type MenuItemOptions = {
  readonly label?: string;
  readonly type?: MenuItemType;
  readonly enabled?: boolean;
  /** Whether a `checkbox`/`radio` item is checked (renders a checkmark). */
  readonly checked?: boolean;
  /** A single-key accelerator like `'CmdOrCtrl+Q'`. */
  readonly accelerator?: string;
  /** A predefined role; fills a default label/accelerator and native behavior. */
  readonly role?: MenuRole;
  readonly click?: () => void;
  readonly submenu?: Menu | ReadonlyArray<MenuItemOptions>;
};

/** Per-role default label, accelerator, and the macOS first-responder selector. */
const ROLE_DEFAULTS: Record<
  MenuRole,
  { label: string; accelerator?: string; macSelector: string }
> = {
  undo: { label: 'Undo', accelerator: 'CommandOrControl+Z', macSelector: 'undo:' },
  redo: { label: 'Redo', accelerator: 'Shift+CommandOrControl+Z', macSelector: 'redo:' },
  cut: { label: 'Cut', accelerator: 'CommandOrControl+X', macSelector: 'cut:' },
  copy: { label: 'Copy', accelerator: 'CommandOrControl+C', macSelector: 'copy:' },
  paste: { label: 'Paste', accelerator: 'CommandOrControl+V', macSelector: 'paste:' },
  pasteAndMatchStyle: {
    label: 'Paste and Match Style',
    accelerator: 'Option+Shift+CommandOrControl+V',
    macSelector: 'pasteAndMatchStyle:',
  },
  delete: { label: 'Delete', macSelector: 'delete:' },
  selectAll: { label: 'Select All', accelerator: 'CommandOrControl+A', macSelector: 'selectAll:' },
  minimize: {
    label: 'Minimize',
    accelerator: 'CommandOrControl+M',
    macSelector: 'performMiniaturize:',
  },
  close: { label: 'Close Window', accelerator: 'CommandOrControl+W', macSelector: 'performClose:' },
  zoom: { label: 'Zoom', macSelector: 'performZoom:' },
  quit: { label: 'Quit', accelerator: 'CommandOrControl+Q', macSelector: 'terminate:' },
  togglefullscreen: {
    label: 'Toggle Full Screen',
    accelerator: 'Control+Command+F',
    macSelector: 'toggleFullScreen:',
  },
  about: { label: 'About', macSelector: 'orderFrontStandardAboutPanel:' },
  hide: { label: 'Hide', accelerator: 'Command+H', macSelector: 'hide:' },
  hideOthers: {
    label: 'Hide Others',
    accelerator: 'Command+Alt+H',
    macSelector: 'hideOtherApplications:',
  },
  unhide: { label: 'Show All', macSelector: 'unhideAllApplications:' },
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

// NSEventModifierFlags bits (macOS): only the modifier portion matters here.
const NS_SHIFT = 1n << 17n;
const NS_CONTROL = 1n << 18n;
const NS_OPTION = 1n << 19n;
const NS_COMMAND = 1n << 20n;

/**
 * Parse the modifier portion of an accelerator into an `NSEventModifierFlags`
 * mask (macOS). `CommandOrControl` maps to Command on macOS. Returns `0n` for no
 * accelerator. Without this, AppKit assumes Command-only and multi-modifier
 * accelerators (e.g. redo's `Shift+Cmd+Z`) collapse and collide.
 */
const acceleratorModifierMask = (accelerator: string | undefined): bigint => {
  if (accelerator === undefined || accelerator.length === 0) {
    return 0n;
  }
  let mask = 0n;
  for (const raw of accelerator.split('+')) {
    switch (raw.toLowerCase()) {
      case 'shift':
        mask |= NS_SHIFT;
        break;
      case 'control':
      case 'ctrl':
        mask |= NS_CONTROL;
        break;
      case 'alt':
      case 'option':
        mask |= NS_OPTION;
        break;
      case 'command':
      case 'cmd':
      case 'meta':
      case 'super':
      case 'commandorcontrol':
      case 'cmdorctrl':
        mask |= NS_COMMAND;
        break;
    }
  }
  return mask;
};

export class MenuItem {
  readonly label: string;
  readonly type: MenuItemType;
  readonly enabled: boolean;
  readonly checked: boolean;
  readonly accelerator: string | undefined;
  readonly role: MenuRole | undefined;
  readonly click: (() => void) | undefined;
  readonly submenu: Menu | undefined;

  constructor(options: MenuItemOptions) {
    this.role = options.role;
    const roleDefault = options.role !== undefined ? ROLE_DEFAULTS[options.role] : undefined;
    // App-supplied label/accelerator win over the role's defaults.
    this.label = options.label ?? roleDefault?.label ?? '';
    this.enabled = options.enabled ?? true;
    this.checked = options.checked ?? false;
    this.accelerator = options.accelerator ?? roleDefault?.accelerator;
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
  if (currentPlatform() === 'linux') {
    return linuxMenuRealizer;
  }
  throw new UnsupportedPlatformError(`Menu is not supported on ${currentPlatform()} yet`);
};

/** Override the native realizer. Test-only. */
export const setMenuRealizerForTesting = (fake: MenuRealizer | undefined): void => {
  realizer = fake;
};

const toSpec = (item: MenuItem): NativeMenuItemSpec => {
  const mask = acceleratorModifierMask(item.accelerator);
  const base = {
    label: item.label,
    type: item.type,
    enabled: item.enabled,
    checked: item.checked,
    keyEquivalent: acceleratorKey(item.accelerator),
    ...(mask !== 0n ? { modifierMask: mask } : {}),
    ...(item.role !== undefined
      ? { role: item.role, roleSelector: ROLE_DEFAULTS[item.role].macSelector }
      : {}),
  };
  if (item.type === 'submenu' && item.submenu !== undefined) {
    return { ...base, submenu: item.submenu.items.map(toSpec) };
  }
  // A role provides native behavior via its selector (macOS) — no JS click is
  // synthesized; if both a role and a click are given, the role takes precedence.
  const clickable = item.type === 'normal' || item.type === 'checkbox' || item.type === 'radio';
  if (item.role === undefined && clickable && item.click !== undefined) {
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
