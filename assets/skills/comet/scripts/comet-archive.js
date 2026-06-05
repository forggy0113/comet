#!/usr/bin/env node
<<<<<<< HEAD
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync, } from 'node:fs';
import { dirname, join } from 'node:path';
import { fieldValue, green, red, runNode, scriptDir, today, validateChangeName, yellow, } from './comet-lib.js';
=======
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fieldValue, green, red, runNode, scriptDir, today, validateChangeName, yellow } from './comet-lib.js';

>>>>>>> eeac7a023b8ea6033b2606f7fd7d412881e7c398
const [change, flag] = process.argv.slice(2);
const dryRun = flag === '--dry-run';
validateChangeName(change, 'FATAL');
const changeDir = join('openspec', 'changes', change);
const yaml = join(changeDir, '.comet.yaml');
const archiveName = `${today()}-${change}`;
const archiveDir = join('openspec', 'changes', 'archive', archiveName);
let stepsOk = 0;
let stepsTotal = 0;
<<<<<<< HEAD
function fatal(message) {
    red(`FATAL: ${message}`);
    process.exit(1);
}
function stepOk(message) {
    green(`  [OK] ${message}`);
    stepsOk += 1;
    stepsTotal += 1;
}
function stepFail(message) {
    red(`  [FAIL] ${message}`);
    stepsTotal += 1;
}
function stepDry(message) {
    yellow(`  [DRY-RUN] ${message}`);
    stepsOk += 1;
    stepsTotal += 1;
}
function y(field) {
    return fieldValue(yaml, field);
}
console.error(`=== Comet Archive: ${change} ===`);
if (!existsSync(yaml))
    fatal(`.comet.yaml not found in ${changeDir}/`);
const designDoc = y('design_doc');
const planPath = y('plan');
if (y('phase') !== 'archive')
    fatal(`phase is '${y('phase')}', expected 'archive'`);
if (y('verify_result') !== 'pass')
    fatal(`verify_result is '${y('verify_result')}', expected 'pass'. Run comet-verify first.`);
if (y('archived') === 'true')
    fatal('change already archived');
stepOk('Entry state verified');
if (existsSync(archiveDir))
    fatal(`archive target already exists: ${archiveDir}`);
stepOk('Archive target available');
function syncDeltaSpecs() {
    const deltaRoot = join(changeDir, 'specs');
    if (!existsSync(deltaRoot))
        return;
    for (const capability of readdirSync(deltaRoot)) {
        const deltaSpecDir = join(deltaRoot, capability);
        if (!statSync(deltaSpecDir).isDirectory())
            continue;
        const deltaSpec = join(deltaSpecDir, 'spec.md');
        const mainSpec = join('openspec', 'specs', capability, 'spec.md');
        if (!existsSync(deltaSpec))
            continue;
        if (dryRun) {
            stepDry(`Would sync: ${capability} → ${mainSpec}`);
            continue;
        }
        mkdirSync(dirname(mainSpec), { recursive: true });
        copyFileSync(deltaSpec, mainSpec);
        stepOk(`Delta spec synced: ${capability} → openspec/specs/${capability}/spec.md`);
    }
}
function annotateFrontmatter(file, extraFields) {
    if (!existsSync(file))
        return;
    if (dryRun) {
        stepDry(`Would annotate: ${file}`);
        return;
    }
    const text = readFileSync(file, 'utf8');
    let next;
    if (text.startsWith('---')) {
        const lines = text.split(/\r?\n/);
        const out = [];
        let inserted = false;
        for (let i = 0; i < lines.length; i += 1) {
            const line = lines[i];
            if (/^archived-with:/.test(line))
                continue;
            if (i > 0 && line === '---' && !inserted) {
                out.push(`archived-with: ${archiveName}`);
                if (extraFields)
                    out.push(extraFields);
                inserted = true;
            }
            out.push(line);
        }
        next = out.join('\n');
    }
    else {
        next = `---\narchived-with: ${archiveName}\n${extraFields ? `${extraFields}\n` : ''}status: final\n---\n${text}`;
    }
    writeFileSync(file, next);
    stepOk(`Annotated: ${file}`);
}
syncDeltaSpecs();
if (designDoc && designDoc !== 'null')
    annotateFrontmatter(designDoc, 'status: final');
if (planPath && planPath !== 'null')
    annotateFrontmatter(planPath, '');
if (dryRun)
    stepDry(`Would move: ${changeDir} → ${archiveDir}`);
else {
    mkdirSync(join('openspec', 'changes', 'archive'), { recursive: true });
    renameSync(changeDir, archiveDir);
    stepOk(`Moved to: ${archiveDir}`);
}
const archiveYaml = join(archiveDir, '.comet.yaml');
if (dryRun)
    stepDry(`Would set archived: true in ${archiveYaml}`);
