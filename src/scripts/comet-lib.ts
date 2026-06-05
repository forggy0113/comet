#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync, type SpawnSyncOptions, type SpawnSyncReturns } from 'node:child_process';

export const scriptDir: string = dirname(fileURLToPath(import.meta.url));

export const FIELD_ORDER: string[] = [
  'workflow',
  'phase',
  'build_mode',
  'build_pause',
  'isolation',
  'verify_mode',
  'base_ref',
  'design_doc',
  'plan',
  'verify_result',
  'verification_report',
  'branch_status',
  'created_at',
  'verified_at',
  'archived',
  'direct_override',
  'build_command',
  'verify_command',
  'handoff_context',
  'handoff_hash',
];

export const KNOWN_KEYS: Set<string> = new Set(FIELD_ORDER);

export function color(code: number, message: string): string {
  return `\u001b[${code}m${message}\u001b[0m`;
}

export function red(message: string): void {
  console.error(color(31, message));
}

export function green(message: string): void {
  console.error(color(32, message));
}

export function yellow(message: string): void {
  console.error(color(33, message));
}

export function fail(message: string, prefix: string = 'ERROR'): never {
  red(`${prefix}: ${message}`);
  process.exit(1);
}

export function validateChangeName(name: string, prefix: string = 'ERROR'): void {
  if (!name) fail('Change name cannot be empty', prefix);
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    red(`${prefix}: Invalid change name: '${name}'`);
    red('Valid characters: a-z, A-Z, 0-9, -, _');
    process.exit(1);
  }
  if (name.includes('..'))
    fail("Change name cannot contain '..' (path traversal not allowed)", prefix);
}

export function validateEnum(value: string, validValues: string[]): void {
  if (validValues.includes(value)) return;
  red(`ERROR: Invalid value: '${value}'`);
  red(`Valid values: ${validValues.join(' ')}`);
  process.exit(1);
}

export function stripInlineComment(value: string): string {
  let out = '';
  let quote = '';
  for (let i = 0; i < value.length; i += 1) {
    const c = value[i];
    if (!quote) {
      if (c === '"' || c === "'") quote = c;
      else if (c === '#' && (i === 0 || /\s/.test(value[i - 1]))) return out.trimEnd();
    } else if (c === quote) {
      quote = '';
    }
    out += c;
  }
  return out;
}

export function stripWrappingQuotes(value: string): string {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if (first === '"' && last === '"') {
      try {
        return JSON.parse(value) as string;
      } catch {
        return value.slice(1, -1);
      }
    }
    if (first === "'" && last === "'") return value.slice(1, -1);
  }
  return value;
}

interface YamlData {
  [key: string]: string;
}

interface ParsedYaml {
  data: YamlData;
  keys: string[];
  text: string;
}

export function parseYamlLines(file: string): ParsedYaml {
  const text = readFileSync(file, 'utf8');
  const data: YamlData = {};
  const keys: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^([^\s:#][^:]*):\s*(.*)$/);
    if (!match) continue;
    const key = match[1].trim();
    const value = stripWrappingQuotes(stripInlineComment(match[2] ?? ''));
    data[key] = value;
    keys.push(key);
  }
  return { data, keys, text };
}

export function fieldValue(file: string, field: string): string {
  if (!existsSync(file)) return '';
  return parseYamlLines(file).data[field] ?? '';
}

function formatYamlValue(value: string): string {
  const stringValue = String(value);
  if (stringValue === '') return '';
  if (/^[A-Za-z0-9_./:@\\-]+$/.test(stringValue)) return stringValue;
  return JSON.stringify(stringValue);
}

export function writeYamlData(file: string, data: Record<string, string>): void {
  const lines: string[] = [];
  for (const key of FIELD_ORDER) {
    if (Object.prototype.hasOwnProperty.call(data, key))
      lines.push(`${key}: ${formatYamlValue(data[key])}`);
  }
  for (const key of Object.keys(data)) {
    if (!FIELD_ORDER.includes(key)) lines.push(`${key}: ${formatYamlValue(data[key])}`);
  }
  writeFileSync(file, `${lines.join('\n')}\n`);
}

export function setYamlField(file: string, field: string, value: string): void {
  const { data } = parseYamlLines(file);
  data[field] = String(value);
  writeYamlData(file, data);
}

export function fileNonempty(file: string): boolean {
  try {
    return statSync(file).isFile() && statSync(file).size > 0;
  } catch {
    return false;
  }
}

export function changeDirFor(changeName: string): string {
  const active = join('openspec', 'changes', changeName);
  const archived = join('openspec', 'changes', 'archive', changeName);
  if (existsSync(active)) return active;
  if (existsSync(archived)) return archived;
  return active;
}

export function yamlFileFor(changeName: string): string {
  return join(changeDirFor(changeName), '.comet.yaml');
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function git(args: string[]): SpawnSyncReturns<string> {
  return spawnSync('git', args, { encoding: 'utf8' });
}

export function currentHeadOrNull(): string {
  const verify = git(['rev-parse', '--verify', 'HEAD']);
  if (verify.status !== 0) return 'null';
  const head = git(['rev-parse', 'HEAD']);
  return head.status === 0 ? head.stdout.trim() : 'null';
}

export function sha256(content: string | Buffer): string {
  return createHash('sha256').update(content).digest('hex');
}

export function hashFile(file: string): string {
  return sha256(readFileSync(file));
}

export function ensureDir(dir: string): void {
  mkdirSync(dir, { recursive: true });
}

export function runNode(script: string, args: string[], options: SpawnSyncOptions = {}) {
  return spawnSync(process.execPath, [script, ...args], {
    encoding: 'utf8',
    stdio: 'pipe',
    ...options,
  });
}

export function runCommandString(command: string, options: SpawnSyncOptions = {}) {
  console.error(`+ ${command}`);
  return spawnSync(command, { encoding: 'utf8', stdio: 'inherit', shell: true, ...options });
}

export function runCommand(argv: string[], options: SpawnSyncOptions = {}) {
  const [command, ...args] = argv;
  return spawnSync(command, args, {
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
}

export function slash(file: string): string {
  return file.replace(/\\/g, '/');
}
