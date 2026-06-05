#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import {
  changeDirFor,
  fieldValue,
  green,
  KNOWN_KEYS,
  parseYamlLines,
  red,
  validateChangeName,
  yellow,
} from './comet-lib.js';

const change = process.argv[2];
validateChangeName(change);
const changeDir = changeDirFor(change);
const yaml = join(changeDir, '.comet.yaml');
let errors = 0;
let warnings = 0;

function fail(message: string): void {
  red(`  FAIL: ${message}`);
  errors += 1;
}

function warn(message: string): void {
  yellow(`  WARN: ${message}`);
  warnings += 1;
}

function validateEnum(field: string, value: string, valid: string[]): void {
  if (!value || value === 'null') return;
  if (!valid.includes(value))
    fail(`${field}='${value}' is not valid. Expected: ${valid.join(' ')}`);
}

console.error(`[VALIDATE] ${yaml}`);

if (!existsSync(yaml)) {
  fail(`.comet.yaml not found at ${yaml}`);
} else {
  const parsed = parseYamlLines(yaml);
  const required = [
    'workflow',
    'phase',
    'build_mode',
    'build_pause',
    'isolation',
    'verify_mode',
    'design_doc',
    'plan',
    'verify_result',
    'verification_report',
    'branch_status',
    'verified_at',
    'created_at',
    'base_ref',
    'archived',
  ];
  for (const field of required) {
    if (!parsed.keys.includes(field)) fail(`missing required field '${field}'`);
  }

  validateEnum('workflow', fieldValue(yaml, 'workflow'), ['full', 'hotfix', 'tweak']);
  validateEnum('phase', fieldValue(yaml, 'phase'), [
    'open',
    'design',
    'build',
    'verify',
    'archive',
  ]);
  validateEnum('build_mode', fieldValue(yaml, 'build_mode'), [
    'subagent-driven-development',
    'executing-plans',
    'direct',
  ]);
  validateEnum('build_pause', fieldValue(yaml, 'build_pause'), ['null', 'plan-ready']);
  validateEnum('isolation', fieldValue(yaml, 'isolation'), ['branch', 'worktree']);
  validateEnum('verify_mode', fieldValue(yaml, 'verify_mode'), ['light', 'full']);
  validateEnum('verify_result', fieldValue(yaml, 'verify_result'), ['pending', 'pass', 'fail']);
  validateEnum('branch_status', fieldValue(yaml, 'branch_status'), ['pending', 'handled']);
  validateEnum('archived', fieldValue(yaml, 'archived'), ['true', 'false']);
  validateEnum('direct_override', fieldValue(yaml, 'direct_override'), ['true', 'false']);

  for (const field of ['design_doc', 'plan', 'handoff_context']) {
    const value = fieldValue(yaml, field);
    if (value && value !== 'null' && !existsSync(value))
      fail(`${field}='${value}' does not exist on disk`);
  }
  const handoffHash = fieldValue(yaml, 'handoff_hash');
  if (handoffHash && handoffHash !== 'null' && !/^[a-f0-9]{64}$/.test(handoffHash)) {
    fail(`handoff_hash='${handoffHash}' is not a sha256 hex digest`);
  }
  for (const key of parsed.keys) {
    if (!KNOWN_KEYS.has(key)) warn(`unknown field '${key}' found`);
  }
}

console.error('');
if (errors > 0) {
  red(`${errors} error(s), ${warnings} warning(s) — validation FAILED`);
  process.exit(1);
}
green(`0 errors, ${warnings} warning(s) — validation PASSED`);