else if (existsSync(archiveYaml)) {
    const state = join(scriptDir, 'comet-state.js');
    const result = runNode(state, ['transition', archiveName, 'archived']);
    if (result.status === 0)
        stepOk('archived: true');
    else
        stepFail('archived: true');
}
else
    stepFail('archived: true (.comet.yaml not found after move)');
console.error('');
if (dryRun)
    yellow(`Dry run complete. ${stepsOk}/${stepsTotal} steps would succeed.`);
else
    green(`Archive complete. ${stepsOk}/${stepsTotal} steps succeeded.`);
if (stepsOk < stepsTotal)
    process.exit(1);
=======

function fatal(message) {
  red(`FATAL: ${message}`);
  process.exit(1);
}

function stepOk(message) { green(`  [OK] ${message}`); stepsOk += 1; stepsTotal += 1; }
function stepFail(message) { red(`  [FAIL] ${message}`); stepsTotal += 1; }
function stepDry(message) { yellow(`  [DRY-RUN] ${message}`); stepsOk += 1; stepsTotal += 1; }
function y(field) { return fieldValue(yaml, field); }

console.error(`=== Comet Archive: ${change} ===`);
if (!existsSync(yaml)) fatal(`.comet.yaml not found in ${changeDir}/`);
const designDoc = y('design_doc');
const planPath = y('plan');
if (y('phase') !== 'archive') fatal(`phase is '${y('phase')}', expected 'archive'`);
if (y('verify_result') !== 'pass') fatal(`verify_result is '${y('verify_result')}', expected 'pass'. Run comet-verify first.`);
if (y('archived') === 'true') fatal('change already archived');
stepOk('Entry state verified');
if (existsSync(archiveDir)) fatal(`archive target already exists: ${archiveDir}`);
stepOk('Archive target available');

function syncDeltaSpecs() {
  const deltaRoot = join(changeDir, 'specs');
  if (!existsSync(deltaRoot)) return;
  for (const capability of readdirSync(deltaRoot)) {
    const deltaSpecDir = join(deltaRoot, capability);
    if (!statSync(deltaSpecDir).isDirectory()) continue;
    const deltaSpec = join(deltaSpecDir, 'spec.md');
    const mainSpec = join('openspec', 'specs', capability, 'spec.md');
    if (!existsSync(deltaSpec)) continue;
    if (dryRun) {
      stepDry(`Would sync: ${capability} → ${mainSpec}`);
      continue;
    }
    mkdirSync(dirname(mainSpec), { recursive: true });
    copyFileSync(deltaSpec, mainSpec);
    stepOk(`Delta spec synced: ${capability} → openspec/specs/${capability}/spec.md`);
  }
}

function annotateFrontmatter(file, extraFields) {
  if (!existsSync(file)) return;
  if (dryRun) {
    stepDry(`Would annotate: ${file}`);
    return;
  }
  const text = readFileSync(file, 'utf8');
  let next;
  if (text.startsWith('---')) {
    const lines = text.split(/\r?\n/);
    const out = [];
    let inserted = false;
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (/^archived-with:/.test(line)) continue;
      if (i > 0 && line === '---' && !inserted) {
        out.push(`archived-with: ${archiveName}`);
        if (extraFields) out.push(extraFields);
        inserted = true;
      }
      out.push(line);
    }
    next = out.join('\n');
  } else {
    next = `---\narchived-with: ${archiveName}\n${extraFields ? `${extraFields}\n` : ''}status: final\n---\n${text}`;
  }
  writeFileSync(file, next);
  stepOk(`Annotated: ${file}`);
}

syncDeltaSpecs();
if (designDoc && designDoc !== 'null') annotateFrontmatter(designDoc, 'status: final');
if (planPath && planPath !== 'null') annotateFrontmatter(planPath, '');
if (dryRun) stepDry(`Would move: ${changeDir} → ${archiveDir}`);
else {
  mkdirSync(join('openspec', 'changes', 'archive'), { recursive: true });
  renameSync(changeDir, archiveDir);
  stepOk(`Moved to: ${archiveDir}`);
}
const archiveYaml = join(archiveDir, '.comet.yaml');
if (dryRun) stepDry(`Would set archived: true in ${archiveYaml}`);
else if (existsSync(archiveYaml)) {
  const state = join(scriptDir, 'comet-state.js');
  const result = runNode(state, ['transition', archiveName, 'archived']);
  if (result.status === 0) stepOk('archived: true');
  else stepFail('archived: true');
} else stepFail('archived: true (.comet.yaml not found after move)');
console.error('');
if (dryRun) yellow(`Dry run complete. ${stepsOk}/${stepsTotal} steps would succeed.`);
else green(`Archive complete. ${stepsOk}/${stepsTotal} steps succeeded.`);
if (stepsOk < stepsTotal) process.exit(1);
>>>>>>> eeac7a023b8ea6033b2606f7fd7d412881e7c398
