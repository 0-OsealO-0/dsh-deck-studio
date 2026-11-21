// Runtime discovery for Deck Studio.
//
// Everything here must stay dependency-free and synchronous: it runs once when
// DSH loads the plugin, and it must never assume a particular user name or
// install location. The plugin ships its own copy of ppt-master under
// vendor/ppt-master, so a fresh machine only needs Python + fonts + Office.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const PLUGIN_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const IS_WIN = process.platform === 'win32';

function isFile(candidate) {
  try {
    return fs.statSync(candidate).isFile();
  } catch {
    return false;
  }
}

function isDir(candidate) {
  try {
    return fs.statSync(candidate).isDirectory();
  } catch {
    return false;
  }
}

function homeDir() {
  return process.env.USERPROFILE || process.env.HOME || os.homedir();
}

function dshHome() {
  return process.env.DSH_HOME || path.join(homeDir(), '.dsh');
}

// `where` can return the Microsoft Store python.exe stub, which opens the
// Store instead of running a script. Treat it as "not installed".
function isStoreStub(candidate) {
  return /[\\/]WindowsApps[\\/]/i.test(candidate);
}

function whereAll(command) {
  if (!IS_WIN) {
    try {
      return execFileSync('which', ['-a', command], { encoding: 'utf8', timeout: 4000 })
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);
    } catch {
      return [];
    }
  }
  try {
    return execFileSync('where.exe', [command], { encoding: 'utf8', timeout: 4000, windowsHide: true })
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

function globDirs(parent, prefix = '') {
  try {
    return fs
      .readdirSync(parent, { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name.startsWith(prefix))
      .map((entry) => path.join(parent, entry.name));
  } catch {
    return [];
  }
}

function mtimeOf(candidate) {
  try {
    return fs.statSync(candidate).mtimeMs;
  } catch {
    return 0;
  }
}

// Real interpreters first, launcher shims last. The returned value is either an
// absolute path (preferred) or a bare command name that spawn() can resolve.
function pythonCandidates() {
  const candidates = [];
  const push = (value) => {
    if (value && !candidates.includes(value)) candidates.push(value);
  };

  for (const envName of ['DSH_DECK_PYTHON', 'DSH_PYTHON', 'PYTHON']) {
    if (process.env[envName]) push(process.env[envName]);
  }

  if (IS_WIN) {
    // DSH's own bundled runtime, newest install first.
    for (const runtimeDir of globDirs(path.join(dshHome(), 'dsh-runtimes'))) {
      const exe = path.join(runtimeDir, 'dependencies', 'python', 'python.exe');
      if (isFile(exe)) push(exe);
    }
    // Conventional per-user and machine-wide Python installs.
    for (const base of [
      path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Python'),
      path.join(process.env.ProgramFiles || '', ''),
      'C:/',
    ]) {
      if (!base) continue;
      for (const dir of globDirs(base, 'Python')) {
        const exe = path.join(dir, 'python.exe');
        if (isFile(exe)) push(exe);
      }
    }
    for (const exe of whereAll('python.exe')) {
      if (!isStoreStub(exe)) push(exe);
    }
    for (const exe of whereAll('python3.exe')) {
      if (!isStoreStub(exe)) push(exe);
    }
    // `py` is only a launcher, so resolve it to the real interpreter once.
    if (whereAll('py.exe').length > 0) {
      try {
        const resolved = execFileSync(
          'py.exe',
          ['-3', '-c', 'import sys; print(sys.executable)'],
          { encoding: 'utf8', timeout: 8000, windowsHide: true },
        ).trim();
        if (resolved && isFile(resolved) && !isStoreStub(resolved)) push(resolved);
      } catch {
        // No usable Python 3 behind the launcher; keep looking.
      }
    }
  } else {
    for (const exe of whereAll('python3')) push(exe);
    for (const exe of whereAll('python')) push(exe);
  }
  return candidates;
}

let pythonCache;
let pythonDepsCache;

function canImportPptx(interpreter) {
  if (!isFile(interpreter)) return false;
  try {
    execFileSync(interpreter, ['-c', 'import pptx'], {
      timeout: 8000,
      windowsHide: true,
      stdio: 'ignore',
    });
    return true;
  } catch {
    return false;
  }
}

export function detectPython() {
  if (pythonCache !== undefined) return pythonCache;
  const candidates = pythonCandidates();
  const installed = candidates.filter((candidate) => isFile(candidate));
  const withDeps = installed.find(canImportPptx);
  pythonCache = withDeps || installed[0] || candidates[0] || (IS_WIN ? 'python.exe' : 'python3');
  pythonDepsCache = Boolean(withDeps);
  return pythonCache;
}

export function pythonHasDeps() {
  detectPython();
  return pythonDepsCache;
}

let visualReviewCache;

// Visual review has two dependencies, not one: visual_review.py needs
// playwright, and it can only render against a live-preview server whose lock
// file sits inside the project. Probe playwright once here so `deck status` can
// warn up front instead of letting check(review=true) look like a success.
export function detectVisualReview() {
  if (visualReviewCache !== undefined) return visualReviewCache;
  let playwright = false;
  try {
    execFileSync(detectPython(), ['-c', 'import playwright.sync_api'], {
      timeout: 8000,
      windowsHide: true,
      stdio: 'ignore',
    });
    playwright = true;
  } catch {
    playwright = false;
  }
  visualReviewCache = { playwright, serverRequired: true };
  return visualReviewCache;
}

let installedFontsCache;

// The bundled templates ask for Source Han Sans SC / Smiley Sans / Glow Sans,
// none of which ship with Windows. Without this probe the first deck on a clean
// machine silently renders in a substitute face and nobody finds out until the
// exported PPTX is opened elsewhere. Lazy + cached: PowerShell costs ~1s and
// most sessions never ask. Returns lowercase family names, or null when the
// probe is unavailable (non-Windows, PS disabled) so callers can skip quietly.
export function installedFontFamilies() {
  if (installedFontsCache !== undefined) return installedFontsCache;
  if (!IS_WIN) {
    installedFontsCache = null;
    return null;
  }
  try {
    // Two traps here, both found the hard way:
    //   1. powershell.exe writes in the console codepage, so CJK family names
    //      arrive mojibake unless OutputEncoding is forced to UTF-8.
    //   2. InstalledFontCollection exposes LOCALIZED names (微软雅黑, 思源黑体),
    //      while spec_lock declares English ones (Microsoft YaHei, Source Han
    //      Sans SC TTF). Ask each family for its en-US name (1033) too and keep
    //      both, otherwise every CJK font looks uninstalled.
    const script =
      '[Console]::OutputEncoding=[Text.Encoding]::UTF8; ' +
      'Add-Type -AssemblyName System.Drawing; ' +
      '(New-Object System.Drawing.Text.InstalledFontCollection).Families | ForEach-Object { ' +
      '$localized = $_.Name; ' +
      'try { $english = $_.GetName(1033) } catch { $english = $localized }; ' +
      '"$localized`t$english" }';
    const stdout = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
      encoding: 'utf8',
      timeout: 20000,
      windowsHide: true,
    });
    const names = new Set();
    for (const line of stdout.split(/\r?\n/)) {
      for (const part of line.split('\t')) {
        const name = part.trim();
        if (name) names.add(name.toLowerCase());
      }
    }
    installedFontsCache = names.size ? names : null;
  } catch {
    installedFontsCache = null;
  }
  return installedFontsCache;
}

