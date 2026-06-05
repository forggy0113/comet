#!/usr/bin/env node
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
<<<<<<< HEAD
import { changeDirFor, currentHeadOrNull, fail, fieldValue, fileNonempty, git, green, red, setYamlField, today, validateChangeName, validateEnum, writeYamlData, yamlFileFor, yellow, } from './comet-lib.js';
const ENUMS = {
    workflow: ['full', 'hotfix', 'tweak'],
    phase: ['open', 'design', 'build', 'verify', 'archive'],
    build_mode: ['subagent-driven-development', 'executing-plans', 'direct'],
    build_pause: ['null', 'plan-ready'],
    isolation: ['branch', 'worktree'],
    verify_mode: ['light', 'full'],
    verify_result: ['pending', 'pass', 'fail'],
    branch_status: ['pending', 'handled'],
    archived: ['true', 'false'],
    direct_override: ['true', 'false'],
};
const SET_FIELDS = new Set([
    'workflow',
    'phase',
    'build_mode',
    'build_pause',
    'isolation',
    'verify_mode',
    'verify_result',
    'verification_report',
    'branch_status',
    'archived',
    'design_doc',
    'plan',
    'verified_at',
    'created_at',
    'direct_override',
    'build_command',
    'verify_command',
    'handoff_context',
    'handoff_hash',
    'base_ref',
]);
function get(change, field) {
    validateChangeName(change);
    const yaml = yamlFileFor(change);
    if (!existsSync(yaml))
        fail(`.comet.yaml not found at ${yaml}`);
    console.log(fieldValue(yaml, field));
}
function getValue(change, field) {
    const yaml = yamlFileFor(change);
    return fieldValue(yaml, field);
}
function set(change, field, value, quiet = false) {
    validateChangeName(change);
    const yaml = yamlFileFor(change);
    if (!existsSync(yaml))
        fail(`.comet.yaml not found at ${yaml}`);
    if (field === 'phase') {
        yellow("WARNING: Setting 'phase' directly bypasses state machine constraints.");
        yellow('  Consider using: comet-state.js transition <change-name> <event>');
    }
    else if (!SET_FIELDS.has(field)) {
        red(`ERROR: Unknown field: '${field}'`);
        red('Valid fields:');
        red('  workflow, phase, design_doc, plan, build_mode, build_pause, isolation,');
        red('  verify_mode, verify_result, verification_report, branch_status,');
        red('  verified_at, created_at, archived, base_ref, direct_override,');
        red('  build_command, verify_command, handoff_context, handoff_hash');
        process.exit(1);
    }
    if (ENUMS[field])
        validateEnum(value, ENUMS[field]);
    setYamlField(yaml, field, value);
    if (!quiet)
        green(`[SET] ${field}=${value}`);
}
function init(change, workflow) {
    validateChangeName(change);
    validateEnum(workflow, ENUMS.workflow);
    const changeDir = changeDirFor(change);
    const yaml = yamlFileFor(change);
    if (existsSync(yaml))
        fail(`.comet.yaml already exists at ${yaml}`);
    mkdirSync(changeDir, { recursive: true });
    const preset = workflow === 'full' ? ['null', 'null', 'null'] : ['direct', 'branch', 'light'];
    writeYamlData(yaml, {
        workflow,
        phase: 'open',
        build_mode: preset[0],
        build_pause: 'null',
        isolation: preset[1],
        verify_mode: preset[2],
        base_ref: currentHeadOrNull(),
        design_doc: 'null',
        plan: 'null',
        verify_result: 'pending',
        verification_report: 'null',
        branch_status: 'pending',
        created_at: today(),
        verified_at: 'null',
        archived: 'false',
    });
    green(`Initialized: ${yaml} (workflow=${workflow})`);
}
function requirePhase(change, expected) {
    const actual = getValue(change, 'phase');
    if (actual !== expected)
        fail(`Cannot transition '${change}': expected phase ${expected}, got ${actual}`);
}
function requireVerificationEvidence(change) {
    const report = getValue(change, 'verification_report');
    const branchStatus = getValue(change, 'branch_status');
    if (!report || report === 'null' || !existsSync(report)) {
        fail(`Cannot transition '${change}': verification_report must point to an existing report file`);
    }
    if (branchStatus !== 'handled')
        fail(`Cannot transition '${change}': branch_status must be handled`);
}
function requireBuildDecisions(change) {
    const workflow = getValue(change, 'workflow');
    const buildMode = getValue(change, 'build_mode');
    const isolation = getValue(change, 'isolation');
    const directOverride = getValue(change, 'direct_override');
    if (!['branch', 'worktree'].includes(isolation)) {
        fail(`Cannot transition '${change}': isolation must be branch or worktree, got '${isolation || 'null'}'`);
    }
    if (!ENUMS.build_mode.includes(buildMode)) {
        fail(`Cannot transition '${change}': build_mode must be selected before leaving build, got '${buildMode || 'null'}'`);
    }
    if (buildMode === 'direct' &&
        !['hotfix', 'tweak'].includes(workflow) &&
        directOverride !== 'true') {
        fail(`Cannot transition '${change}': build_mode=direct is only allowed for hotfix/tweak unless direct_override=true`);
    }
}
function transition(change, event) {
    validateChangeName(change);
    validateEnum(event, [
        'open-complete',
        'design-complete',
        'build-complete',
        'verify-pass',
        'verify-fail',
        'archived',
    ]);
    if (event === 'open-complete') {
        requirePhase(change, 'open');
        set(change, 'phase', getValue(change, 'workflow') === 'full' ? 'design' : 'build', true);
    }
    else if (event === 'design-complete') {
        requirePhase(change, 'design');
        set(change, 'phase', 'build', true);
    }
    else if (event === 'build-complete') {
        requirePhase(change, 'build');
        requireBuildDecisions(change);
        set(change, 'phase', 'verify', true);
        set(change, 'verify_result', 'pending', true);
        set(change, 'verification_report', 'null', true);
        set(change, 'branch_status', 'pending', true);
    }
    else if (event === 'verify-pass') {
        requirePhase(change, 'verify');
        requireVerificationEvidence(change);
        set(change, 'verify_result', 'pass', true);
        set(change, 'phase', 'archive', true);
        set(change, 'verified_at', today(), true);
    }
    else if (event === 'verify-fail') {
        requirePhase(change, 'verify');
        set(change, 'verify_result', 'fail', true);
        set(change, 'phase', 'build', true);
        set(change, 'branch_status', 'pending', true);
    }
    else if (event === 'archived') {
        requirePhase(change, 'archive');
        set(change, 'archived', 'true', true);
    }
    green(`[TRANSITION] ${event}`);
}
let checkBlock = false;
function pass(msg) {
    console.log(`  \u001b[32m[PASS]\u001b[0m ${msg}`);
}
function block(msg) {
    console.log(`  \u001b[31m[FAIL]\u001b[0m ${msg}`);
    checkBlock = true;
}
function checkNonempty(desc, file) {
    if (fileNonempty(file))
        pass(`${desc} non-empty`);
    else
        block(`${desc} missing or empty`);
}
function checkYamlIs(field, expected, change) {
    const actual = getValue(change, field);
    if (actual === expected)
        pass(`${field}=${actual} (expected: ${expected})`);
    else
        block(`${field}=${actual} (expected: ${expected})`);
}
function checkYamlEmpty(field, change) {
    const value = getValue(change, field);
    if (!value || value === 'null')
        pass(`${field} is empty/null`);
    else
        block(`${field}=${value} (expected: empty/null)`);
}
function check(change, phase) {
    validateChangeName(change);
    validateEnum(phase, ['open', 'design', 'build', 'verify', 'archive']);
    checkBlock = false;
    const changeDir = join('openspec', 'changes', change);
    const yaml = join(changeDir, '.comet.yaml');
    console.log(`=== Entry Check: comet-${phase} ===`);
    if (!existsSync(yaml))
        fail(`.comet.yaml not found at ${yaml}`);
    if (phase === 'open') {
        pass('.comet.yaml exists');
        checkYamlIs('phase', 'open', change);
    }
    else if (phase === 'design') {
        pass('.comet.yaml exists');
        checkYamlIs('phase', 'design', change);
        checkYamlIs('workflow', 'full', change);
        checkYamlEmpty('design_doc', change);
        checkNonempty('proposal.md', join(changeDir, 'proposal.md'));
        checkNonempty('design.md', join(changeDir, 'design.md'));
        checkNonempty('tasks.md', join(changeDir, 'tasks.md'));
    }
    else if (phase === 'build') {
        pass('.comet.yaml exists');
        checkYamlIs('phase', 'build', change);
        const workflow = getValue(change, 'workflow');
        if (workflow === 'full') {
            const designDoc = getValue(change, 'design_doc');
            if (designDoc && designDoc !== 'null' && existsSync(designDoc))
                pass(`design_doc=${designDoc} (file exists)`);
            else
                block(`design_doc=${designDoc} (expected: non-null and file exists)`);
        }
        else {
            pass(`workflow=${workflow} (design_doc not required)`);
        }
        checkNonempty('proposal.md', join(changeDir, 'proposal.md'));
        checkNonempty('tasks.md', join(changeDir, 'tasks.md'));
    }
    else if (phase === 'verify') {
        pass('.comet.yaml exists');
        checkYamlIs('phase', 'verify', change);
        const result = getValue(change, 'verify_result');
        if (result === 'pending' || !result || result === 'null')
            pass(`verify_result=${result} (expected: pending or null)`);
        else
            block(`verify_result=${result} (expected: pending or null)`);
    }
    else if (phase === 'archive') {
        pass('.comet.yaml exists');
        checkYamlIs('phase', 'archive', change);
        checkYamlIs('verify_result', 'pass', change);
        const archived = getValue(change, 'archived');
        if (archived !== 'true')
            pass(`archived=${archived} (expected: not true)`);
        else
            block(`archived=${archived} (expected: not true)`);
    }
    console.log('');
    if (checkBlock) {
        red('BLOCKED — fix failing checks before proceeding');
        process.exit(1);
    }
    green('ALL CHECKS PASSED — ready to proceed');
}
function fieldStatus(field, value, file = '') {
    if (!value || value === 'null')
        console.log(`  - ${field}: PENDING`);
    else if (file && !existsSync(file))
        console.log(`  - ${field}: BROKEN (path ${value} does not exist)`);
    else
        console.log(`  - ${field}: DONE (${value})`);
}
function recover(change) {
    validateChangeName(change);
    const changeDir = join('openspec', 'changes', change);
    const yaml = join(changeDir, '.comet.yaml');
    if (!existsSync(yaml))
        fail(`.comet.yaml not found at ${yaml}`);
    const phase = getValue(change, 'phase');
    const workflow = getValue(change, 'workflow');
    console.log(`=== Recovery Context: ${change} ===`);
    console.log(`Phase: ${phase}`);
    console.log(`Workflow: ${workflow}`);
    console.log('');
    const values = Object.fromEntries([
        'design_doc',
        'plan',
        'verify_result',
        'verify_mode',
        'verification_report',
        'branch_status',
        'handoff_context',
        'handoff_hash',
        'isolation',
        'build_mode',
        'build_pause',
        'direct_override',
        'archived',
    ].map((f) => [f, getValue(change, f)]));
    console.log('State fields:');
    if (phase === 'open') {
        console.log('  Artifacts:');
        for (const f of ['proposal.md', 'design.md', 'tasks.md'])
            console.log(`  - ${f}: ${fileNonempty(join(changeDir, f)) ? 'DONE' : 'PENDING'}`);
        console.log('\nRecovery action: Create or complete missing artifacts, then use AskUserQuestion for user confirmation.');
    }
    else if (phase === 'design') {
        console.log('  Artifacts:');
        for (const f of ['proposal.md', 'design.md', 'tasks.md'])
            console.log(`  - ${f}: ${fileNonempty(join(changeDir, f)) ? 'DONE' : 'MISSING (unexpected in design phase)'}`);
        console.log('\n  Design progress:');
        fieldStatus('handoff_context', values.handoff_context, values.handoff_context);
        fieldStatus('handoff_hash', values.handoff_hash);
        fieldStatus('design_doc', values.design_doc, values.design_doc);
        console.log('');
        if (values.design_doc && values.design_doc !== 'null' && existsSync(values.design_doc))
            console.log('Recovery action: Design Doc already created and linked. Run guard to transition to build.');
        else if (values.handoff_context &&
            values.handoff_context !== 'null' &&
            existsSync(values.handoff_context))
            console.log('Recovery action: Handoff generated but Design Doc not yet created. Resume from brainstorming confirmation (Step 1c).');
        else
            console.log('Recovery action: No handoff generated yet. Start from Step 1a (generate handoff package).');
    }
    else if (phase === 'build') {
        console.log('  Build decisions:');
        fieldStatus('isolation', values.isolation);
        fieldStatus('build_mode', values.build_mode);
        fieldStatus('build_pause', values.build_pause);
        if (values.build_mode === 'direct' && !['hotfix', 'tweak'].includes(workflow))
            fieldStatus('direct_override', values.direct_override);
        console.log('\n  Plan:');
        fieldStatus('plan', values.plan, values.plan);
        const tasksFile = join(changeDir, 'tasks.md');
        let total = 0;
        let done = 0;
        if (existsSync(tasksFile)) {
            const text = readFileSync(tasksFile, 'utf8');
            total = (text.match(/^- \[/gm) ?? []).length;
            done = (text.match(/^- \[x\]/gm) ?? []).length;
            console.log(`\n  Tasks: ${done}/${total} done, ${total - done} pending`);
        }
        else
            console.log('\n  Tasks: tasks.md MISSING');
        console.log('');
        if (values.build_pause === 'plan-ready' &&
            values.plan &&
            values.plan !== 'null' &&
            existsSync(values.plan) &&
            (!values.isolation ||
                values.isolation === 'null' ||
                !values.build_mode ||
                values.build_mode === 'null'))
            console.log('Recovery action: Plan-ready pause detected. Ask the user whether to continue, then choose isolation and build mode without regenerating the plan.');
        else if (values.build_pause === 'plan-ready' &&
            (!values.plan || values.plan === 'null' || !existsSync(values.plan)))
            console.log('Recovery action: Plan-ready pause is recorded, but the plan file is missing. Restore the plan file or rerun writing-plans before choosing execution.');
        else if (values.build_pause === 'plan-ready')
            console.log('Recovery action: Plan-ready pause is stale because build decisions are already selected. Clear build_pause to null, then continue from the first unchecked task.');
        else if (!values.isolation || values.isolation === 'null')
            console.log('Recovery action: Isolation not selected. Use AskUserQuestion to ask user for branch/worktree choice.');
        else if (!values.build_mode || values.build_mode === 'null')
            console.log('Recovery action: Build mode not selected. Use AskUserQuestion to ask user for execution method.');
        else if (!existsSync(tasksFile))
            console.log('Recovery action: tasks.md missing. Verify change directory integrity.');
        else if (total - done > 0)
            console.log('Recovery action: Read tasks.md and continue from first unchecked task.');
        else
            console.log('Recovery action: All tasks done. Run guard to transition to verify.');
    }
    else if (phase === 'verify') {
        console.log('  Verification:');
        fieldStatus('verify_result', values.verify_result);
        fieldStatus('verify_mode', values.verify_mode);
        fieldStatus('verification_report', values.verification_report, values.verification_report);
        fieldStatus('branch_status', values.branch_status);
        console.log('');
        if (values.verify_result === 'pass' && values.branch_status === 'handled')
            console.log('Recovery action: Verification complete. Run guard to transition to archive.');
        else if (values.verify_result === 'pass')
            console.log('Recovery action: Verification passed but branch not yet handled. Complete branch handling and set branch_status to handled.');
        else if (values.verify_result === 'fail')
            console.log('Recovery action: Verification failed and rolled back to build. Resume from /comet-build.');
        else
            console.log('Recovery action: Verification not yet started or in progress. Run scale assessment then verify.');
    }
    else if (phase === 'archive') {
        console.log('  Archive:');
        fieldStatus('verify_result', values.verify_result);
        fieldStatus('archived', values.archived);
        console.log('\nRecovery action: Run /comet-archive to complete archiving.');
    }
    console.log('\n=== End Recovery Context ===');
}
function countSpecFiles(dir) {
    if (!existsSync(dir))
        return 0;
    let count = 0;
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name);
        if (entry.isDirectory())
            count += countSpecFiles(p);
        else if (entry.isFile() && entry.name === 'spec.md')
            count += 1;
    }
    return count;
}
function scale(change) {
    validateChangeName(change);
    const changeDir = join('openspec', 'changes', change);
    const yaml = join(changeDir, '.comet.yaml');
    if (!existsSync(yaml))
        fail(`.comet.yaml not found at ${yaml}`);
    const tasksFile = join(changeDir, 'tasks.md');
    const taskCount = existsSync(tasksFile)
        ? (readFileSync(tasksFile, 'utf8').match(/^- \[/gm) ?? []).length
        : 0;
    const deltaSpecCount = countSpecFiles(join(changeDir, 'specs'));
    let changedFiles = 0;
    if (git(['rev-parse', '--git-dir']).status === 0) {
        let baseRef = '';
        const plan = getValue(change, 'plan');
        if (plan && plan !== 'null' && existsSync(plan)) {
            baseRef =
                readFileSync(plan, 'utf8')
                    .match(/^base-ref:\s*(.*)$/m)?.[1]
                    ?.trim() ?? '';
        }
        if (!baseRef || baseRef === 'null')
            baseRef = getValue(change, 'base_ref');
        const diff = baseRef && baseRef !== 'null' && git(['rev-parse', '--verify', baseRef]).status === 0
            ? git(['diff', '--name-only', `${baseRef}...HEAD`])
            : git(['diff', '--name-only', 'HEAD']);
        changedFiles = diff.status === 0 ? diff.stdout.split(/\r?\n/).filter(Boolean).length : 0;
    }
    const result = taskCount > 3 || deltaSpecCount > 1 || changedFiles > 4 ? 'full' : 'light';
    console.error(`=== Scale Assessment: ${change} ===`);
    console.error(`  Tasks: ${taskCount} (threshold: 3)`);
    console.error(`  Delta specs: ${deltaSpecCount} capabilities (threshold: 1)`);
    console.error(`  Changed files: ${changedFiles} (threshold: 4)`);
    console.error(`  → Result: ${result}`);
    setYamlField(yaml, 'verify_mode', result);
    green(`[SCALE] verify_mode=${result}`);
}
const [subcommand, ...args] = process.argv.slice(2);
if (subcommand === 'init' && args.length >= 2)
    init(args[0], args[1]);
else if (subcommand === 'get' && args.length >= 2)
    get(args[0], args[1]);
else if (subcommand === 'set' && args.length >= 3)
    set(args[0], args[1], args.slice(2).join(' '));
else if (subcommand === 'transition' && args.length >= 2)
    transition(args[0], args[1]);
else if (subcommand === 'check' && args.length >= 2)
    if (args[2] === '--recover')
        recover(args[0]);
    else
        check(args[0], args[1]);
else if (subcommand === 'scale' && args.length >= 1)
    scale(args[0]);
else {
    red(`Unknown subcommand: ${subcommand ?? ''}`);
    console.error('\nUsage: comet-state.js <subcommand> <change-name> [args...]');
    process.exit(1);
=======
import {
  changeDirFor,
  currentHeadOrNull,
  fail,
  fieldValue,
  fileNonempty,
  git,
  green,
  red,
  setYamlField,
  today,
  validateChangeName,
  validateEnum,
  writeYamlData,
  yamlFileFor,
  yellow,
} from './comet-lib.js';

const ENUMS = {
  workflow: ['full', 'hotfix', 'tweak'],
  phase: ['open', 'design', 'build', 'verify', 'archive'],
  build_mode: ['subagent-driven-development', 'executing-plans', 'direct'],
  build_pause: ['null', 'plan-ready'],
  isolation: ['branch', 'worktree'],
  verify_mode: ['light', 'full'],
  verify_result: ['pending', 'pass', 'fail'],
  branch_status: ['pending', 'handled'],
  archived: ['true', 'false'],
  direct_override: ['true', 'false'],
};

const SET_FIELDS = new Set([
  'workflow',
  'phase',
  'build_mode',
  'build_pause',
  'isolation',
  'verify_mode',
  'verify_result',
  'verification_report',
  'branch_status',
  'archived',
  'design_doc',
  'plan',
  'verified_at',
  'created_at',
  'direct_override',
  'build_command',
  'verify_command',
  'handoff_context',
  'handoff_hash',
  'base_ref',
]);

function get(change, field) {
  validateChangeName(change);
  const yaml = yamlFileFor(change);
  if (!existsSync(yaml)) fail(`.comet.yaml not found at ${yaml}`);
  console.log(fieldValue(yaml, field));
}

function getValue(change, field) {
  const yaml = yamlFileFor(change);
  return fieldValue(yaml, field);
}

function set(change, field, value, quiet = false) {
  validateChangeName(change);
  const yaml = yamlFileFor(change);
  if (!existsSync(yaml)) fail(`.comet.yaml not found at ${yaml}`);
  if (field === 'phase') {
    yellow("WARNING: Setting 'phase' directly bypasses state machine constraints.");
    yellow('  Consider using: comet-state.js transition <change-name> <event>');
  } else if (!SET_FIELDS.has(field)) {
    red(`ERROR: Unknown field: '${field}'`);
    red('Valid fields:');
    red('  workflow, phase, design_doc, plan, build_mode, build_pause, isolation,');
    red('  verify_mode, verify_result, verification_report, branch_status,');
    red('  verified_at, created_at, archived, base_ref, direct_override,');
    red('  build_command, verify_command, handoff_context, handoff_hash');
    process.exit(1);
  }
  if (ENUMS[field]) validateEnum(value, ENUMS[field]);
  setYamlField(yaml, field, value);
  if (!quiet) green(`[SET] ${field}=${value}`);
}

function init(change, workflow) {
  validateChangeName(change);
  validateEnum(workflow, ENUMS.workflow);
  const changeDir = changeDirFor(change);
  const yaml = yamlFileFor(change);
  if (existsSync(yaml)) fail(`.comet.yaml already exists at ${yaml}`);
  mkdirSync(changeDir, { recursive: true });
  const preset = workflow === 'full' ? ['null', 'null', 'null'] : ['direct', 'branch', 'light'];
  writeYamlData(yaml, {
    workflow,
    phase: 'open',
    build_mode: preset[0],
    build_pause: 'null',
    isolation: preset[1],
    verify_mode: preset[2],
    base_ref: currentHeadOrNull(),
    design_doc: 'null',
    plan: 'null',
    verify_result: 'pending',
    verification_report: 'null',
    branch_status: 'pending',
    created_at: today(),
    verified_at: 'null',
    archived: 'false',
  });
  green(`Initialized: ${yaml} (workflow=${workflow})`);
}

function requirePhase(change, expected) {
  const actual = getValue(change, 'phase');
  if (actual !== expected) fail(`Cannot transition '${change}': expected phase ${expected}, got ${actual}`);
}

function requireVerificationEvidence(change) {
  const report = getValue(change, 'verification_report');
  const branchStatus = getValue(change, 'branch_status');
  if (!report || report === 'null' || !existsSync(report)) {
    fail(`Cannot transition '${change}': verification_report must point to an existing report file`);
  }
  if (branchStatus !== 'handled') fail(`Cannot transition '${change}': branch_status must be handled`);
}

function requireBuildDecisions(change) {
  const workflow = getValue(change, 'workflow');
  const buildMode = getValue(change, 'build_mode');
  const isolation = getValue(change, 'isolation');
  const directOverride = getValue(change, 'direct_override');
  if (!['branch', 'worktree'].includes(isolation)) {
    fail(`Cannot transition '${change}': isolation must be branch or worktree, got '${isolation || 'null'}'`);
  }
  if (!ENUMS.build_mode.includes(buildMode)) {
    fail(`Cannot transition '${change}': build_mode must be selected before leaving build, got '${buildMode || 'null'}'`);
  }
  if (buildMode === 'direct' && !['hotfix', 'tweak'].includes(workflow) && directOverride !== 'true') {
    fail(`Cannot transition '${change}': build_mode=direct is only allowed for hotfix/tweak unless direct_override=true`);
  }
}

function transition(change, event) {
  validateChangeName(change);
  validateEnum(event, ['open-complete', 'design-complete', 'build-complete', 'verify-pass', 'verify-fail', 'archived']);
  if (event === 'open-complete') {
    requirePhase(change, 'open');
    set(change, 'phase', getValue(change, 'workflow') === 'full' ? 'design' : 'build', true);
  } else if (event === 'design-complete') {
    requirePhase(change, 'design');
    set(change, 'phase', 'build', true);
  } else if (event === 'build-complete') {
    requirePhase(change, 'build');
    requireBuildDecisions(change);
    set(change, 'phase', 'verify', true);
    set(change, 'verify_result', 'pending', true);
    set(change, 'verification_report', 'null', true);
    set(change, 'branch_status', 'pending', true);
  } else if (event === 'verify-pass') {
    requirePhase(change, 'verify');
    requireVerificationEvidence(change);
    set(change, 'verify_result', 'pass', true);
    set(change, 'phase', 'archive', true);
    set(change, 'verified_at', today(), true);
  } else if (event === 'verify-fail') {
    requirePhase(change, 'verify');
    set(change, 'verify_result', 'fail', true);
    set(change, 'phase', 'build', true);
    set(change, 'branch_status', 'pending', true);
  } else if (event === 'archived') {
    requirePhase(change, 'archive');
    set(change, 'archived', 'true', true);
  }
  green(`[TRANSITION] ${event}`);
}

let checkBlock = false;
function pass(msg) { console.log(`  \u001b[32m[PASS]\u001b[0m ${msg}`); }
function block(msg) { console.log(`  \u001b[31m[FAIL]\u001b[0m ${msg}`); checkBlock = true; }
function checkNonempty(desc, file) { fileNonempty(file) ? pass(`${desc} non-empty`) : block(`${desc} missing or empty`); }
function checkYamlIs(field, expected, change) {
  const actual = getValue(change, field);
  actual === expected ? pass(`${field}=${actual} (expected: ${expected})`) : block(`${field}=${actual} (expected: ${expected})`);
}
function checkYamlEmpty(field, change) {
  const value = getValue(change, field);
  !value || value === 'null' ? pass(`${field} is empty/null`) : block(`${field}=${value} (expected: empty/null)`);
}

function check(change, phase) {
  validateChangeName(change);
  validateEnum(phase, ['open', 'design', 'build', 'verify', 'archive']);
  checkBlock = false;
  const changeDir = join('openspec', 'changes', change);
  const yaml = join(changeDir, '.comet.yaml');
  console.log(`=== Entry Check: comet-${phase} ===`);
  if (!existsSync(yaml)) fail(`.comet.yaml not found at ${yaml}`);
  if (phase === 'open') {
    pass('.comet.yaml exists');
    checkYamlIs('phase', 'open', change);
  } else if (phase === 'design') {
    pass('.comet.yaml exists');
    checkYamlIs('phase', 'design', change);
    checkYamlIs('workflow', 'full', change);
    checkYamlEmpty('design_doc', change);
    checkNonempty('proposal.md', join(changeDir, 'proposal.md'));
    checkNonempty('design.md', join(changeDir, 'design.md'));
    checkNonempty('tasks.md', join(changeDir, 'tasks.md'));
  } else if (phase === 'build') {
    pass('.comet.yaml exists');
    checkYamlIs('phase', 'build', change);
    const workflow = getValue(change, 'workflow');
    if (workflow === 'full') {
      const designDoc = getValue(change, 'design_doc');
      designDoc && designDoc !== 'null' && existsSync(designDoc)
        ? pass(`design_doc=${designDoc} (file exists)`)
        : block(`design_doc=${designDoc} (expected: non-null and file exists)`);
    } else {
      pass(`workflow=${workflow} (design_doc not required)`);
    }
    checkNonempty('proposal.md', join(changeDir, 'proposal.md'));
    checkNonempty('tasks.md', join(changeDir, 'tasks.md'));
  } else if (phase === 'verify') {
    pass('.comet.yaml exists');
    checkYamlIs('phase', 'verify', change);
    const result = getValue(change, 'verify_result');
    result === 'pending' || !result || result === 'null'
      ? pass(`verify_result=${result} (expected: pending or null)`)
      : block(`verify_result=${result} (expected: pending or null)`);
  } else if (phase === 'archive') {
    pass('.comet.yaml exists');
    checkYamlIs('phase', 'archive', change);
    checkYamlIs('verify_result', 'pass', change);
    const archived = getValue(change, 'archived');
    archived !== 'true' ? pass(`archived=${archived} (expected: not true)`) : block(`archived=${archived} (expected: not true)`);
  }
  console.log('');
  if (checkBlock) {
    red('BLOCKED — fix failing checks before proceeding');
    process.exit(1);
  }
  green('ALL CHECKS PASSED — ready to proceed');
}

function fieldStatus(field, value, file = '') {
  if (!value || value === 'null') console.log(`  - ${field}: PENDING`);
  else if (file && !existsSync(file)) console.log(`  - ${field}: BROKEN (path ${value} does not exist)`);
  else console.log(`  - ${field}: DONE (${value})`);
}

function recover(change) {
  validateChangeName(change);
  const changeDir = join('openspec', 'changes', change);
  const yaml = join(changeDir, '.comet.yaml');
  if (!existsSync(yaml)) fail(`.comet.yaml not found at ${yaml}`);
  const phase = getValue(change, 'phase');
  const workflow = getValue(change, 'workflow');
  console.log(`=== Recovery Context: ${change} ===`);
  console.log(`Phase: ${phase}`);
  console.log(`Workflow: ${workflow}`);
  console.log('');
  const values = Object.fromEntries(['design_doc', 'plan', 'verify_result', 'verify_mode', 'verification_report', 'branch_status', 'handoff_context', 'handoff_hash', 'isolation', 'build_mode', 'build_pause', 'direct_override', 'archived'].map((f) => [f, getValue(change, f)]));
  console.log('State fields:');
  if (phase === 'open') {
    console.log('  Artifacts:');
    for (const f of ['proposal.md', 'design.md', 'tasks.md']) console.log(`  - ${f}: ${fileNonempty(join(changeDir, f)) ? 'DONE' : 'PENDING'}`);
    console.log('\nRecovery action: Create or complete missing artifacts, then use AskUserQuestion for user confirmation.');
  } else if (phase === 'design') {
    console.log('  Artifacts:');
    for (const f of ['proposal.md', 'design.md', 'tasks.md']) console.log(`  - ${f}: ${fileNonempty(join(changeDir, f)) ? 'DONE' : 'MISSING (unexpected in design phase)'}`);
    console.log('\n  Design progress:');
    fieldStatus('handoff_context', values.handoff_context, values.handoff_context);
    fieldStatus('handoff_hash', values.handoff_hash);
    fieldStatus('design_doc', values.design_doc, values.design_doc);
    console.log('');
    if (values.design_doc && values.design_doc !== 'null' && existsSync(values.design_doc)) console.log('Recovery action: Design Doc already created and linked. Run guard to transition to build.');
    else if (values.handoff_context && values.handoff_context !== 'null' && existsSync(values.handoff_context)) console.log('Recovery action: Handoff generated but Design Doc not yet created. Resume from brainstorming confirmation (Step 1c).');
    else console.log('Recovery action: No handoff generated yet. Start from Step 1a (generate handoff package).');
  } else if (phase === 'build') {
    console.log('  Build decisions:');
    fieldStatus('isolation', values.isolation);
    fieldStatus('build_mode', values.build_mode);
    fieldStatus('build_pause', values.build_pause);
    if (values.build_mode === 'direct' && !['hotfix', 'tweak'].includes(workflow)) fieldStatus('direct_override', values.direct_override);
    console.log('\n  Plan:');
    fieldStatus('plan', values.plan, values.plan);
    const tasksFile = join(changeDir, 'tasks.md');
    let total = 0;
    let done = 0;
    if (existsSync(tasksFile)) {
      const text = readFileSync(tasksFile, 'utf8');
      total = (text.match(/^- \[/gm) ?? []).length;
      done = (text.match(/^- \[x\]/gm) ?? []).length;
      console.log(`\n  Tasks: ${done}/${total} done, ${total - done} pending`);
    } else console.log('\n  Tasks: tasks.md MISSING');
    console.log('');
    if (values.build_pause === 'plan-ready' && values.plan && values.plan !== 'null' && existsSync(values.plan) && (!values.isolation || values.isolation === 'null' || !values.build_mode || values.build_mode === 'null')) console.log('Recovery action: Plan-ready pause detected. Ask the user whether to continue, then choose isolation and build mode without regenerating the plan.');
    else if (values.build_pause === 'plan-ready' && (!values.plan || values.plan === 'null' || !existsSync(values.plan))) console.log('Recovery action: Plan-ready pause is recorded, but the plan file is missing. Restore the plan file or rerun writing-plans before choosing execution.');
    else if (values.build_pause === 'plan-ready') console.log('Recovery action: Plan-ready pause is stale because build decisions are already selected. Clear build_pause to null, then continue from the first unchecked task.');
    else if (!values.isolation || values.isolation === 'null') console.log('Recovery action: Isolation not selected. Use AskUserQuestion to ask user for branch/worktree choice.');
    else if (!values.build_mode || values.build_mode === 'null') console.log('Recovery action: Build mode not selected. Use AskUserQuestion to ask user for execution method.');
    else if (!existsSync(tasksFile)) console.log('Recovery action: tasks.md missing. Verify change directory integrity.');
    else if (total - done > 0) console.log('Recovery action: Read tasks.md and continue from first unchecked task.');
    else console.log('Recovery action: All tasks done. Run guard to transition to verify.');
  } else if (phase === 'verify') {
    console.log('  Verification:');
    fieldStatus('verify_result', values.verify_result);
    fieldStatus('verify_mode', values.verify_mode);
    fieldStatus('verification_report', values.verification_report, values.verification_report);
    fieldStatus('branch_status', values.branch_status);
    console.log('');
    if (values.verify_result === 'pass' && values.branch_status === 'handled') console.log('Recovery action: Verification complete. Run guard to transition to archive.');
    else if (values.verify_result === 'pass') console.log('Recovery action: Verification passed but branch not yet handled. Complete branch handling and set branch_status to handled.');
    else if (values.verify_result === 'fail') console.log('Recovery action: Verification failed and rolled back to build. Resume from /comet-build.');
    else console.log('Recovery action: Verification not yet started or in progress. Run scale assessment then verify.');
  } else if (phase === 'archive') {
    console.log('  Archive:');
    fieldStatus('verify_result', values.verify_result);
    fieldStatus('archived', values.archived);
    console.log('\nRecovery action: Run /comet-archive to complete archiving.');
  }
  console.log('\n=== End Recovery Context ===');
}

function countSpecFiles(dir) {
  if (!existsSync(dir)) return 0;
  let count = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) count += countSpecFiles(p);
    else if (entry.isFile() && entry.name === 'spec.md') count += 1;
  }
  return count;
}

function scale(change) {
  validateChangeName(change);
  const changeDir = join('openspec', 'changes', change);
  const yaml = join(changeDir, '.comet.yaml');
  if (!existsSync(yaml)) fail(`.comet.yaml not found at ${yaml}`);
  const tasksFile = join(changeDir, 'tasks.md');
  const taskCount = existsSync(tasksFile) ? (readFileSync(tasksFile, 'utf8').match(/^- \[/gm) ?? []).length : 0;
  const deltaSpecCount = countSpecFiles(join(changeDir, 'specs'));
  let changedFiles = 0;
  if (git(['rev-parse', '--git-dir']).status === 0) {
    let baseRef = '';
    const plan = getValue(change, 'plan');
    if (plan && plan !== 'null' && existsSync(plan)) {
      baseRef = readFileSync(plan, 'utf8').match(/^base-ref:\s*(.*)$/m)?.[1]?.trim() ?? '';
    }
    if (!baseRef || baseRef === 'null') baseRef = getValue(change, 'base_ref');
    const diff = baseRef && baseRef !== 'null' && git(['rev-parse', '--verify', baseRef]).status === 0
      ? git(['diff', '--name-only', `${baseRef}...HEAD`])
      : git(['diff', '--name-only', 'HEAD']);
    changedFiles = diff.status === 0 ? diff.stdout.split(/\r?\n/).filter(Boolean).length : 0;
  }
  const result = taskCount > 3 || deltaSpecCount > 1 || changedFiles > 4 ? 'full' : 'light';
  console.error(`=== Scale Assessment: ${change} ===`);
  console.error(`  Tasks: ${taskCount} (threshold: 3)`);
  console.error(`  Delta specs: ${deltaSpecCount} capabilities (threshold: 1)`);
  console.error(`  Changed files: ${changedFiles} (threshold: 4)`);
  console.error(`  → Result: ${result}`);
  setYamlField(yaml, 'verify_mode', result);
  green(`[SCALE] verify_mode=${result}`);
}

const [subcommand, ...args] = process.argv.slice(2);
if (subcommand === 'init' && args.length >= 2) init(args[0], args[1]);
else if (subcommand === 'get' && args.length >= 2) get(args[0], args[1]);
else if (subcommand === 'set' && args.length >= 3) set(args[0], args[1], args.slice(2).join(' '));
else if (subcommand === 'transition' && args.length >= 2) transition(args[0], args[1]);
else if (subcommand === 'check' && args.length >= 2) args[2] === '--recover' ? recover(args[0]) : check(args[0], args[1]);
else if (subcommand === 'scale' && args.length >= 1) scale(args[0]);
else {
  red(`Unknown subcommand: ${subcommand ?? ''}`);
  console.error('\nUsage: comet-state.js <subcommand> <change-name> [args...]');
  process.exit(1);
>>>>>>> eeac7a023b8ea6033b2606f7fd7d412881e7c398
}
