#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  fieldValue,
  fileNonempty,
  green,
  hashFile,
  red,
  runCommand,
  runCommandString,
  runNode,
  scriptDir,
  sha256,
  slash,
  validateChangeName,
  yellow,
} from './comet-lib.js';

const [change, phase, applyFlag] = process.argv.slice(2);
validateChangeName(change);
const apply = applyFlag === '--apply';
let changeDir = join('openspec', 'changes', change);
if (
  phase === 'archive' &&
  !existsSync(changeDir) &&
  existsSync(join('openspec', 'changes', 'archive', change))
) {
  changeDir = join('openspec', 'changes', 'archive', change);
}
const yaml = join(changeDir, '.comet.yaml');
let block = false;

function check(desc: string, fn: () => unknown): void {
  try {
    const result = fn();
    if (result === true || result === undefined) green(`  [PASS] ${desc}`);
    else throw new Error(String(result));
  } catch (error) {
    red(`  [FAIL] ${desc}`);
    const message = error instanceof Error ? error.message : String(error);
    if (message) for (const line of message.split(/\r?\n/)) red(`    ${line}`);
    block = true;
  }
}

function y(field: string): string {
  return fieldValue(yaml, field);
}

function preflight(): void {
  if (!existsSync(changeDir)) {
    red(`FATAL: change directory not found: ${changeDir}`);
    process.exit(1);
  }
  if (!existsSync(yaml)) {
    red(`FATAL: .comet.yaml not found in ${changeDir}`);
    process.exit(1);
  }
  const validateScript = join(scriptDir, 'comet-yaml-validate.js');
  if (existsSync(validateScript)) {
    const result = runNode(validateScript, [change]);
    if (result.status !== 0) {
      process.stderr.write(result.stderr || '');
      red('FATAL: .comet.yaml schema validation failed');
      process.exit(1);
    }
  }
}

function tasksAllDone(): void {
  const tasks = join(changeDir, 'tasks.md');
  if (!existsSync(tasks))
    throw new Error(
      `tasks.md is missing at ${tasks}\nNext: restore or create tasks.md for this change before leaving build.`,
    );
  const text = readFileSync(tasks, 'utf8');
  if (!/- \[x\]/.test(text))
    throw new Error(
      "tasks.md has no completed tasks.\nNext: complete implementation tasks and mark them with '- [x]'.",
    );
  const unfinished = text
    .split(/\r?\n/)
    .map((line, index) => ({ line, index: index + 1 }))
    .filter(({ line }) => /- \[ \]/.test(line));
  if (unfinished.length > 0) {
    throw new Error(
      `Unfinished tasks:\n${unfinished.map(({ line, index }) => `${index}:${line}`).join('\n')}\nNext: complete or explicitly remove unfinished tasks, then mark tasks.md with '- [x]'.`,
    );
  }
}

