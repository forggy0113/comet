#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { scriptDir } from './comet-lib.js';

const env: Record<string, string> = {
  COMET_STATE: join(scriptDir, 'comet-state.js'),
  COMET_GUARD: join(scriptDir, 'comet-guard.js'),
  COMET_HANDOFF: join(scriptDir, 'comet-handoff.js'),
  COMET_ARCHIVE: join(scriptDir, 'comet-archive.js'),
  COMET_YAML_VALIDATE: join(scriptDir, 'comet-yaml-validate.js'),
};

const missing = Object.values(env).filter((file) => !existsSync(file));
if (missing.length > 0) {
  console.error('ERROR: Comet scripts not found. Ensure the comet skill is installed completely.');
  console.error(
    'Expected path pattern: */comet/scripts/comet-*.js under project or platform skill directories',
  );
  process.exit(1);
}

console.log(JSON.stringify(env, null, 2));
