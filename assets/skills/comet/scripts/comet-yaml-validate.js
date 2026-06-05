#!/usr/bin/env node
import { existsSync } from 'node:fs';
import { join } from 'node:path';
<<<<<<< HEAD
import { changeDirFor, fieldValue, green, KNOWN_KEYS, parseYamlLines, red, validateChangeName, yellow, } from './comet-lib.js';
=======
import { changeDirFor, fieldValue, KNOWN_KEYS, parseYamlLines, red, green, validateChangeName, yellow } from './comet-lib.js';

>>>>>>> eeac7a023b8ea6033b2606f7fd7d412881e7c398
const change = process.argv[2];
validateChangeName(change);
const changeDir = changeDirFor(change);
const yaml = join(changeDir, '.comet.yaml');
let errors = 0;
let warnings = 0;
<<<<<<< HEAD
function fail(message) {
    red(`  FAIL: ${message}`);
    errors += 1;
}
function warn(message) {
    yellow(`  WARN: ${message}`);
    warnings += 1;
}
function validateEnum(field, value, valid) {
    if (!value || value === 'null')
        return;
    if (!valid.includes(value))
        fail(`${field}='${value}' is not valid. Expected: ${valid.join(' ')}`);
}
console.error(`[VALIDATE] ${yaml}`);
if (!existsSync(yaml)) {
    fail(`.comet.yaml not found at ${yaml}`);
}
else {
    const parsed = parseYamlLines(yaml);
    const required = [
        'workflow',
        'phase',
        'design_doc',
        'plan',
        'build_mode',
        'isolation',
        'verify_mode',
        'verify_result',
        'verified_at',
        'archived',
    ];
    for (const field of required) {
        if (!parsed.keys.includes(field))
            fail(`missing required field '${field}'`);
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
        if (!KNOWN_KEYS.has(key))
            warn(`unknown field '${key}' found`);
    }
}
console.error('');
if (errors > 0) {
    red(`${errors} error(s), ${warnings} warning(s) — validation FAILED`);
    process.exit(1);
=======

function fail(message) {
  red(`  FAIL: ${message}`);
  errors += 1;
}

function warn(message) {
  yellow(`  WARN: ${message}`);
  warnings += 1;
}

function validateEnum(field, value, valid) {
  if (!value || value === 'null') return;
  if (!valid.includes(value)) fail(`${field}='${value}' is not valid. Expected: ${valid.join(' ')}`);
}

console.error(`[VALIDATE] ${yaml}`);

if (!existsSync(yaml)) {
  fail(`.comet.yaml not found at ${yaml}`);
} else {
  const parsed = parseYamlLines(yaml);
  const required = ['workflow', 'phase', 'design_doc', 'plan', 'build_mode', 'isolation', 'verify_mode', 'verify_result', 'verified_at', 'archived'];
  for (const field of required) {
    if (!parsed.keys.includes(field)) fail(`missing required field '${field}'`);
  }

  validateEnum('workflow', fieldValue(yaml, 'workflow'), ['full', 'hotfix', 'tweak']);
  validateEnum('phase', fieldValue(yaml, 'phase'), ['open', 'design', 'build', 'verify', 'archive']);
  validateEnum('build_mode', fieldValue(yaml, 'build_mode'), ['subagent-driven-development', 'executing-plans', 'direct']);
  validateEnum('build_pause', fieldValue(yaml, 'build_pause'), ['null', 'plan-ready']);
  validateEnum('isolation', fieldValue(yaml, 'isolation'), ['branch', 'worktree']);
  validateEnum('verify_mode', fieldValue(yaml, 'verify_mode'), ['light', 'full']);
  validateEnum('verify_result', fieldValue(yaml, 'verify_result'), ['pending', 'pass', 'fail']);
  validateEnum('branch_status', fieldValue(yaml, 'branch_status'), ['pending', 'handled']);
  validateEnum('archived', fieldValue(yaml, 'archived'), ['true', 'false']);
  validateEnum('direct_override', fieldValue(yaml, 'direct_override'), ['true', 'false']);

  for (const field of ['design_doc', 'plan', 'handoff_context']) {
    const value = fieldValue(yaml, field);
    if (value && value !== 'null' && !existsSync(value)) fail(`${field}='${value}' does not exist on disk`);
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
>>>>>>> eeac7a023b8ea6033b2606f7fd7d412881e7c398
}
green(`0 errors, ${warnings} warning(s) — validation PASSED`);
