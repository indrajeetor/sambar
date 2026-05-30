import { UnsupportedPlatformError } from '../../common/errors';
import { currentPlatform } from '../../common/platform';
import { createMacOSApplication } from './macos/cocoa-backend';
import type { NativeApplication } from './native';

/**
 * The single runtime platform-selection point. Everything above `platform/`
 * obtains its native backend here and never imports a concrete backend
 * directly (D024). Linux lands in Phase 2; Windows is deferred (see WINDOWS.md).
 */
export const createNativeApplication = (): NativeApplication => {
  const platform = currentPlatform();
  switch (platform) {
    case 'macos':
      return createMacOSApplication();
    case 'linux':
      throw new UnsupportedPlatformError(
        'The Linux (WebKitGTK) backend is not implemented yet; macOS only for now',
      );
    default:
      throw new UnsupportedPlatformError(`No Sambar backend for platform: ${platform}`);
  }
};
