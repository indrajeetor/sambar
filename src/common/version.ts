import pkg from '../../package.json';

/**
 * Current Sambar version, sourced from `package.json` at build time.
 * Always equal to `pkg.version`; the test suite enforces this.
 */
export const SAMBAR_VERSION: string = pkg.version;
