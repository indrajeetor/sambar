import { UnsupportedPlatformError } from '../../../common/errors';
import type { TrayBackend, TrayInstance } from '../../api/tray';

/**
 * Linux `Tray` is honestly DEFERRED.
 *
 * GTK4 removed `GtkStatusIcon`, so there is no GTK4 status-icon API to bind. The
 * modern path is a `StatusNotifierItem` over D-Bus (a sizeable pure-FFI effort)
 * or `libayatana-appindicator` (GTK3-based, conflicts with GTK4 and is often
 * absent on CI). Until one of those is implemented this backend THROWS rather
 * than pretending to work — Sambar never fakes a no-op tray.
 */

const UNSUPPORTED_MESSAGE =
  'Tray is not supported on Linux yet: GTK4 removed GtkStatusIcon; a ' +
  'StatusNotifierItem (D-Bus) or libayatana-appindicator backend is a future effort.';

const create = (): TrayInstance => {
  throw new UnsupportedPlatformError(UNSUPPORTED_MESSAGE);
};

/** The Linux tray backend — deferred; every entry point throws. */
export const linuxTrayBackend: TrayBackend = {
  create,
};
