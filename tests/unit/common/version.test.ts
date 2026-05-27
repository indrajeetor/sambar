import { describe, expect, test } from 'bun:test';
import pkg from '../../../package.json';
import { SAMBAR_VERSION } from '../../../src/common/version';

describe('SAMBAR_VERSION', () => {
  test('is a non-empty string', () => {
    expect(typeof SAMBAR_VERSION).toBe('string');
    expect(SAMBAR_VERSION.length).toBeGreaterThan(0);
  });

  test('matches the version field in package.json', () => {
    expect(SAMBAR_VERSION).toBe(pkg.version);
  });

  test('is shaped like semver', () => {
    expect(SAMBAR_VERSION).toMatch(/^\d+\.\d+\.\d+(?:-[\w.]+)?$/);
  });
});
