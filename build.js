#!/usr/bin/env node

import { execFileSync } from 'child_process';
import { existsSync, rmSync } from 'fs';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);

const runTsc = (project, args = []) => {
  const tscPath = require.resolve('typescript/bin/tsc');
  execFileSync(process.execPath, [tscPath, '--project', project, ...args], { stdio: 'inherit' });
};

console.log('Building Comet...\n');

if (existsSync('dist')) {
  console.log('Cleaning dist directory...');
  rmSync('dist', { recursive: true, force: true });
}

console.log('Compiling src/ TypeScript...');
try {
  runTsc('tsconfig.json', ['--version']);
  runTsc('tsconfig.json');
} catch {
  console.error('\nBuild failed!');
  process.exit(1);
}

console.log('\nCleaning script output directory...');
if (existsSync('assets/skills/comet/scripts')) {
  const scriptFiles = [
    'comet-lib.js',
    'comet-env.js',
    'comet-guard.js',
    'comet-handoff.js',
    'comet-archive.js',
    'comet-yaml-validate.js',
    'comet-state.js',
  ];
  for (const f of scriptFiles) {
    const p = `assets/skills/comet/scripts/${f}`;
    if (existsSync(p)) rmSync(p, { force: true });
  }
}

console.log('Compiling scripts/ TypeScript...');
try {
  runTsc('src/scripts/tsconfig.json');
} catch {
  console.error('\nScript compilation failed!');
  process.exit(1);
}

console.log('\nBuild completed successfully!');