function looksLikeSkillRoot(candidate) {
  return Boolean(
    candidate &&
      isDir(candidate) &&
      isFile(path.join(candidate, 'scripts', 'svg_to_pptx.py')) &&
      isFile(path.join(candidate, 'SKILL.md')),
  );
}

// Precedence: explicit override -> bundled copy -> locally installed skill.
export function detectSkillRoot() {
  const candidates = [
    process.env.DSH_DECK_PPT_MASTER_ROOT,
    path.join(PLUGIN_ROOT, 'vendor', 'ppt-master'),
    path.join(homeDir(), '.skills-manager', 'skills', 'ppt-master'),
    path.join(dshHome(), 'skills', 'ppt-master'),
  ];
  const found = candidates.find(looksLikeSkillRoot);
  return found || path.join(PLUGIN_ROOT, 'vendor', 'ppt-master');
}

export function runtimeInfo() {
  const python = detectPython();
  const skillRoot = detectSkillRoot();
  return {
    python,
    pythonFound: isFile(python),
    pythonHasPptxDeps: pythonHasDeps(),
    skillRoot,
    bundledSkill: path.resolve(skillRoot) === path.resolve(path.join(PLUGIN_ROOT, 'vendor', 'ppt-master')),
    bundledSkillFound: looksLikeSkillRoot(path.join(PLUGIN_ROOT, 'vendor', 'ppt-master')),
    visualReview: detectVisualReview(),
  };
}
