import { describe, expect, test } from 'bun:test';
import { parseArgs } from '../../../src/cli/parse-args';

describe('parseArgs --sign', () => {
  test('build without --sign leaves sign unset', () => {
    const cmd = parseArgs(['build', 'app.ts']);
    expect(cmd.kind).toBe('build');
    if (cmd.kind === 'build') {
      expect(cmd.options.sign).toBeUndefined();
    }
  });

  test('build captures a real --sign identity value', () => {
    const cmd = parseArgs([
      'build',
      'app.ts',
      '--sign',
      'Developer ID Application: Jane Doe (TEAMID123)',
    ]);
    expect(cmd.kind).toBe('build');
    if (cmd.kind === 'build') {
      expect(cmd.options.sign).toBe('Developer ID Application: Jane Doe (TEAMID123)');
    }
  });

  test('build captures the ad-hoc --sign - identity', () => {
    const cmd = parseArgs(['build', 'app.ts', '--sign', '-']);
    expect(cmd.kind).toBe('build');
    if (cmd.kind === 'build') {
      expect(cmd.options.sign).toBe('-');
    }
  });

  test('build with --sign missing its value is an error', () => {
    const cmd = parseArgs(['build', 'app.ts', '--sign']);
    expect(cmd.kind).toBe('error');
    if (cmd.kind === 'error') {
      expect(cmd.message).toMatch(/--sign/);
    }
  });

  test('build parses --sign alongside the other flags', () => {
    expect(parseArgs(['build', 'app.ts', '--target', 'macos', '--sign', '-'])).toEqual({
      kind: 'build',
      entry: 'app.ts',
      options: { target: 'macos', sign: '-' },
    });
  });
});

describe('parseArgs --notarize', () => {
  test('build without --notarize leaves notarize falsey', () => {
    const cmd = parseArgs(['build', 'app.ts']);
    expect(cmd.kind).toBe('build');
    if (cmd.kind === 'build') {
      expect(cmd.options.notarize).toBeUndefined();
    }
  });

  test('build accepts a boolean --notarize flag (no value)', () => {
    const cmd = parseArgs(['build', 'app.ts', '--notarize']);
    expect(cmd.kind).toBe('build');
    if (cmd.kind === 'build') {
      expect(cmd.options.notarize).toBe(true);
    }
  });

  test('build parses --notarize alongside --sign', () => {
    expect(parseArgs(['build', 'app.ts', '--sign', '-', '--notarize'])).toEqual({
      kind: 'build',
      entry: 'app.ts',
      options: { sign: '-', notarize: true },
    });
  });
});
