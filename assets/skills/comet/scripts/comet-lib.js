#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
<<<<<<< HEAD
export const scriptDir = dirname(fileURLToPath(import.meta.url));
export const FIELD_ORDER = [
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
export const KNOWN_KEYS = new Set(FIELD_ORDER);
export function color(code, message) {
    return `\u001b[${code}m${message}\u001b[0m`;
}
export function red(message) {
    console.error(color(31, message));
}
export function green(message) {
    console.error(color(32, message));
}
export function yellow(message) {
    console.error(color(33, message));
}
export function fail(message, prefix = 'ERROR') {
    red(`${prefix}: ${message}`);
    process.exit(1);
}
export function validateChangeName(name, prefix = 'ERROR') {
    if (!name)
        fail('Change name cannot be empty', prefix);
    if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        red(`${prefix}: Invalid change name: '${name}'`);
        red('Valid characters: a-z, A-Z, 0-9, -, _');
        process.exit(1);
    }
    if (name.includes('..'))
        fail("Change name cannot contain '..' (path traversal not allowed)", prefix);
}
export function validateEnum(value, validValues) {
    if (validValues.includes(value))
        return;
    red(`ERROR: Invalid value: '${value}'`);
    red(`Valid values: ${validValues.join(' ')}`);
    process.exit(1);
}
export function stripInlineComment(value) {
    let out = '';
    let quote = '';
    for (let i = 0; i < value.length; i += 1) {
        const c = value[i];
        if (!quote) {
            if (c === '"' || c === "'")
                quote = c;
            else if (c === '#' && (i === 0 || /\s/.test(value[i - 1])))
                return out.trimEnd();
        }
        else if (c === quote) {
            quote = '';
        }
        out += c;
    }
    return out;
}
export function stripWrappingQuotes(value) {
    if (value.length >= 2) {
        const first = value[0];
        const last = value[value.length - 1];
        if (first === '"' && last === '"') {
            try {
                return JSON.parse(value);
            }
            catch {
                return value.slice(1, -1);
            }
        }
        if (first === "'" && last === "'")
            return value.slice(1, -1);
    }
    return value;
}
export function parseYamlLines(file) {
    const text = readFileSync(file, 'utf8');
    const data = {};
    const keys = [];
    for (const line of text.split(/\r?\n/)) {
        const match = line.match(/^([^\s:#][^:]*):\s*(.*)$/);
        if (!match)
            continue;
        const key = match[1].trim();
        const value = stripWrappingQuotes(stripInlineComment(match[2] ?? ''));
        data[key] = value;
        keys.push(key);
    }
    return { data, keys, text };
}
export function fieldValue(file, field) {
    if (!existsSync(file))
        return '';
    return parseYamlLines(file).data[field] ?? '';
}
function formatYamlValue(value) {
    const stringValue = String(value);
    if (stringValue === '')
        return '';
    if (/^[A-Za-z0-9_./:@\\-]+$/.test(stringValue))
        return stringValue;
    return JSON.stringify(stringValue);
}
export function writeYamlData(file, data) {
    const lines = [];
    for (const key of FIELD_ORDER) {
        if (Object.prototype.hasOwnProperty.call(data, key))
            lines.push(`${key}: ${formatYamlValue(data[key])}`);
    }
    for (const key of Object.keys(data)) {
        if (!FIELD_ORDER.includes(key))
            lines.push(`${key}: ${formatYamlValue(data[key])}`);
    }
    writeFileSync(file, `${lines.join('\n')}\n`);
}
export function setYamlField(file, field, value) {
    const { data } = parseYamlLines(file);
    data[field] = String(value);
    writeYamlData(file, data);
}
export function fileNonempty(file) {
    try {
        return statSync(file).isFile() && statSync(file).size > 0;
    }
    catch {
        return false;
    }
}
export function changeDirFor(changeName) {
    const active = join('openspec', 'changes', changeName);
    const archived = join('openspec', 'changes', 'archive', changeName);
    if (existsSync(active))
        return active;
    if (existsSync(archived))
        return archived;
    return active;
}
export function yamlFileFor(changeName) {
    return join(changeDirFor(changeName), '.comet.yaml');
}
export function today() {
    return new Date().toISOString().slice(0, 10);
}
export function git(args) {
    return spawnSync('git', args, { encoding: 'utf8' });
}
export function currentHeadOrNull() {
    const verify = git(['rev-parse', '--verify', 'HEAD']);
    if (verify.status !== 0)
        return 'null';
    const head = git(['rev-parse', 'HEAD']);
    return head.status === 0 ? head.stdout.trim() : 'null';
}
export function sha256(content) {
    return createHash('sha256').update(content).digest('hex');
}
export function hashFile(file) {
    return sha256(readFileSync(file));
}
export function ensureDir(dir) {
    mkdirSync(dir, { recursive: true });
}
export function runNode(script, args, options = {}) {
    return spawnSync(process.execPath, [script, ...args], {
        encoding: 'utf8',
        stdio: 'pipe',
        ...options,
    });
}
export function runCommandString(command, options = {}) {
    console.error(`+ ${command}`);
    return spawnSync(command, { encoding: 'utf8', stdio: 'inherit', shell: true, ...options });
}
export function runCommand(argv, options = {}) {
    const [command, ...args] = argv;
    return spawnSync(command, args, {
        encoding: 'utf8',
        stdio: 'inherit',
        shell: process.platform === 'win32',
        ...options,
    });
}
export function slash(file) {
    return file.replace(/\\/g, '/');
=======

export const scriptDir = dirname(fileURLToPath(import.meta.url));

export const FIELD_ORDER = [
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

export const KNOWN_KEYS = new Set(FIELD_ORDER);

export function color(code, message) {
  return `\u001b[${code}m${message}\u001b[0m`;
}

export function red(message) {
  console.error(color(31, message));
}

export function green(message) {
  console.error(color(32, message));
}

export function yellow(message) {
  console.error(color(33, message));
}

export function fail(message, prefix = 'ERROR') {
  red(`${prefix}: ${message}`);
  process.exit(1);
}

export function validateChangeName(name, prefix = 'ERROR') {
  if (!name) fail('Change name cannot be empty', prefix);
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    red(`${prefix}: Invalid change name: '${name}'`);
    red('Valid characters: a-z, A-Z, 0-9, -, _');
    process.exit(1);
  }
  if (name.includes('..')) fail("Change name cannot contain '..' (path traversal not allowed)", prefix);
}

export function validateEnum(value, validValues) {
  if (validValues.includes(value)) return;
  red(`ERROR: Invalid value: '${value}'`);
  red(`Valid values: ${validValues.join(' ')}`);
  process.exit(1);
}

export function stripInlineComment(value) {
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

export function stripWrappingQuotes(value) {
  if (value.length >= 2) {
    const first = value[0];
    const last = value[value.length - 1];
    if (first === '"' && last === '"') {
      try {
        return JSON.parse(value);
      } catch {
        return value.slice(1, -1);
      }
    }
    if (first === "'" && last === "'") return value.slice(1, -1);
  }
  return value;
}

export function parseYamlLines(file) {
  const text = readFileSync(file, 'utf8');
  const data = {};
  const keys = [];
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

export function fieldValue(file, field) {
  if (!existsSync(file)) return '';
  return parseYamlLines(file).data[field] ?? '';
}

function formatYamlValue(value) {
  const stringValue = String(value);
  if (stringValue === '') return '';
  if (/^[A-Za-z0-9_./:@\\-]+$/.test(stringValue)) return stringValue;
  return JSON.stringify(stringValue);
}

export function writeYamlData(file, data) {
  const lines = [];
  for (const key of FIELD_ORDER) {
    if (Object.prototype.hasOwnProperty.call(data, key)) lines.push(`${key}: ${formatYamlValue(data[key])}`);
  }
  for (const key of Object.keys(data)) {
    if (!FIELD_ORDER.includes(key)) lines.push(`${key}: ${formatYamlValue(data[key])}`);
  }
  writeFileSync(file, `${lines.join('\n')}\n`);
}

export function setYamlField(file, field, value) {
  const { data } = parseYamlLines(file);
  data[field] = String(value);
  writeYamlData(file, data);
}

export function fileNonempty(file) {
  try {
    return statSync(file).isFile() && statSync(file).size > 0;
  } catch {
    return false;
  }
}

export function changeDirFor(changeName) {
  const active = join('openspec', 'changes', changeName);
  const archived = join('openspec', 'changes', 'archive', changeName);
  if (existsSync(active)) return active;
  if (existsSync(archived)) return archived;
  return active;
}

export function yamlFileFor(changeName) {
  return join(changeDirFor(changeName), '.comet.yaml');
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

export function git(args) {
  return spawnSync('git', args, { encoding: 'utf8' });
}

export function currentHeadOrNull() {
  const verify = git(['rev-parse', '--verify', 'HEAD']);
  if (verify.status !== 0) return 'null';
  const head = git(['rev-parse', 'HEAD']);
  return head.status === 0 ? head.stdout.trim() : 'null';
}

export function sha256(content) {
  return createHash('sha256').update(content).digest('hex');
}

export function hashFile(file) {
  return sha256(readFileSync(file));
}

export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

export function runNode(script, args, options = {}) {
  return spawnSync(process.execPath, [script, ...args], { encoding: 'utf8', stdio: 'pipe', ...options });
}

export function runCommandString(command, options = {}) {
  console.error(`+ ${command}`);
  return spawnSync(command, { encoding: 'utf8', stdio: 'inherit', shell: true, ...options });
}

export function runCommand(argv, options = {}) {
  const [command, ...args] = argv;
  return spawnSync(command, args, { encoding: 'utf8', stdio: 'inherit', shell: process.platform === 'win32', ...options });
}

export function slash(file) {
  return file.replace(/\\/g, '/');
>>>>>>> eeac7a023b8ea6033b2606f7fd7d412881e7c398
}
