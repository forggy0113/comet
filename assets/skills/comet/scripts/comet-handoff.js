#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, fieldValue, fileNonempty, green, hashFile, runNode, scriptDir, sha256, slash, validateChangeName } from './comet-lib.js';

function error(message) {
  console.error(`\u001b[31m${message}\u001b[0m`);
  process.exit(1);
}

function walkSpecFiles(dir) {
  if (!existsSync(dir)) return [];
  const { readdirSync, statSync } = awaitFs;
  const out = [];
  function walk(current) {
    for (const entry of readdirSync(current)) {
      const p = join(current, entry);
      const stat = statSync(p);
      if (stat.isDirectory()) walk(p);
      else if (entry === 'spec.md') out.push(p);
    }
  }
  walk(dir);
  return out.sort();
}

import * as awaitFs from 'node:fs';

function sourceFiles(changeDir) {
  return [join(changeDir, 'proposal.md'), join(changeDir, 'design.md'), join(changeDir, 'tasks.md'), ...walkSpecFiles(join(changeDir, 'specs'))];
}

function computeContextHash(files) {
  let content = '';
  for (const file of files) {
    if (!existsSync(file)) continue;
    content += `path:${slash(file)}\nsha256:${hashFile(file)}\n`;
  }
  return sha256(content);
}

function writeMarkdown(output, files, change, mode, contextHash) {
  const chunks = [
    '# Comet Design Handoff',
    '',
    `- Change: ${change}`,
    '- Phase: design',
    `- Mode: ${mode}`,
    `- Context hash: ${contextHash}`,
    '',
    'Generated-by: comet-handoff.js',
    '',
    'OpenSpec remains the canonical capability spec. This handoff is a deterministic, source-traceable context pack, not an agent-authored summary.',
    '',
  ];
  for (const file of files) {
    if (!existsSync(file)) continue;
    const text = readFileSync(file, 'utf8');
    const lines = text.split(/\r?\n/);
    chunks.push(`## ${slash(file)}`, '', `- Source: ${slash(file)}`, `- Lines: 1-${lines.length}`, `- SHA256: ${hashFile(file)}`, '');
    if (mode === 'full' || lines.length <= 80) chunks.push('```md', text.replace(/\s*$/, ''), '```');
    else chunks.push('[TRUNCATED]', '', '```md', lines.slice(0, 80).join('\n'), '```', '', `Full source: ${slash(file)}`);
    chunks.push('');
  }
  writeFileSync(output, `${chunks.join('\n')}\n`);
}

function writeJson(output, files, change, mode, contextHash) {
  const body = {
    change,
    phase: 'design',
    mode,
    canonical_spec: 'openspec',
    generated_by: 'comet-handoff.js',
    context_hash: contextHash,
    files: files.filter((file) => existsSync(file)).map((file) => ({ path: slash(file), sha256: hashFile(file) })),
  };
  writeFileSync(output, `${JSON.stringify(body, null, 2)}\n`);
}

const [change, phase, modeArg, fullFlag] = process.argv.slice(2);
validateChangeName(change);
if (phase !== 'design' || modeArg !== '--write' || (fullFlag && fullFlag !== '--full')) error('Usage: comet-handoff.js <change-name> design --write [--full]');
const handoffMode = fullFlag === '--full' ? 'full' : 'compact';
const changeDir = join('openspec', 'changes', change);
const yaml = join(changeDir, '.comet.yaml');
if (!existsSync(changeDir)) error(`ERROR: change directory not found: ${changeDir}`);
if (!existsSync(yaml)) error(`ERROR: .comet.yaml not found at ${yaml}`);
if (fieldValue(yaml, 'phase') !== 'design') error('ERROR: design handoff requires phase: design');
for (const required of ['proposal.md', 'design.md', 'tasks.md']) {
  if (!fileNonempty(join(changeDir, required))) error(`ERROR: required OpenSpec artifact missing or empty: ${join(changeDir, required)}`);
}
const handoffDir = join(changeDir, '.comet', 'handoff');
const contextJson = slash(join(handoffDir, 'design-context.json'));
const contextMd = slash(join(handoffDir, 'design-context.md'));
ensureDir(handoffDir);
const files = sourceFiles(changeDir);
const contextHash = computeContextHash(files);
writeMarkdown(contextMd, files, change, handoffMode, contextHash);
writeJson(contextJson, files, change, handoffMode, contextHash);
const stateScript = join(scriptDir, 'comet-state.js');
if (!existsSync(stateScript)) error('ERROR: comet-state.js not found; cannot record handoff fields');
let result = runNode(stateScript, ['set', change, 'handoff_context', contextJson]);
if (result.status !== 0) process.exit(result.status ?? 1);
result = runNode(stateScript, ['set', change, 'handoff_hash', contextHash]);
if (result.status !== 0) process.exit(result.status ?? 1);
green(`[HANDOFF] wrote ${contextJson}`);
green(`[HANDOFF] wrote ${contextMd}`);
green(`[HANDOFF] handoff_hash=${contextHash}`);