function tasksHasAny(): boolean {
  return (
    existsSync(join(changeDir, 'tasks.md')) &&
    /- \[/.test(readFileSync(join(changeDir, 'tasks.md'), 'utf8'))
  );
}

function projectConfigValue(field: string): string {
  const local = y(field);
  if (local && local !== 'null') return local;
  for (const config of ['.comet.yaml', 'comet.yaml', '.comet.yml', 'comet.yml']) {
    if (existsSync(config)) {
      const value = fieldValue(config, field);
      if (value && value !== 'null') return value;
    }
  }
  return '';
}

function buildPasses(): void {
  if (process.env.COMET_SKIP_BUILD === '1') return;
  const configured = projectConfigValue('build_command');
  if (configured) {
    const result = runCommandString(configured);
    if (result.status !== 0) throw new Error(`command failed: ${configured}`);
    return;
  }
  if (existsSync('package.json') && /"build"/.test(readFileSync('package.json', 'utf8'))) {
    const result = runCommand(['npm', 'run', 'build']);
    if (result.status !== 0) throw new Error('npm run build failed');
    return;
  }
  if (existsSync('pom.xml')) {
    const result = existsSync('./mvnw')
      ? runCommand(['./mvnw', 'compile', '-q'])
      : runCommand(['mvn', 'compile', '-q']);
    if (result.status !== 0) throw new Error('maven build failed');
    return;
  }
  if (existsSync('Cargo.toml')) {
    const result = runCommand(['cargo', 'build']);
    if (result.status !== 0) throw new Error('cargo build failed');
    return;
  }
  throw new Error('no build command found');
}

function verificationCommandPasses(): void {
  if (process.env.COMET_SKIP_BUILD === '1') return;
  const configured = projectConfigValue('verify_command');
  if (configured) {
    const result = runCommandString(configured);
    if (result.status !== 0) throw new Error(`command failed: ${configured}`);
    return;
  }
  buildPasses();
}

function sourceFiles(): string[] {
  const files = [
    join(changeDir, 'proposal.md'),
    join(changeDir, 'design.md'),
    join(changeDir, 'tasks.md'),
  ];
  const specsRoot = join(changeDir, 'specs');
  if (existsSync(specsRoot)) {
    function walk(dir: string): void {
      for (const entry of readdirSync(dir)) {
        const p = join(dir, entry);
        const stat = statSync(p);
        if (stat.isDirectory()) walk(p);
        else if (entry === 'spec.md') files.push(p);
      }
    }
    walk(specsRoot);
  }
  return files;
}

function computeHandoffHash(): string {
  let content = '';
  for (const file of sourceFiles())
    if (existsSync(file)) content += `path:${slash(file)}\nsha256:${hashFile(file)}\n`;
  return sha256(content);
}

function designHandoffContextValid(): void {
  const context = y('handoff_context');
  const recordedHash = y('handoff_hash');
  if (!context || context === 'null')
    throw new Error(
      'handoff_context is missing from .comet.yaml\nNext: run node "$COMET_HANDOFF" <change> design --write before invoking Superpowers.',
    );
  if (!fileNonempty(context))
    throw new Error(
      `handoff_context does not point to a non-empty file: ${context}\nNext: regenerate the design handoff with comet-handoff.js.`,
    );
  if (!/^[a-f0-9]{64}$/.test(recordedHash))
    throw new Error(
      `handoff_hash is missing or invalid: ${recordedHash || 'null'}\nNext: regenerate the design handoff with comet-handoff.js.`,
    );
  const actualHash = computeHandoffHash();
  if (actualHash !== recordedHash)
    throw new Error(
      `OpenSpec artifacts changed after handoff was generated.\nExpected handoff_hash: ${recordedHash}\nActual handoff_hash:   ${actualHash}\nNext: rerun comet-handoff.js so Superpowers receives the current OpenSpec context.`,
    );
  const markdown = context.replace(/\.json$/, '.md');
  if (!fileNonempty(markdown))
    throw new Error(
      `design handoff markdown is missing or empty: ${markdown}\nNext: regenerate the design handoff with comet-handoff.js.`,
    );
}

function designHandoffMarkdownTraceable(): void {
  const context = y('handoff_context');
  if (!context || context === 'null')
    throw new Error('handoff_context is missing from .comet.yaml');
  const markdown = context.replace(/\.json$/, '.md');
  if (!fileNonempty(markdown))
    throw new Error(`design handoff markdown is missing or empty: ${markdown}`);
  const text = readFileSync(markdown, 'utf8');
  const missing: string[] = [];
  if (!/^Generated-by: comet-handoff\.js$/m.test(text))
    missing.push('handoff markdown is missing Generated-by marker');
  if (!/^- Mode: (compact|full)$/m.test(text))
    missing.push('handoff markdown is missing Mode marker');
  for (const file of sourceFiles()) {
    if (!existsSync(file)) continue;
    if (!text.includes(`- Source: ${slash(file)}`))
      missing.push(`handoff markdown is missing source reference: ${slash(file)}`);
    if (!text.includes(`- SHA256: ${hashFile(file)}`))
      missing.push(`handoff markdown is missing current sha256 for: ${file}`);
  }
  if (missing.length) throw new Error(missing.join('\n'));
}

function frontmatterHas(file: string, field: string, expected: string): boolean {
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
  const match = text.match(/^\s*---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return false;
  return new RegExp(`^${field}: ['"]?${expected}['"]?\\s*$`, 'm').test(match[1]);
}

function guardOpen(): void {
  console.error('=== Guard: open → next ===');
  check('proposal.md exists and non-empty', () => fileNonempty(join(changeDir, 'proposal.md')));
  check('design.md exists and non-empty', () => fileNonempty(join(changeDir, 'design.md')));
  check('tasks.md exists and non-empty', () => fileNonempty(join(changeDir, 'tasks.md')));
  check('tasks.md has at least one task', tasksHasAny);
}

function guardDesign(): void {
  console.error('=== Guard: design → build ===');
  const designDoc = y('design_doc');
  check('proposal.md exists', () => fileNonempty(join(changeDir, 'proposal.md')));
  check('design.md exists', () => fileNonempty(join(changeDir, 'design.md')));
  check('tasks.md exists', () => fileNonempty(join(changeDir, 'tasks.md')));
  check('design handoff context exists', designHandoffContextValid);
  check('design handoff markdown is traceable', designHandoffMarkdownTraceable);
  if (designDoc && designDoc !== 'null') {
    check(`Design Doc (${designDoc}) exists`, () => fileNonempty(designDoc));
    check('Design Doc frontmatter links current change', () =>
      frontmatterHas(designDoc, 'comet_change', change),
    );
    check('Design Doc declares technical design role', () =>
      frontmatterHas(designDoc, 'role', 'technical-design'),
    );
    check('Design Doc declares OpenSpec as canonical spec', () =>
      frontmatterHas(designDoc, 'canonical_spec', 'openspec'),
    );
  } else yellow('  [WARN] No design_doc recorded in .comet.yaml');
}

function guardBuild(): void {
  console.error('=== Guard: build → verify ===');
  check(
    'isolation selected',
    () =>
      ['branch', 'worktree'].includes(y('isolation')) ||
      `isolation must be branch or worktree, got '${y('isolation') || 'null'}'\nNext: ask the user to choose branch or worktree, create the chosen isolation, then run:\n  node "$COMET_STATE" set ${change} isolation <branch|worktree>`,
  );
  check(
    'build_mode selected',
    () =>
      ['subagent-driven-development', 'executing-plans', 'direct'].includes(y('build_mode')) ||
      `build_mode must be selected before leaving build, got '${y('build_mode') || 'null'}'\nNext: ask the user to choose an execution mode, then run:\n  node "$COMET_STATE" set ${change} build_mode <subagent-driven-development|executing-plans>`,
  );
  check(
    'build_mode allowed for workflow',
    () =>
      y('build_mode') !== 'direct' ||
      ['hotfix', 'tweak'].includes(y('workflow')) ||
      y('direct_override') === 'true' ||
      'build_mode=direct is only allowed for hotfix/tweak unless direct_override: true is recorded\nNext: choose executing-plans or subagent-driven-development, or stop and ask the user for an explicit direct override.',
  );
  check('tasks.md all tasks checked', tasksAllDone);
  check('proposal.md exists', () => fileNonempty(join(changeDir, 'proposal.md')));
  check('Build passes', buildPasses);
}

function guardVerify(): void {
  console.error('=== Guard: verify → archive ===');
  check('tasks.md all tasks checked', tasksAllDone);
  check('Build passes', verificationCommandPasses);
  check(
    'verification_report exists',
    () =>
      y('verification_report') &&
      y('verification_report') !== 'null' &&
      existsSync(y('verification_report')),
  );
  check('branch_status=handled', () => y('branch_status') === 'handled');
}

function guardArchive(): void {
  console.error('=== Guard: archive completeness ===');
  check('archived is true', () => y('archived') === 'true');
  check('proposal.md exists', () => fileNonempty(join(changeDir, 'proposal.md')));
  check('tasks.md all tasks checked', tasksAllDone);
}

function applyStateUpdate(): void {
  const state = join(scriptDir, 'comet-state.js');
  if (!existsSync(state)) {
    red('FATAL: comet-state.js not found; cannot apply state transition');
    process.exit(1);
  }
  const eventMap: Record<string, string> = {
    open: 'open-complete',
    design: 'design-complete',
    build: 'build-complete',
    verify: 'verify-pass',
  };
  const event = eventMap[phase];
  if (event) {
    const result = runNode(state, ['transition', change, event]);
    if (result.status !== 0) {
      process.stderr.write(result.stderr || '');
      process.exit(result.status ?? 1);
    }
  }
}

if (!['open', 'design', 'build', 'verify', 'archive'].includes(phase)) {
  red(`Unknown phase: ${phase}`);
  console.error('Valid phases: open, design, build, verify, archive');
  process.exit(1);
}
preflight();
type VoidFn = () => void;
(
  ({
    open: guardOpen,
    design: guardDesign,
    build: guardBuild,
    verify: guardVerify,
    archive: guardArchive,
  }) as Record<string, VoidFn>
)[phase]();
if (block) {
  console.error('');
  red('BLOCKED — fix failing checks before proceeding to next phase');
  process.exit(1);
}
console.error('');
green('ALL CHECKS PASSED — ready for next phase');
if (apply) {
  applyStateUpdate();
  const messages: Record<string, string> = {
    open: `  [APPLY] .comet.yaml updated: phase=${y('phase')}`,
    design: '  [APPLY] .comet.yaml updated: phase=build',
    build: '  [APPLY] .comet.yaml updated: phase=verify, verify_result=pending',
    verify: '  [APPLY] .comet.yaml updated: phase=archive, verify_result=pass',
  };
  if (messages[phase]) green(messages[phase]);
}
