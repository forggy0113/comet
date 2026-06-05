import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { execFileSync, spawnSync } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

const scriptsDir = path.resolve('assets', 'skills', 'comet', 'scripts');

function runNode(cwd: string, script: string, args: string[] = [], env: NodeJS.ProcessEnv = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    cwd,
    encoding: 'utf-8',
    env: { ...process.env, NODE_NO_WARNINGS: '1', ...env },
  });
}

async function writeFile(filePath: string, content: string) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, content);
}

async function createChange(tmpDir: string, name: string, yaml: string, tasks = '- [x] done\n') {
  const changeDir = path.join(tmpDir, 'openspec', 'changes', name);
  await fs.mkdir(changeDir, { recursive: true });
  await writeFile(path.join(changeDir, '.comet.yaml'), yaml);
  await writeFile(path.join(changeDir, 'proposal.md'), 'proposal\n');
  await writeFile(path.join(changeDir, 'design.md'), 'design\n');
  await writeFile(path.join(changeDir, 'tasks.md'), tasks);
  return changeDir;
}

describe('comet node scripts', () => {
  let tmpDir: string;
  let guardScript: string;
  let stateScript: string;

  beforeEach(async () => {
    tmpDir = path.join(
      os.tmpdir(),
      `comet-scripts-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    await fs.mkdir(tmpDir, { recursive: true });
    await fs.writeFile(path.join(tmpDir, 'package.json'), JSON.stringify({ type: 'module' }));
    const tmpScriptsDir = path.join(tmpDir, 'scripts');
    await fs.mkdir(tmpScriptsDir, { recursive: true });
    for (const name of [
      'comet-lib.js',
      'comet-env.js',
      'comet-archive.js',
      'comet-guard.js',
      'comet-handoff.js',
      'comet-state.js',
      'comet-yaml-validate.js',
    ]) {
      const content = await fs.readFile(path.join(scriptsDir, name), 'utf-8');
      await fs.writeFile(path.join(tmpScriptsDir, name), content);
    }
    guardScript = path.join(tmpScriptsDir, 'comet-guard.js');
    stateScript = path.join(tmpScriptsDir, 'comet-state.js');
  });

  afterEach(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });

  it('initializes a new change directory with workflow defaults', async () => {
    const result = runNode(tmpDir, stateScript, ['init', 'new-full-change', 'full']);
    const yaml = await fs.readFile(
      path.join(tmpDir, 'openspec', 'changes', 'new-full-change', '.comet.yaml'),
      'utf-8',
    );

    expect(result.status).toBe(0);
    expect(yaml).toContain('workflow: full');
    expect(yaml).toContain('phase: open');
    expect(yaml).toContain('verification_report: null');
    expect(yaml).toContain('branch_status: pending');
  }, 20_000);

  it('initializes build_pause as null for new changes', async () => {
    const result = runNode(tmpDir, stateScript, ['init', 'pause-defaults', 'full']);
    const yaml = await fs.readFile(
      path.join(tmpDir, 'openspec', 'changes', 'pause-defaults', '.comet.yaml'),
      'utf-8',
    );

    expect(result.status).toBe(0);
    expect(yaml).toContain('build_pause: null');
  }, 20_000);

  it('comet-env.js outputs bundled script paths from its own directory', async () => {
    const envScript = path.join(tmpDir, 'scripts', 'comet-env.js');
    const result = runNode(tmpDir, envScript);
    const env = JSON.parse(result.stdout);

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(env.COMET_STATE).toContain('comet-state.js');
    expect(env.COMET_GUARD).toContain('comet-guard.js');
    expect(env.COMET_HANDOFF).toContain('comet-handoff.js');
    expect(env.COMET_ARCHIVE).toContain('comet-archive.js');
  }, 20_000);

  it('comet-env.js returns failure when a bundled script is missing', async () => {
    const envScript = path.join(tmpDir, 'scripts', 'comet-env.js');
    await fs.rm(path.join(tmpDir, 'scripts', 'comet-guard.js'));
    const result = runNode(tmpDir, envScript);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain('ERROR: Comet scripts not found');
  }, 20_000);

  it('blocks build phase when the project build command fails', async () => {
    await createChange(
      tmpDir,
      'broken-build',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(1)"' } }),
    );

    const result = runNode(tmpDir, guardScript, ['broken-build', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] Build passes');
  }, 20_000);

  it('generates a design handoff and requires minimal design doc linkage before leaving design', async () => {
    const handoffScript = path.join(tmpDir, 'scripts', 'comet-handoff.js');
    await createChange(
      tmpDir,
      'handoff-change',
      [
        'workflow: full',
        'phase: design',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
      '- [ ] build the handoff\n',
    );
    await writeFile(
      path.join(tmpDir, 'openspec', 'changes', 'handoff-change', 'specs', 'capability', 'spec.md'),
      'delta spec\n',
    );

    const handoff = runNode(tmpDir, handoffScript, ['handoff-change', 'design', '--write']);
    const contextPath = runNode(tmpDir, stateScript, [
      'get',
      'handoff-change',
      'handoff_context',
    ]).stdout.trim();
    const contextHash = runNode(tmpDir, stateScript, [
      'get',
      'handoff-change',
      'handoff_hash',
    ]).stdout.trim();

    expect(handoff.status).toBe(0);
    expect(contextPath).toBe('openspec/changes/handoff-change/.comet/handoff/design-context.json');
    expect(contextHash).toMatch(/^[a-f0-9]{64}$/);
    await expect(fs.stat(path.join(tmpDir, contextPath))).resolves.toBeDefined();
    const contextMarkdown = await fs.readFile(
      path.join(
        tmpDir,
        'openspec',
        'changes',
        'handoff-change',
        '.comet',
        'handoff',
        'design-context.md',
      ),
      'utf-8',
    );
    expect(contextMarkdown).toContain('Mode: compact');
    expect(contextMarkdown).toContain('Source: openspec/changes/handoff-change/proposal.md');
    expect(contextMarkdown).toContain('SHA256:');

    await writeFile(
      path.join(tmpDir, 'docs', 'superpowers', 'specs', 'handoff-design.md'),
      [
        '---',
        'comet_change: handoff-change',
        'role: technical-design',
        'canonical_spec: openspec',
        '---',
        '',
      ].join('\n'),
    );
    runNode(tmpDir, stateScript, [
      'set',
      'handoff-change',
      'design_doc',
      'docs/superpowers/specs/handoff-design.md',
    ]);

    const result = runNode(tmpDir, guardScript, ['handoff-change', 'design']);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('[PASS] design handoff context exists');
    expect(result.stderr).toContain('[PASS] design handoff markdown is traceable');
    expect(result.stderr).toContain('[PASS] Design Doc frontmatter links current change');
    expect(result.stderr).toContain('[PASS] Design Doc declares OpenSpec as canonical spec');
  }, 20_000);

  it('reads comet yaml fields without including trailing comments', async () => {
    const handoffScript = path.join(tmpDir, 'scripts', 'comet-handoff.js');
    const validateScript = path.join(tmpDir, 'scripts', 'comet-yaml-validate.js');
    await createChange(
      tmpDir,
      'commented-yaml',
      [
        'workflow: full # full process',
        'phase: design # ready for handoff',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending # not verified yet',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false # active',
        '',
      ].join('\n'),
    );

    const phase = runNode(tmpDir, stateScript, ['get', 'commented-yaml', 'phase']);
    const validate = runNode(tmpDir, validateScript, ['commented-yaml']);
    const handoff = runNode(tmpDir, handoffScript, ['commented-yaml', 'design', '--write']);

    expect(phase.status).toBe(0);
    expect(phase.stdout.trim()).toBe('design');
    expect(validate.status).toBe(0);
    expect(handoff.status).toBe(0);
  }, 20_000);

  it('accepts design doc frontmatter after a BOM and leading blank lines', async () => {
    const handoffScript = path.join(tmpDir, 'scripts', 'comet-handoff.js');
    await createChange(
      tmpDir,
      'frontmatter-prefix',
      [
        'workflow: full',
        'phase: design',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    runNode(tmpDir, handoffScript, ['frontmatter-prefix', 'design', '--write']);
    await writeFile(
      path.join(tmpDir, 'docs', 'superpowers', 'specs', 'frontmatter-prefix-design.md'),
      [
        '\uFEFF',
        '',
        '---',
        'comet_change: frontmatter-prefix',
        'role: technical-design',
        'canonical_spec: openspec',
        '---',
        '',
      ].join('\n'),
    );
    runNode(tmpDir, stateScript, [
      'set',
      'frontmatter-prefix',
      'design_doc',
      'docs/superpowers/specs/frontmatter-prefix-design.md',
    ]);

    const result = runNode(tmpDir, guardScript, ['frontmatter-prefix', 'design']);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('[PASS] Design Doc frontmatter links current change');
    expect(result.stderr).toContain('[PASS] Design Doc declares OpenSpec as canonical spec');
  }, 20_000);

  it('generates a full-mode design handoff when --full is passed', async () => {
    const handoffScript = path.join(tmpDir, 'scripts', 'comet-handoff.js');
    await createChange(
      tmpDir,
      'full-handoff',
      [
        'workflow: full',
        'phase: design',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const handoff = runNode(tmpDir, handoffScript, ['full-handoff', 'design', '--write', '--full']);

    expect(handoff.status).toBe(0);
    const contextMarkdown = await fs.readFile(
      path.join(
        tmpDir,
        'openspec',
        'changes',
        'full-handoff',
        '.comet',
        'handoff',
        'design-context.md',
      ),
      'utf-8',
    );
    expect(contextMarkdown).toContain('Mode: full');
    expect(contextMarkdown).not.toContain('[TRUNCATED]');
  }, 20_000);

  it('rejects handoff generation when required OpenSpec artifacts are missing', async () => {
    const handoffScript = path.join(tmpDir, 'scripts', 'comet-handoff.js');
    const changeDir = path.join(tmpDir, 'openspec', 'changes', 'missing-artifacts');
    await fs.mkdir(changeDir, { recursive: true });
    await writeFile(
      path.join(changeDir, '.comet.yaml'),
      [
        'workflow: full',
        'phase: design',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(path.join(changeDir, 'proposal.md'), 'proposal\n');
    // design.md and tasks.md intentionally omitted

    const result = runNode(tmpDir, handoffScript, ['missing-artifacts', 'design', '--write']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('required OpenSpec artifact missing or empty');
  }, 20_000);

  it('detects OpenSpec artifacts changed after handoff was generated', async () => {
    const handoffScript = path.join(tmpDir, 'scripts', 'comet-handoff.js');
    await createChange(
      tmpDir,
      'stale-handoff',
      [
        'workflow: full',
        'phase: design',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    runNode(tmpDir, handoffScript, ['stale-handoff', 'design', '--write']);

    // Mutate proposal.md after handoff was generated
    await writeFile(
      path.join(tmpDir, 'openspec', 'changes', 'stale-handoff', 'proposal.md'),
      'mutated proposal\n',
    );

    const result = runNode(tmpDir, guardScript, ['stale-handoff', 'design']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] design handoff context exists');
    expect(result.stderr).toContain('OpenSpec artifacts changed after handoff was generated');
  }, 20_000);

  it('blocks design exit when design doc frontmatter is missing required fields', async () => {
    const handoffScript = path.join(tmpDir, 'scripts', 'comet-handoff.js');
    await createChange(
      tmpDir,
      'bad-frontmatter',
      [
        'workflow: full',
        'phase: design',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    runNode(tmpDir, handoffScript, ['bad-frontmatter', 'design', '--write']);

    // Design doc with wrong comet_change
    await writeFile(
      path.join(tmpDir, 'docs', 'superpowers', 'specs', 'bad-design.md'),
      [
        '---',
        'comet_change: wrong-change',
        'role: technical-design',
        'canonical_spec: openspec',
        '---',
        '',
      ].join('\n'),
    );
    runNode(tmpDir, stateScript, [
      'set',
      'bad-frontmatter',
      'design_doc',
      'docs/superpowers/specs/bad-design.md',
    ]);

    const result = runNode(tmpDir, guardScript, ['bad-frontmatter', 'design']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] Design Doc frontmatter links current change');
  }, 20_000);

  it('blocks build completion until isolation and build mode are selected', async () => {
    await createChange(
      tmpDir,
      'missing-build-decisions',
      [
        'workflow: full',
        'phase: build',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const guard = runNode(tmpDir, guardScript, ['missing-build-decisions', 'build']);
    const transition = runNode(tmpDir, stateScript, [
      'transition',
      'missing-build-decisions',
      'build-complete',
    ]);

    expect(guard.status).not.toBe(0);
    expect(guard.stderr).toContain('[FAIL] isolation selected');
    expect(guard.stderr).toContain('[FAIL] build_mode selected');
    expect(guard.stderr).toContain('Next: ask the user to choose branch or worktree');
    expect(guard.stderr).toContain('Next: ask the user to choose an execution mode');
    expect(transition.status).not.toBe(0);
    expect(transition.stderr).toContain('isolation must be branch or worktree');
  }, 20_000);

  it('allows setting build_pause to plan-ready and back to null', async () => {
    await createChange(
      tmpDir,
      'pause-set',
      [
        'workflow: full',
        'phase: build',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const setPlanReady = runNode(tmpDir, stateScript, [
      'set',
      'pause-set',
      'build_pause',
      'plan-ready',
    ]);
    const planReady = runNode(tmpDir, stateScript, ['get', 'pause-set', 'build_pause']);
    const setNull = runNode(tmpDir, stateScript, ['set', 'pause-set', 'build_pause', 'null']);
    const pausedNull = runNode(tmpDir, stateScript, ['get', 'pause-set', 'build_pause']);

    expect(setPlanReady.status).toBe(0);
    expect(planReady.stdout.trim()).toBe('plan-ready');
    expect(setNull.status).toBe(0);
    expect(pausedNull.stdout.trim()).toBe('null');
  }, 20_000);

  it('rejects invalid build_pause values during schema validation', async () => {
    await createChange(
      tmpDir,
      'invalid-build-pause',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'build_pause: paused',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runNode(tmpDir, guardScript, ['invalid-build-pause', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain("build_pause='paused' is not valid");
    expect(result.stderr).toContain('FATAL: .comet.yaml schema validation failed');
  }, 20_000);

  it('rejects direct build mode for full workflow without explicit override', async () => {
    await createChange(
      tmpDir,
      'direct-full',
      [
        'workflow: full',
        'phase: build',
        'build_mode: direct',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runNode(tmpDir, guardScript, ['direct-full', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] build_mode allowed for workflow');
    expect(result.stderr).toContain('direct is only allowed for hotfix/tweak');
    expect(result.stderr).toContain('Next: choose executing-plans or subagent-driven-development');
  }, 20_000);

  it('prints actionable remediation for unfinished tasks', async () => {
    await createChange(
      tmpDir,
      'unfinished-tasks',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
      ['- [x] done', '- [ ] finish guard remediation'].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runNode(tmpDir, guardScript, ['unfinished-tasks', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] tasks.md all tasks checked');
    expect(result.stderr).toContain('Unfinished tasks:');
    expect(result.stderr).toContain('finish guard remediation');
    expect(result.stderr).toContain('Next: complete or explicitly remove unfinished tasks');
  }, 20_000);

  it('rejects direct build mode for full workflow during state transition', async () => {
    await createChange(
      tmpDir,
      'direct-full-transition',
      [
        'workflow: full',
        'phase: build',
        'build_mode: direct',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runNode(tmpDir, stateScript, [
      'transition',
      'direct-full-transition',
      'build-complete',
    ]);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('build_mode=direct is only allowed for hotfix/tweak');
  });

  it('allows direct build mode for full workflow with explicit override', async () => {
    await createChange(
      tmpDir,
      'direct-full-override',
      [
        'workflow: full',
        'phase: build',
        'build_mode: direct',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'direct_override: true',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runNode(tmpDir, guardScript, ['direct-full-override', 'build']);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('[PASS] build_mode allowed for workflow');
  }, 20_000);

  it('runs configured build command and prints its failure output', async () => {
    await createChange(
      tmpDir,
      'configured-build',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: null',
        'build_command: node build-check.js',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'build-check.js'),
      'console.error("configured failure"); process.exit(1);\n',
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runNode(tmpDir, guardScript, ['configured-build', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('configured failure');
  }, 20_000);

  it('preserves configured command values with sed replacement metacharacters', async () => {
    const command = 'node -e "console.log(\'a&b|c\')"';
    await createChange(
      tmpDir,
      'command-metacharacters',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const set = runNode(tmpDir, stateScript, [
      'set',
      'command-metacharacters',
      'build_command',
      command,
    ]);
    const get = runNode(tmpDir, stateScript, ['get', 'command-metacharacters', 'build_command']);

    expect(set.status).toBe(0);
    expect(get.stdout.trim()).toBe(command);
  });

  it('keeps node scripts portable across GNU and BSD sed', async () => {
    for (const name of [
      'comet-env.js',
      'comet-state.js',
      'comet-archive.js',
      'comet-guard.js',
      'comet-handoff.js',
      'comet-yaml-validate.js',
    ]) {
      const content = await fs.readFile(path.join(tmpDir, 'scripts', name), 'utf-8');

      expect(content).not.toMatch(/\bsed\s+-i(?:\s|$)/);
    }
  });

  it('keeps optional YAML field reads independent from shell pipefail behavior', async () => {
    await createChange(
      tmpDir,
      'optional-fields',
      [
        'workflow: full',
        'phase: open',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runNode(tmpDir, stateScript, ['get', 'optional-fields', 'direct_override']);

    expect(result.status).toBe(0);
    expect(result.stdout).toBe('\n');
  }, 20_000);

  it('uses node executable for nested Comet script calls', async () => {
    for (const name of ['comet-archive.js', 'comet-guard.js', 'comet-handoff.js']) {
      const content = await fs.readFile(path.join(tmpDir, 'scripts', name), 'utf-8');

      expect(content, `${name} should invoke nested scripts through runNode`).toContain('runNode');
      expect(content, `${name} should not shell out to bash for nested scripts`).not.toMatch(/\bbash\b/);
    }
  });

  it('uses root-level build command config before inferred build commands', async () => {
    await createChange(
      tmpDir,
      'root-configured-build',
      [
        'workflow: full',
        'phase: build',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(path.join(tmpDir, 'comet.yaml'), 'build_command: node root-build-check.js\n');
    await writeFile(
      path.join(tmpDir, 'root-build-check.js'),
      'console.error("root configured failure"); process.exit(1);\n',
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runNode(tmpDir, guardScript, ['root-configured-build', 'build']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('root configured failure');
  }, 20_000);

  it('runs configured verify command before archiving', async () => {
    await createChange(
      tmpDir,
      'configured-verify',
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: full',
        'verify_command: node verify-check.js',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verification_report: docs/superpowers/reports/configured-verify.md',
        'branch_status: handled',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'docs', 'superpowers', 'reports', 'configured-verify.md'),
      'PASS\n',
    );
    await writeFile(
      path.join(tmpDir, 'verify-check.js'),
      'console.error("verify configured failure"); process.exit(1);\n',
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runNode(tmpDir, guardScript, ['configured-verify', 'verify']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('verify configured failure');
  }, 20_000);

  it('validates archive completeness after the change has moved into archive', async () => {
    await createChange(
      tmpDir,
      path.join('archive', '2026-05-21-done-change'),
      [
        'workflow: full',
        'phase: archive',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: light',
        'design_doc: null',
        'plan: null',
        'verify_result: pass',
        'verified_at: 2026-05-21',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: true',
        '',
      ].join('\n'),
    );

    const result = runNode(tmpDir, guardScript, ['2026-05-21-done-change', 'archive']);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('ALL CHECKS PASSED');
  });

  it('reports accurate archive step counts when syncing and annotating', async () => {
    const archiveScript = path.join(tmpDir, 'scripts', 'comet-archive.js');
    await createChange(
      tmpDir,
      'ready-to-archive',
      [
        'workflow: full',
        'phase: archive',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: full',
        'design_doc: docs/superpowers/specs/ready-design.md',
        'plan: docs/superpowers/plans/ready-plan.md',
        'verify_result: pass',
        'verification_report: docs/superpowers/reports/ready.md',
        'branch_status: handled',
        'verified_at: 2026-05-21',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'docs', 'superpowers', 'specs', 'ready-design.md'),
      'design\n',
    );
    await writeFile(path.join(tmpDir, 'docs', 'superpowers', 'plans', 'ready-plan.md'), 'plan\n');
    await writeFile(path.join(tmpDir, 'docs', 'superpowers', 'reports', 'ready.md'), 'PASS\n');
    await writeFile(
      path.join(
        tmpDir,
        'openspec',
        'changes',
        'ready-to-archive',
        'specs',
        'capability',
        'spec.md',
      ),
      'delta spec\n',
    );

    const result = runNode(tmpDir, archiveScript, ['ready-to-archive']);

    expect(result.status).toBe(0);
    expect(result.stderr).toContain('Archive complete. 7/7 steps succeeded.');
  }, 20_000);

  it('uses plan base-ref to scale verification after changes have been committed', async () => {
    execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });
    execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: tmpDir });
    execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: tmpDir });
    await writeFile(path.join(tmpDir, 'README.md'), 'base\n');
    execFileSync('git', ['add', '.'], { cwd: tmpDir });
    execFileSync('git', ['commit', '-m', 'base'], { cwd: tmpDir, stdio: 'ignore' });
    const baseRef = execFileSync('git', ['rev-parse', 'HEAD'], {
      cwd: tmpDir,
      encoding: 'utf-8',
    }).trim();

    await createChange(
      tmpDir,
      'large-change',
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: null',
        'design_doc: null',
        'plan: docs/superpowers/plans/large-change.md',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
      ['- [x] task 1', '- [x] task 2', '- [x] task 3'].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'docs', 'superpowers', 'plans', 'large-change.md'),
      ['---', 'change: large-change', `base-ref: ${baseRef}`, '---', ''].join('\n'),
    );
    for (let i = 1; i <= 6; i += 1) {
      await writeFile(path.join(tmpDir, 'src', `file-${i}.txt`), `change ${i}\n`);
    }
    execFileSync('git', ['add', '.'], { cwd: tmpDir });
    execFileSync('git', ['commit', '-m', 'large change'], { cwd: tmpDir, stdio: 'ignore' });

    const result = runNode(tmpDir, stateScript, ['scale', 'large-change']);
    const mode = runNode(tmpDir, stateScript, ['get', 'large-change', 'verify_mode']);

    expect(result.status).toBe(0);
    expect(mode.stdout.trim()).toBe('full');
  }, 25_000);

  it('transitions full workflow from open to design', async () => {
    await createChange(
      tmpDir,
      'full-change',
      [
        'workflow: full',
        'phase: open',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runNode(tmpDir, stateScript, ['transition', 'full-change', 'open-complete']);
    const phase = runNode(tmpDir, stateScript, ['get', 'full-change', 'phase']);

    expect(result.status).toBe(0);
    expect(phase.stdout.trim()).toBe('design');
  });

  it('transitions preset workflows from open directly to build', async () => {
    await createChange(
      tmpDir,
      'tweak-change',
      [
        'workflow: tweak',
        'phase: open',
        'build_mode: direct',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: light',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runNode(tmpDir, stateScript, ['transition', 'tweak-change', 'open-complete']);
    const phase = runNode(tmpDir, stateScript, ['get', 'tweak-change', 'phase']);

    expect(result.status).toBe(0);
    expect(phase.stdout.trim()).toBe('build');
  });

  it('transitions verify-pass and verify-fail through script-owned fields', async () => {
    await createChange(
      tmpDir,
      'verify-change',
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: full',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verification_report: null',
        'branch_status: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const fail = runNode(tmpDir, stateScript, ['transition', 'verify-change', 'verify-fail']);
    const failedPhase = runNode(tmpDir, stateScript, ['get', 'verify-change', 'phase']);
    const failedResult = runNode(tmpDir, stateScript, ['get', 'verify-change', 'verify_result']);
    const failedBranchStatus = runNode(tmpDir, stateScript, [
      'get',
      'verify-change',
      'branch_status',
    ]);

    expect(fail.status).toBe(0);
    expect(failedPhase.stdout.trim()).toBe('build');
    expect(failedResult.stdout.trim()).toBe('fail');
    expect(failedBranchStatus.stdout.trim()).toBe('pending');

    runNode(tmpDir, stateScript, ['set', 'verify-change', 'phase', 'verify']);
    runNode(tmpDir, stateScript, ['set', 'verify-change', 'verify_result', 'pending']);
    await writeFile(
      path.join(tmpDir, 'docs', 'superpowers', 'reports', 'verify-change.md'),
      'PASS\n',
    );
    runNode(tmpDir, stateScript, [
      'set',
      'verify-change',
      'verification_report',
      'docs/superpowers/reports/verify-change.md',
    ]);
    runNode(tmpDir, stateScript, ['set', 'verify-change', 'branch_status', 'handled']);

    const pass = runNode(tmpDir, stateScript, ['transition', 'verify-change', 'verify-pass']);
    const passedPhase = runNode(tmpDir, stateScript, ['get', 'verify-change', 'phase']);
    const passedResult = runNode(tmpDir, stateScript, ['get', 'verify-change', 'verify_result']);
    const verifiedAt = runNode(tmpDir, stateScript, ['get', 'verify-change', 'verified_at']);

    expect(pass.status).toBe(0);
    expect(passedPhase.stdout.trim()).toBe('archive');
    expect(passedResult.stdout.trim()).toBe('pass');
    expect(verifiedAt.stdout.trim()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  }, 20_000);

  it('blocks verify guard when verification evidence is missing', async () => {
    await createChange(
      tmpDir,
      'guard-verify',
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: light',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verification_report: null',
        'branch_status: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runNode(tmpDir, guardScript, ['guard-verify', 'verify', '--apply']);
    const phase = runNode(tmpDir, stateScript, ['get', 'guard-verify', 'phase']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('[FAIL] verification_report exists');
    expect(result.stderr).toContain('[FAIL] branch_status=handled');
    expect(phase.stdout.trim()).toBe('verify');
  }, 20_000);

  it('lets verify guard apply transition after verification and branch evidence are recorded', async () => {
    await createChange(
      tmpDir,
      'guard-verify',
      [
        'workflow: full',
        'phase: verify',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: light',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verification_report: docs/superpowers/reports/guard-verify.md',
        'branch_status: handled',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );
    await writeFile(
      path.join(tmpDir, 'docs', 'superpowers', 'reports', 'guard-verify.md'),
      'PASS\n',
    );
    await writeFile(
      path.join(tmpDir, 'package.json'),
      JSON.stringify({ scripts: { build: 'node -e "process.exit(0)"' } }),
    );

    const result = runNode(tmpDir, guardScript, ['guard-verify', 'verify', '--apply']);
    const phase = runNode(tmpDir, stateScript, ['get', 'guard-verify', 'phase']);
    const verifyResult = runNode(tmpDir, stateScript, ['get', 'guard-verify', 'verify_result']);

    expect(result.status).toBe(0);
    expect(phase.stdout.trim()).toBe('archive');
    expect(verifyResult.stdout.trim()).toBe('pass');
  }, 20_000);

  it('rejects invalid transition from the wrong phase', async () => {
    await createChange(
      tmpDir,
      'wrong-phase',
      [
        'workflow: full',
        'phase: open',
        'build_mode: null',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: null',
        'verify_mode: null',
        'design_doc: null',
        'plan: null',
        'verify_result: pending',
        'verified_at: null',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runNode(tmpDir, stateScript, ['transition', 'wrong-phase', 'build-complete']);

    expect(result.status).not.toBe(0);
    expect(result.stderr).toContain('expected phase build');
  });

  it('marks archived changes through transition in the archive directory', async () => {
    await createChange(
      tmpDir,
      path.join('archive', '2026-05-21-done-change'),
      [
        'workflow: full',
        'phase: archive',
        'build_mode: executing-plans',
        'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
        'isolation: branch',
        'verify_mode: full',
        'design_doc: null',
        'plan: null',
        'verify_result: pass',
        'verified_at: 2026-05-21',
        'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
        '',
      ].join('\n'),
    );

    const result = runNode(tmpDir, stateScript, [
      'transition',
      '2026-05-21-done-change',
      'archived',
    ]);
    const archived = runNode(tmpDir, stateScript, ['get', '2026-05-21-done-change', 'archived']);

    expect(result.status).toBe(0);
    expect(archived.stdout.trim()).toBe('true');
  });

  describe('check --recover', () => {
    it('outputs recovery context for open phase', async () => {
      await createChange(
        tmpDir,
        'recover-open',
        [
          'workflow: full',
          'phase: open',
          'build_mode: null',
          'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
          'isolation: null',
          'verify_mode: null',
          'design_doc: null',
          'plan: null',
          'verify_result: pending',
          'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
          '',
        ].join('\n'),
      );

      const result = runNode(tmpDir, stateScript, ['check', 'recover-open', 'open', '--recover']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Recovery Context: recover-open');
      expect(result.stdout).toContain('Phase: open');
      expect(result.stdout).toContain('Workflow: full');
      expect(result.stdout).toContain('proposal.md: DONE');
      expect(result.stdout).toContain('design.md: DONE');
      expect(result.stdout).toContain('tasks.md: DONE');
      expect(result.stdout).toContain('End Recovery Context');
    });

    it('outputs recovery context for build phase with partial progress', async () => {
      await createChange(
        tmpDir,
        'recover-build',
        [
          'workflow: full',
          'phase: build',
          'build_mode: null',
          'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
          'isolation: null',
          'verify_mode: null',
          'design_doc: null',
          'plan: null',
          'verify_result: pending',
          'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
          '',
        ].join('\n'),
        ['- [x] done task', '- [ ] pending task'].join('\n'),
      );

      const result = runNode(tmpDir, stateScript, ['check', 'recover-build', 'build', '--recover']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Phase: build');
      expect(result.stdout).toContain('isolation: PENDING');
      expect(result.stdout).toContain('build_mode: PENDING');
      expect(result.stdout).toContain('Tasks: 1/2 done, 1 pending');
      expect(result.stdout).toContain('AskUserQuestion');
    });

    it('outputs plan-ready pause recovery context for build phase', async () => {
      await writeFile(
        path.join(tmpDir, 'docs', 'superpowers', 'plans', 'pause-plan.md'),
        'plan\n',
      );
      await createChange(
        tmpDir,
        'recover-plan-ready',
        [
          'workflow: full',
          'phase: build',
          'build_mode: null',
          'build_pause: plan-ready',
          'verification_report: null',
          'branch_status: pending',
          'isolation: null',
          'verify_mode: null',
          'design_doc: null',
          'plan: docs/superpowers/plans/pause-plan.md',
          'verify_result: pending',
          'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
          '',
        ].join('\n'),
      );

      const result = runNode(tmpDir, stateScript, [
        'check',
        'recover-plan-ready',
        'build',
        '--recover',
      ]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('build_pause: DONE (plan-ready)');
      expect(result.stdout).toContain('Plan-ready pause');
      expect(result.stdout).toContain('choose isolation and build mode');
    });

    it('outputs recovery context for verify phase with completed verification', async () => {
      await writeFile(
        path.join(tmpDir, 'docs', 'superpowers', 'reports', 'recover-verify.md'),
        'PASS\n',
      );
      await createChange(
        tmpDir,
        'recover-verify',
        [
          'workflow: full',
          'phase: verify',
          'build_mode: executing-plans',
          'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
          'isolation: branch',
          'verify_mode: full',
          'design_doc: null',
          'plan: null',
          'verify_result: pass',
          'verification_report: docs/superpowers/reports/recover-verify.md',
          'branch_status: handled',
          'verified_at: null',
          'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
          '',
        ].join('\n'),
      );

      const result = runNode(tmpDir, stateScript, [
        'check',
        'recover-verify',
        'verify',
        '--recover',
      ]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Phase: verify');
      expect(result.stdout).toContain('verify_result: DONE (pass)');
      expect(result.stdout).toContain('branch_status: DONE (handled)');
      expect(result.stdout).toContain('guard to transition to archive');
    });

    it('outputs recovery context for design phase with handoff but no design doc', async () => {
      await createChange(
        tmpDir,
        'recover-design',
        [
          'workflow: full',
          'phase: design',
          'build_mode: null',
          'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
          'isolation: null',
          'verify_mode: null',
          'design_doc: null',
          'plan: null',
          'verify_result: pending',
          'handoff_context: openspec/changes/recover-design/.comet/handoff/design-context.json',
          'handoff_hash: abc123def456',
          'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
          '',
        ].join('\n'),
      );
      await writeFile(
        path.join(
          tmpDir,
          'openspec',
          'changes',
          'recover-design',
          '.comet',
          'handoff',
          'design-context.json',
        ),
        '{}',
      );

      const result = runNode(tmpDir, stateScript, [
        'check',
        'recover-design',
        'design',
        '--recover',
      ]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Phase: design');
      expect(result.stdout).toContain('handoff_context: DONE');
      expect(result.stdout).toContain('design_doc: PENDING');
      expect(result.stdout).toContain('brainstorming confirmation');
    });

    it('outputs recovery context for build phase when tasks.md is missing', async () => {
      const changeDir = path.join(tmpDir, 'openspec', 'changes', 'recover-no-tasks');
      await fs.mkdir(changeDir, { recursive: true });
      await writeFile(
        path.join(changeDir, '.comet.yaml'),
        [
          'workflow: full',
          'phase: build',
          'build_mode: executing-plans',
          'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
          'isolation: branch',
          'verify_mode: null',
          'design_doc: null',
          'plan: null',
          'verify_result: pending',
          'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
          '',
        ].join('\n'),
      );

      const result = runNode(tmpDir, stateScript, [
        'check',
        'recover-no-tasks',
        'build',
        '--recover',
      ]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Phase: build');
      expect(result.stdout).toContain('Tasks: tasks.md MISSING');
      expect(result.stdout).toContain('Recovery action');
      expect(result.stderr).not.toContain('unbound variable');
    });

    it('outputs recovery context for build phase with all tasks done', async () => {
      await createChange(
        tmpDir,
        'recover-build-done',
        [
          'workflow: full',
          'phase: build',
          'build_mode: executing-plans',
          'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
          'isolation: branch',
          'verify_mode: null',
          'design_doc: null',
          'plan: null',
          'verify_result: pending',
          'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
          '',
        ].join('\n'),
        ['- [x] task 1', '- [x] task 2'].join('\n'),
      );

      const result = runNode(tmpDir, stateScript, [
        'check',
        'recover-build-done',
        'build',
        '--recover',
      ]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Phase: build');
      expect(result.stdout).toContain('Tasks: 2/2 done, 0 pending');
      expect(result.stdout).toContain('All tasks done');
      expect(result.stdout).toContain('guard to transition to verify');
    });

    it('outputs recovery context for archive phase', async () => {
      await createChange(
        tmpDir,
        'recover-archive',
        [
          'workflow: full',
          'phase: archive',
          'build_mode: executing-plans',
          'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
          'isolation: branch',
          'verify_mode: full',
          'design_doc: null',
          'plan: null',
          'verify_result: pass',
          'branch_status: handled',
          'verified_at: 2026-05-29',
          'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
          '',
        ].join('\n'),
      );

      const result = runNode(tmpDir, stateScript, [
        'check',
        'recover-archive',
        'archive',
        '--recover',
      ]);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Phase: archive');
      expect(result.stdout).toContain('verify_result: DONE (pass)');
      expect(result.stdout).toContain('archived: DONE (false)');
      expect(result.stdout).toContain('/comet-archive');
      expect(result.stdout).toContain('End Recovery Context');
    });

    it('falls back to normal check when --recover is not passed', async () => {
      await createChange(
        tmpDir,
        'recover-normal',
        [
          'workflow: full',
          'phase: open',
          'build_mode: null',
          'build_pause: null',
        'verification_report: null',
        'branch_status: pending',
          'isolation: null',
          'verify_mode: null',
          'design_doc: null',
          'plan: null',
          'verify_result: pending',
          'created_at: 2026-01-01',
        'base_ref: null',
        'archived: false',
          '',
        ].join('\n'),
      );

      const result = runNode(tmpDir, stateScript, ['check', 'recover-normal', 'open']);

      expect(result.status).toBe(0);
      expect(result.stdout).toContain('Entry Check');
      expect(result.stderr).toContain('ALL CHECKS PASSED');
      expect(result.stdout).not.toContain('Recovery Context');
    });
  });
});
