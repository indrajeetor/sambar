#!/usr/bin/env bun
/**
 * The `sambar` command-line interface: `run`, `build`, `--help`, `--version`.
 *
 * This is the user-facing build/launch tool, not a runtime module — it uses
 * Bun/Node filesystem and process APIs only. Output goes through
 * `process.stdout`/`process.stderr` because Biome bans `console.*`.
 */

import { buildLinuxApp } from './build-linux';
import { buildMacApp } from './build-macos';
import { type Command, parseArgs, resolveTarget } from './parse-args';
import { runApp } from './run';
import { currentPlatform } from '../common/platform';
import { SAMBAR_VERSION } from '../common/version';

const out = (text: string): void => {
  process.stdout.write(`${text}\n`);
};

const err = (text: string): void => {
  process.stderr.write(`${text}\n`);
};

const USAGE = `sambar ${SAMBAR_VERSION}

Usage:
  sambar run <entry.ts> [args...]      Launch a Sambar app (bun run <entry>)
  sambar build <entry.ts> [options]    Bundle a distributable app
  sambar --help                        Show this help
  sambar --version                     Print the Sambar version

build options:
  --target <os>      Build target: macos | linux (default: host platform)
  --name <Name>      Display/bundle name (default: derived from <entry>)
  --id <bundle.id>   Bundle identifier (default: com.sambar.<name-slug>)
  --out <dir>        Output directory (default: current directory)
  --icon <path>      App icon (.icns for macOS, .png for linux)

'sambar build' produces a macOS .app or a Linux AppDir + .tar.gz + .deb.
A macOS host can cross-build Linux with --target linux.`;

/** Derive a default app name from the entry path's base file name. */
const deriveName = (entry: string): string => {
  const base = entry.split(/[\\/]/).pop() ?? entry;
  const stem = base.replace(/\.[^.]+$/, '');
  return stem.length > 0 ? stem : 'SambarApp';
};

const runBuild = async (command: Extract<Command, { kind: 'build' }>): Promise<number> => {
  const target = resolveTarget(command.options.target);
  // Only macOS hosts can produce a macOS .app; Linux distributables cross-build
  // from macOS (and build natively on Linux).
  if (target === 'macos' && currentPlatform() !== 'macos') {
    err(`sambar build: --target macos requires a macOS host (this host is ${currentPlatform()}).`);
    return 1;
  }
  const name = command.options.name ?? deriveName(command.entry);
  if (target === 'linux') {
    const result = await buildLinuxApp({
      entry: command.entry,
      name,
      ...(command.options.id !== undefined ? { id: command.options.id } : {}),
      ...(command.options.out !== undefined ? { out: command.options.out } : {}),
      ...(command.options.icon !== undefined ? { icon: command.options.icon } : {}),
    });
    out(result.appDir);
    out(result.tarball);
    out(result.deb);
    return 0;
  }
  const appPath = await buildMacApp({
    entry: command.entry,
    name,
    ...(command.options.id !== undefined ? { id: command.options.id } : {}),
    ...(command.options.out !== undefined ? { out: command.options.out } : {}),
    ...(command.options.icon !== undefined ? { icon: command.options.icon } : {}),
  });
  out(appPath);
  return 0;
};

/** Execute a parsed {@link Command} and resolve to the process exit code. */
export const dispatch = async (command: Command): Promise<number> => {
  switch (command.kind) {
    case 'help':
      out(USAGE);
      return 0;
    case 'version':
      out(SAMBAR_VERSION);
      return 0;
    case 'run':
      return await runApp(command.entry, command.args);
    case 'build':
      return await runBuild(command);
    case 'error':
      err(command.message);
      err('');
      err(USAGE);
      return 1;
  }
};

const main = async (): Promise<void> => {
  const command = parseArgs(process.argv.slice(2));
  process.exit(await dispatch(command));
};

// Only auto-run when invoked as the CLI entry, never on import (e.g. in tests).
if (import.meta.main) {
  await main();
}
