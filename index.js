import { spawn } from 'node:child_process';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import z from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import {
  detectBrowser,
  detectPowerPoint,
  detectPython,
  detectSkillRoot,
  installedFontFamilies,
  runtimeInfo,
} from './lib/paths.mjs';
import {
  ARCHETYPE_ORDER,
  PLAN_FILE,
  auditPlan,
  formatViolations,
  missingPlan,
  planMenuText,
  planSkeletonText,
} from './lib/page-contracts.mjs';
import { THEME_IDS, THEMES, TYPE_ROLES, getTheme, themeForProfile, themeMenuText } from './lib/themes.mjs';
import { ARCHETYPE_IDS, renderPage as renderSkeletonPage } from './lib/skeleton.mjs';
import { buildEditorHtml } from './lib/editor.mjs';

const PLUGIN_NAME = 'deck-studio';
const PROVIDER_NAME = 'deck-studio';
const INVOCATION = { modelInvocable: true, userInvocable: true };

// Resolved once at load time: bundled ppt-master first, Python auto-detected.
// Both stay overridable through the plugin Config for unusual installs.
const DEFAULT_PYTHON = detectPython();
const DEFAULT_SKILL_ROOT = detectSkillRoot();
const PROFILES = new Set(['formal', 'campaign', 'literary']);
const FORMATS = new Set(['pptx', 'pdf', 'png', 'all']);
const ACTIONS = new Set(['propose', 'init', 'status', 'brief', 'scaffold', 'edit', 'check', 'export', 'html', 'animate']);

const PROFILE_LABEL = {
  formal: '正式汇报',
  campaign: '活动宣传',
  literary: '文艺分享',
};

const here = path.dirname(fileURLToPath(import.meta.url));

// 三个候选视觉方向：propose 阶段先给用户选，选中的 id 由 init(option=) 落地。
const DIRECTIONS = {
  literary: [
    {
      id: 'warm-paper',
      name: '暖纸留白',
      summary: '燕麦纸底配近墨黑字，一页一行大字，一张实拍照片压在版边满版。',
      colors: { bg: '#F6F0E4', surface: '#EDE3D2', text: '#241F1A', muted: '#7A6E5F', primary: '#A9573B', on_primary: '#FFFFFF', accent: '#A9573B', rule: '#D8CBB8' },
      type: '思源宋体标题 + 思源黑体正文 + 霞鹜文楷引文',
      layout: '140–160px 大边距、发丝线、照片单侧满版',
      motion: '封面与一页高潮各一次淡入，其余不动',
      best_for: '读书分享、散文、个人讲述',
    },
    {
      id: 'ink-water',
      name: '墨蓝静水',
      summary: '纸白底，全部信息压进墨蓝与灰，只用一条细线分节，安静到近乎冷淡。',
      colors: { bg: '#F7F7F4', surface: '#EDEEEA', text: '#1B2430', muted: '#6B7480', primary: '#2E4A8A', on_primary: '#FFFFFF', accent: '#2E4A8A', rule: '#D5D8DB' },
      type: '思源宋体标题 + 思源黑体正文',
      layout: '对称双栏、严格对齐、无照片或仅一张黑白照片',
      motion: '整册不动，只做页面切换',
      best_for: '读后感、课程汇报、需要镇定感的场合',
    },
    {
      id: 'desert-ochre',
      name: '沙漠赭石',
      summary: '沙色底配赭红强调，右侧整列照片，像一本旅行笔记。',
      colors: { bg: '#F4EBDD', surface: '#E8D9C2', text: '#2A241E', muted: '#6F6253', primary: '#A0562F', on_primary: '#FFFFFF', accent: '#A0562F', rule: '#DCCEB8' },
      type: '思源宋体标题 + 思源黑体正文 + 霞鹜文楷引文',
      layout: '右侧 600px 照片列、左文右图、水平发丝线',
      motion: '照片与标题分别淡入，一页高潮分层揭示',
      best_for: '旅行、非虚构、带大量实拍照片的分享',
    },
  ],
  formal: [
    {
      id: 'navy-brief',
      name: '深蓝简报',
      summary: '白底深蓝，一页一个结论，数字放大，其余全部后退。',
      colors: { bg: '#FFFFFF', surface: '#F2F5F9', text: '#14213D', muted: '#5A6473', primary: '#14213D', on_primary: '#FFFFFF', accent: '#2563EB', rule: '#DCE3EC' },
      type: '思源黑体标题 + 思源黑体正文',
      layout: '左上结论、右上数据、下方三条证据',
      motion: '无动画或整页淡入',
      best_for: '汇报、评审、参赛答辩',
    },
    {
      id: 'graphite-orange',
      name: '石墨橙',
      summary: '石墨灰底配高亮橙，结论压在一侧大字，正文收窄成一条。',
      colors: { bg: '#F5F5F3', surface: '#E8E8E4', text: '#1C1C1A', muted: '#63635E', primary: '#1C1C1A', on_primary: '#FFFFFF', accent: '#D97706', rule: '#D3D3CC' },
      type: '思源黑体标题 + 思源黑体正文',
      layout: '左右 6:4 分栏、强调色只给关键数字',
      motion: '关键页数字淡入一次',
      best_for: '数据汇报、进度复盘',
    },
    {
      id: 'paper-stamp',
      name: '纸白红章',
      summary: '米白纸面配一枚红章色，表格与清单为主，克制但有仪式感。',
      colors: { bg: '#FBFAF6', surface: '#F0EDE4', text: '#23211C', muted: '#6E6A5F', primary: '#8C1F1F', on_primary: '#FFFFFF', accent: '#8C1F1F', rule: '#DCD7C9' },
      type: '思源宋体标题 + 思源黑体正文',
      layout: '上标题带、下清单表、页脚页码',
      motion: '无动画',
      best_for: '制度说明、方案对比、总结报告',
    },
  ],
  campaign: [
    {
      id: 'warm-orange',
      name: '高饱和暖橙',
      summary: '大字报式标题压在照片上，行动信息放最大。',
      colors: { bg: '#FFF6EC', surface: '#FFE3C7', text: '#2B1A0E', muted: '#7A5A42', primary: '#E4572E', on_primary: '#FFFFFF', accent: '#E4572E', rule: '#F0D6BA' },
      type: '思源黑体标题（粗）+ 思源黑体正文',
      layout: '满版照片 + 左下大标题 + 右下时间地点',
      motion: '标题与照片各一次快速淡入',
      best_for: '活动招募、晚会宣传',
    },
    {
      id: 'neon-cyan',
      name: '荧光青',
      summary: '深底荧光青，适合屏幕与投影，年轻、有节奏。',
      colors: { bg: '#0E1418', surface: '#18232A', text: '#F2F7F9', muted: '#9DB0BA', primary: '#22D3EE', on_primary: '#0E1418', accent: '#22D3EE', rule: '#27363F' },
      type: '思源黑体标题 + 思源黑体正文',
      layout: '深底、大字、斜切色块',
      motion: '逐条滑入，最多三条',
      best_for: '社团招新、线上直播预告',
    },
    {
      id: 'black-gold',
      name: '黑金',
      summary: '黑底配金线，适合正式活动与颁奖。',
      colors: { bg: '#141210', surface: '#221E1A', text: '#F5EFE4', muted: '#A9998A', primary: '#C8A46A', on_primary: '#141210', accent: '#C8A46A', rule: '#3A332B' },
      type: '思源宋体标题 + 思源黑体正文',
      layout: '居中对称、金色细线、少量留白',
      motion: '整页淡入',
      best_for: '典礼、颁奖、正式通知',
    },
  ],
};

const IGNORABLE_ON_INIT = new Set(['confirm_ui']);
const PROFILE_DIRECTIONS = (profile) => DIRECTIONS[profile] || DIRECTIONS.formal;
const findDirection = (profile, id) => PROFILE_DIRECTIONS(profile).find((d) => d.id === id) || null;

function directionColors(lock, colors) {
  const head = '## colors';
  const start = lock.indexOf(head);
  if (start === -1) return lock;
  const blockStart = start + head.length;
  const nextSection = lock.indexOf('\n## ', blockStart);
  const end = nextSection === -1 ? lock.length : nextSection;
  const block = lock.slice(blockStart, end);
  let patched = block;
  for (const [key, hex] of Object.entries(colors)) {
    const re = new RegExp(`^(\\s*-\\s*${key}\\s*:\\s*)#[0-9A-Fa-f]{6}\\s*$`, 'm');
    if (re.test(patched)) patched = patched.replace(re, `$1${hex}`);
    else patched = `${patched.replace(/\s*$/, '')}\n- ${key}: ${hex}\n`;
  }
  return lock.slice(0, blockStart) + patched + lock.slice(end);
}

function directionNote(direction) {
  return [
    `- design_direction: ${direction.id}（${direction.name}）`,
    `- design_direction_summary: ${direction.summary}`,
    `- design_direction_type: ${direction.type}`,
    `- design_direction_layout: ${direction.layout}`,
  ].join('\n') + '\n';
}


export const Config = z.object({
  python: z.string().default(DEFAULT_PYTHON),
  skillRoot: z.string().default(DEFAULT_SKILL_ROOT),
  defaultProfile: z.string().default('formal'),
  timeoutMs: z.number().default(180000),
});

export const name = PLUGIN_NAME;
export const inject = ['tools', 'skills'];

function normalizeConfig(input = {}) {
  return {
    python: input.python || DEFAULT_PYTHON,
    skillRoot: input.skillRoot || DEFAULT_SKILL_ROOT,
    defaultProfile: PROFILES.has(input.defaultProfile) ? input.defaultProfile : 'formal',
    timeoutMs: Number.isFinite(input.timeoutMs) && input.timeoutMs > 0 ? input.timeoutMs : 180000,
  };
}

function pickProfile(value, fallback = 'formal') {
  return PROFILES.has(value) ? value : fallback;
}

function requireAction(value) {
  if (!ACTIONS.has(value)) {
    throw new Error(`Unknown action "${value}". Use one of: ${[...ACTIONS].join(', ')}.`);
  }
  return value;
}

function projectPath(value) {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error('project 必须是绝对路径。插件工具没有 cwd，不能使用相对路径。');
  }
  if (!path.isAbsolute(value)) {
    throw new Error(`project 必须是绝对路径，收到: ${value}`);
  }
  return path.resolve(value);
}

function slugify(value) {
  const slug = String(value || 'deck')
    .normalize('NFKC')
    .replace(/[\\/:*?"<>|\s]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64);
  return slug || 'deck';
}

function clampText(value, max = 4000) {
  const text = String(value ?? '');
  return text.length > max ? `${text.slice(0, max)}\n… (${text.length - max} chars truncated)` : text;
}

async function exists(file) {
  try {
    await fs.access(file);
    return true;
  } catch {
    return false;
  }
}

async function readText(file) {
  return fs.readFile(file, 'utf8');
}

async function readJson(file) {
  try {
    return JSON.parse(await readText(file));
  } catch {
    return null;
  }
}

async function ensureDir(dir) {
  await fs.mkdir(dir, { recursive: true });
}

async function listSvg(project) {
  const dir = path.join(project, 'svg_output');
  try {
    const names = await fs.readdir(dir);
    return names.filter((item) => item.toLowerCase().endsWith('.svg')).sort();
  } catch {
    return [];
  }
}

async function listDir(dir) {
  try {
    return await fs.readdir(dir);
  } catch {
    return [];
  }
}

// visual_review.py only recovers the preview URL from a project-local lock file,
// and the plugin never passes --server-url. So a missing lock or a dead pid means
// the render can never succeed; check it up front instead of burning a 240s
// python timeout on an exit code nobody reads.
async function livePreviewState(project) {
  for (const lockPath of [
    path.join(project, 'live_preview', 'lock.json'),
    path.join(project, '.live_preview.lock'),
  ]) {
    const lock = await readJson(lockPath);
    const pid = Number(lock?.pid ?? 0);
    if (!pid) continue;
    const state = { pid, port: Number(lock?.port) || null, lockPath };
    try {
      process.kill(pid, 0);
      return { running: true, ...state };
    } catch {
      return { running: false, ...state };
    }
  }
  return { running: false, pid: null, port: null, lockPath: null };
}

async function fileBytes(file) {
  try {
    return (await fs.stat(file)).size;
  } catch {
    return undefined;
  }
}

async function artifact(kind, file) {
  const size = await fileBytes(file);
  return size === undefined ? { kind, path: file } : { kind, path: file, bytes: size };
}

function capAppend(current, chunk, limit = 160000) {
  const next = current + chunk;
  return next.length > limit ? next.slice(0, limit) : next;
}

function runProcess(file, args, options = {}) {
  const {
    cwd,
    timeoutMs = 180000,
    signal,
    env = {},
  } = options;

  return new Promise((resolve, reject) => {
    let child;
    try {
      child = spawn(file, args, {
        cwd,
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, PYTHONUTF8: '1', PYTHONIOENCODING: 'utf-8', ...env },
      });
    } catch (error) {
      reject(error);
      return;
    }

    let stdout = '';
    let stderr = '';
    let settled = false;

    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener?.('abort', onAbort);
      fn(value);
    };

    const timer = setTimeout(() => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      finish(
        reject,
        new Error(`命令超时（${timeoutMs}ms）：${path.basename(file)} ${args.join(' ')}`),
      );
    }, timeoutMs);

    const onAbort = () => {
      try {
        child.kill('SIGKILL');
      } catch {
        // ignore
      }
      finish(reject, new Error('命令已取消。'));
    };

    if (signal) {
      if (signal.aborted) {
        onAbort();
        return;
      }
      signal.addEventListener('abort', onAbort, { once: true });
    }

    child.stdout?.on('data', (chunk) => {
      stdout = capAppend(stdout, String(chunk));
    });
    child.stderr?.on('data', (chunk) => {
      stderr = capAppend(stderr, String(chunk));
    });
    child.on('error', (error) => {
      if (error && error.code === 'ENOENT') {
        error.message = `无法启动进程 ${file}：${error.message}\n请安装 Python 3，或在插件 Config 的 python 字段设置绝对路径。`;
      }
      finish(reject, error);
    });
    child.on('close', (code) => {
      finish(resolve, { code: code ?? -1, stdout, stderr });
    });
  });
}

async function runPython(config, script, args, options = {}) {
  const python = config.python;
  const isCommandName = !path.isAbsolute(python) && !python.includes('/') && !python.includes('\\');
  if (!isCommandName && !(await exists(python))) {
    throw new Error(
      `找不到 Python：${python}\n` +
        '请安装 Python 3，或在插件 Config 的 python 字段填入 python.exe 的绝对路径；也可设置环境变量 DSH_DECK_PYTHON。',
    );
  }
  if (!(await exists(script))) {
    throw new Error(
      `找不到脚本：${script}\n` +
        '插件自带 vendor/ppt-master 缺失或损坏时会出现此错误。可重新解压插件包，或在 Config 的 skillRoot 字段指向本机已安装的 ppt-master。',
    );
  }
  const result = await runProcess(config.python, [script, ...args], {
    timeoutMs: config.timeoutMs,
    ...options,
  });
  if (result.code !== 0 && /No module named|ModuleNotFoundError/i.test(result.stderr)) {
    result.stderr = `${result.stderr}\n[deck-studio] 当前 Python 缺少依赖。请运行：\n  "${config.python}" -m pip install python-pptx lxml Pillow\n或把插件 Config 的 python 字段指向已装好 ppt-master 依赖的解释器。`;
  }
  return result;
}

async function runPowerShell(config, script, args, options = {}) {
  if (!(await exists(script))) {
    throw new Error(`找不到 PowerShell 脚本：${script}`);
  }
  const shell = 'powershell.exe';
  return runProcess(
    shell,
    ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, ...args],
    { timeoutMs: config.timeoutMs, ...options },
  );
}

function tail(result) {
  return {
    code: result.code,
    stdout: clampText(result.stdout, 6000),
    stderr: clampText(result.stderr, 6000),
  };
}

function failed(result, label) {
  const detail = [result.stderr, result.stdout].filter(Boolean).join('\n').trim();
  return new Error(`${label}失败（exit ${result.code}）。${detail ? `\n${clampText(detail, 3000)}` : ''}`);
}

async function runQuality(config, project, signal) {
  const script = path.join(config.skillRoot, 'scripts', 'svg_quality_checker.py');
  const result = await runPython(config, script, [project, '--stage', 'final', '--json'], {
    cwd: project,
    signal,
  });
  const reportPath = path.join(project, 'validation', 'svg_quality_report.json');
  return {
    ...result,
    reportPath,
    report: await readJson(reportPath),
  };
}

const TYPOGRAPHY_SIZE_RE = /^\s*[-*]\s*([A-Za-z][\w \-]*?)\s*[:：]\s*(\d+(?:\.\d+)?)\s*$/;
const FONT_SIZE_ATTR_RE = /font-size\s*=\s*["']?\s*(\d+(?:\.\d+)?)/g;
const IMAGE_HREF_RE = /<image\b[^>]*?href\s*=\s*["']([^"']+)["']/g;

function declaredSizesFromLock(lockText) {
  const sizes = new Map();
  let insideTypography = false;
  for (const rawLine of String(lockText || '').split(/\r?\n/)) {
    const heading = rawLine.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      insideTypography = /typography/i.test(heading[1]);
      continue;
    }
    if (!insideTypography) continue;
    const match = rawLine.match(TYPOGRAPHY_SIZE_RE);
    if (match) sizes.set(match[1].trim(), Number(match[2]));
  }
  return sizes;
}

// The bundled spec_lock templates declare families (Source Han Sans SC TTF,
// Smiley Sans Oblique, Glow Sans SC) that are not stock Windows fonts, so a
// clean machine silently substitutes them. The quality gate only warns, and
// our own audit used to read sizes only — nobody noticed until the PPTX was
// opened elsewhere. Compare against what is actually installed.
const GENERIC_FAMILIES = new Set([
  'sans-serif',
  'serif',
  'monospace',
  'system-ui',
  'cursive',
  'fantasy',
  'ui-sans-serif',
  'ui-serif',
  'ui-monospace',
  '-apple-system',
  'emoji',
  'math',
]);
const FAMILY_LINE_RE = /^\s*[-*]\s*([A-Za-z][\w \-]*?)\s*[:：]\s*(.+?)\s*$/;

function declaredFamiliesFromLock(lockText) {
  const families = new Set();
  let insideTypography = false;
  for (const rawLine of String(lockText || '').split(/\r?\n/)) {
    const heading = rawLine.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      insideTypography = /typography/i.test(heading[1]);
      continue;
    }
    if (!insideTypography) continue;
    const match = rawLine.match(FAMILY_LINE_RE);
    if (!match || !/family/i.test(match[1])) continue;
    for (const part of match[2].split(',')) {
      const name = part.trim().replace(/^["']|["']$/g, '');
      if (name && !GENERIC_FAMILIES.has(name.toLowerCase())) families.add(name);
    }
  }
  return families;
}

function usedSizesFromSvg(svgText) {
  const counts = new Map();
  let match;
  FONT_SIZE_ATTR_RE.lastIndex = 0;
  while ((match = FONT_SIZE_ATTR_RE.exec(svgText)) !== null) {
    const value = Number(match[1]);
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return counts;
}

async function auditProject(project) {
  const notes = [];
  const warnings = [];

  const lockPath = path.join(project, 'spec_lock.md');
  const lockText = (await exists(lockPath)) ? await readText(lockPath) : '';
  const declared = declaredSizesFromLock(lockText);

  const svgFiles = await listSvg(project);
  const used = new Map();
  const imageHrefs = new Map();
  for (const file of svgFiles) {
    // listSvg returns bare file names; resolve them against svg_output/
    // explicitly. `readText(name)` used to resolve against the host process
    // cwd, so this loop threw ENOENT on the first page for every project.
    const text = await readText(path.join(project, 'svg_output', file));
    for (const [size, count] of usedSizesFromSvg(text)) {
      used.set(size, (used.get(size) || 0) + count);
    }
    let match;
    IMAGE_HREF_RE.lastIndex = 0;
    while ((match = IMAGE_HREF_RE.exec(text)) !== null) {
      const href = match[1];
      if (!imageHrefs.has(href)) imageHrefs.set(href, []);
      imageHrefs.get(href).push(path.basename(file));
    }
  }

  const declaredValues = new Set(declared.values());
  if (declared.size === 0) {
    warnings.push('spec_lock.md 的 typography 里没有 `- 角色: 数值` 形式的字号锚点，字号检查会静默跳过。');
  }
  const undeclared = [...used.entries()]
    .filter(([size]) => !declaredValues.has(size))
    .sort((a, b) => b[1] - a[1]);
  if (undeclared.length) {
    notes.push({
      kind: 'font-size-undeclared',
      detail: undeclared.map(([size, count]) => `${size}px × ${count}`),
    });
    for (const [size, count] of undeclared) {
      if (count > 2 && declared.size > 0) {
        warnings.push(`字号 ${size}px 出现 ${count} 次但未在 typography 登记；到第 3 次起该尺寸就算一个角色，补一行 \`- 角色名: ${size}\`。`);
      }
    }
  }

  const manifestPath = path.join(project, 'images', 'image_sources.json');
  const manifest = (await exists(manifestPath)) ? await readJson(manifestPath) : null;
  const manifestFiles = new Set((manifest?.items ?? []).map((item) => String(item?.filename ?? '')));
  for (const [href, pages] of imageHrefs) {
    const base = path.basename(href.split('?')[0]);
    const imagePath = path.resolve(project, 'svg_output', href);
    if (!(await exists(imagePath))) {
      warnings.push(`图片缺失：${href}（${[...new Set(pages)].join(', ')}）；路径以 svg_output/ 为基准。`);
      continue;
    }
    const bytes = Number(await fileBytes(imagePath));
    if (bytes < 2048) {
      warnings.push(`图片只有 ${bytes}B，像是下载失败的占位：${href}。`);
    }
    if (manifest && !manifestFiles.has(base)) {
      warnings.push(
        `图片 ${base} 没有登记到 images/image_sources.json，质量门查不到授权与署名。` +
          `（格式是 {"items":[{"filename":"${base}","source":"…","license":"…"}]}，文件名不带 images/ 前缀）`,
      );
    }
  }
  if (imageHrefs.size > 0 && !manifest) {
    warnings.push(
      '用了外部图片但没有 images/image_sources.json；授权、署名和 §7 页面署名契约都无从校验。' +
        '新建它，写成 {"items":[{"filename":"photo.jpg","source":"活动拍摄","license":"CC BY 4.0"}]}。',
    );
  }

  const declaredFamilies = declaredFamiliesFromLock(lockText);
  if (declaredFamilies.size > 0) {
    const installed = installedFontFamilies();
    if (!installed) {
      warnings.push('无法枚举本机已装字体，字体可用性没有校验。');
    } else {
      const missing = [...declaredFamilies].filter((family) => !installed.has(family.toLowerCase()));
      if (missing.length) {
        notes.push({ kind: 'font-not-installed', detail: missing });
        warnings.push(
          `本机没装 spec_lock 声明的字体：${missing.join('、')}。` +
            '预览和导出现在用的是替代字体，换一台机器会更明显地走样。',
        );
      }
    }
  }

  return { notes, warnings, declared: [...declared.entries()], used: [...used.entries()] };
}

const DESIGN_PROFILE_RE = /^\s*[-*]\s*profile\s*[:：]\s*([A-Za-z]+)\s*$/im;

// The profile is recorded in design_spec.md by init. A project without one is
// treated as formal rather than rejected: the contract table only covers formal
// in 0.2.0, and an unknown profile must not turn a green check red.
async function projectProfile(project, fallback) {
  const specPath = path.join(project, 'design_spec.md');
  if (await exists(specPath)) {
    const match = (await readText(specPath)).match(DESIGN_PROFILE_RE);
    const found = match?.[1]?.toLowerCase();
    if (found && PROFILES.has(found)) return found;
  }
  const given = String(fallback ?? '').toLowerCase();
  return PROFILES.has(given) ? given : 'formal';
}

async function readPagePlan(project) {
  const planPath = path.join(project, PLAN_FILE);
  if (!(await exists(planPath))) return { path: planPath, present: false, plan: null, error: '' };
  const raw = await readText(planPath);
  try {
    return { path: planPath, present: true, plan: JSON.parse(raw), error: '' };
  } catch (error) {
    return { path: planPath, present: true, plan: null, error: String(error?.message || error) };
  }
}

// Image slots name a file under images/; the contract audit only warns when the
// file is absent (a page can be written before its photo is shot), but the
// scaffold refuses to bake a broken href into an SVG.
async function projectImages(project) {
  const dir = path.join(project, 'images');
  if (!(await exists(dir))) return [];
  const out = [];
  const walk = async (base, prefix) => {
    for (const entry of await fs.readdir(base, { withFileTypes: true })) {
      if (entry.name.startsWith('.')) continue;
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await walk(path.join(base, entry.name), rel);
        continue;
      }
      if (/\.(?:png|jpe?g|webp|gif|bmp|tif?f|svg)$/i.test(entry.name)) out.push(`images/${rel}`);
    }
  };
  await walk(dir, '');
  return out;
}

// A broken page_plan.json is reported as a shape violation, never thrown: one
// malformed plan must not make the whole check unusable.
async function pagePlanAudit(project, { profile, svgFiles }) {
  const read = await readPagePlan(project);
  if (!read.present) return { ...missingPlan(svgFiles), path: read.path, plan: null, error: '' };
  if (read.error) {
    return {
      present: true,
      valid: false,
      path: read.path,
      plan: null,
      error: read.error,
      violations: [
        { file: PLAN_FILE, slot: '', kind: 'shape', message: `${PLAN_FILE} 不是合法 JSON：${read.error}` },
      ],
      warnings: [],
      usage: [],
      counts: { pages: 0, violations: 1, warnings: 0 },
    };
  }
  const images = await projectImages(project);
  return { ...auditPlan(read.plan, { svgFiles, profile, images }), path: read.path, plan: read.plan, error: '' };
}

// ---------------------------------------------------------------- scaffold
// The skeleton emits a compact type ladder; spec_lock ships only five roles.
// Register what the pages actually draw, otherwise the "third use of an
// unregistered size" audit flags every generated deck on its first check.
const LOCK_ROLE_NAME = { pageNumber: 'page_number' };
const LOCK_THEME_RE = /^\s*[-*]\s*theme\s*[:：]\s*([a-z0-9-]+)\s*$/im;

async function lockThemeId(project) {
  const lockPath = path.join(project, 'spec_lock.md');
  if (!(await exists(lockPath))) return null;
  const match = (await readText(lockPath)).match(LOCK_THEME_RE);
  return match ? match[1].toLowerCase() : null;
}

async function ensureLockRoles(project, theme) {
  const lockPath = path.join(project, 'spec_lock.md');
  if (!(await exists(lockPath))) return { patched: false, added: [], updated: [] };
  let lock = await readText(lockPath);
  const added = [];
  const updated = [];
  // A role the lock already names but at the old size would leave the page
  // using an unregistered size (the gate counts the third use as a new role),
  // so the scaffold syncs the value instead of only filling gaps.
  for (const [role, size] of Object.entries(theme.type)) {
    const name = LOCK_ROLE_NAME[role] ?? role;
    const line = new RegExp(`^(\\s*[-*]\\s*${escapeRegExp(name)}\\s*[:：]\\s*)(\\d+)(\\s*)$`, 'mi');
    if (line.test(lock)) {
      const current = Number(lock.match(line)[2]);
      if (current !== size) {
        lock = lock.replace(line, (_, head) => `${head}${size}`);
        updated.push(`${name}: ${current} → ${size}`);
      }
    } else {
      added.push([name, size]);
    }
  }
  if (!added.length && !updated.length) return { patched: false, added: [], updated: [] };
  if (added.length) {
    const lines = added.map(([name, size]) => `- ${name}: ${size}`).join('\n');
    const heading = /^##\s*typography\s*$/im;
    lock = heading.test(lock)
      ? lock.replace(heading, (match) => `${match}\n${lines}`)
      : `${lock.replace(/\s*$/, '')}\n\n## typography\n${lines}\n`;
  }
  await fs.writeFile(lockPath, lock, 'utf8');
  return { patched: true, added: added.map(([name]) => name), updated };
}

async function reportTheme(project) {
  // Re-running scaffold without a theme must not silently repaint a deck that
  // was generated in another language; the last run's report is the record of
  // what this project actually looks like.
  const report = await readJson(path.join(project, 'validation', 'skeleton_report.json'));
  return typeof report?.theme === 'string' ? report.theme : null;
}

function resolveTheme(args, plan, lockTheme, profile, previousTheme) {
  const wanted = String(args.theme ?? plan.theme ?? lockTheme ?? previousTheme ?? '').toLowerCase();
  if (wanted) {
    const theme = getTheme(wanted);
    if (!theme) throw new Error(`没有「${wanted}」这个视觉语言；可用：\n${themeMenuText()}`);
    return theme;
  }
  return themeForProfile(profile);
}

async function actionScaffold(config, project, args) {
  const read = await readPagePlan(project);
  if (!read.present) {
    throw new Error(`还没有 ${PLAN_FILE}；先 deck(action="brief") 拿原型菜单与槽位预算，写 ${PLAN_FILE} 再 scaffold。`);
  }
  if (read.error) throw new Error(`${PLAN_FILE} 不是合法 JSON：${read.error}`);
  const profile = await projectProfile(project, args.profile ?? config.defaultProfile);
  const images = await projectImages(project);
  const audit = auditPlan(read.plan, { svgFiles: [], profile, images });
  const hard = audit.violations.filter((item) => item.kind !== 'over' && item.kind !== 'vague');
  if (hard.length > 0) {
    throw new Error(
      `${PLAN_FILE} 还不能生成页面（${hard.length} 处）：\n${formatViolations(hard, 8)}\n先改契约，再 scaffold。`,
    );
  }
  const pages = Array.isArray(read.plan.pages) ? read.plan.pages : [];
  if (pages.length === 0) throw new Error(`${PLAN_FILE} 的 pages 是空的。`);

  const theme = resolveTheme(args, read.plan, await lockThemeId(project), profile, await reportTheme(project));
  const dir = path.join(project, 'svg_output');
  await ensureDir(dir);

  const written = [];
  const skipped = [];
  for (const [index, page] of pages.entries()) {
    const file = String(page.file ?? '').trim();
    if (!file) continue;
    const variant = page.variant === 'density' ? 'density' : 'impact';
    const target = path.join(dir, file);
    if (!args.force && (await exists(target))) {
      skipped.push(file);
      continue;
    }
    const svg = renderSkeletonPage(
      { archetype: page.archetype, variant, text: page.text ?? {} },
      { theme, pageNumber: index + 1, total: pages.length },
    );
    const header = `<!-- deck-scaffold theme="${theme.id}" archetype="${page.archetype}" variant="${variant}" -->\n`;
    await fs.writeFile(target, `${header}${svg}\n`, 'utf8');
    written.push({ file, archetype: page.archetype, variant, bytes: Buffer.byteLength(`${header}${svg}`) });
  }

  const patch = written.length > 0 ? await ensureLockRoles(project, theme) : { patched: false, added: [], updated: [] };
  const reportPath = path.join(project, 'validation', 'skeleton_report.json');
  await ensureDir(path.dirname(reportPath));
  const report = {
    schema: 'deck-skeleton/1',
    theme: theme.id,
    themeLabel: theme.label,
    profile,
    pages: written.map((page) => ({ file: page.file, archetype: page.archetype, variant: page.variant })),
    skipped,
    lockRolesAdded: patch.added,
    lockRolesUpdated: patch.updated,
    generatedAt: new Date().toISOString(),
  };
  await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

  const parts = [];
  const askedTheme = String(args.theme ?? '').toLowerCase();
  if (askedTheme && read.plan.theme && askedTheme !== String(read.plan.theme).toLowerCase()) {
    parts.push(`注意：page_plan.json 写的是 theme="${read.plan.theme}"，这次按参数用了 "${askedTheme}"；下次不传 theme 会回到契约里的那套。`);
  }
  parts.push(`已用「${theme.label}」（${theme.id}）生成 ${written.length} 页：${written.map((p) => p.file).join('、') || '（无）'}。`);
  if (skipped.length > 0) {
    parts.push(`跳过已存在的 ${skipped.length} 页：${skipped.join('、')}（要重画就 force=true，会覆盖手改内容）。`);
  }
  const mediaWarnings = audit.warnings.filter((line) => line.includes('不在 images/'));
  if (mediaWarnings.length) parts.push(`配图提醒：\n${mediaWarnings.map((line) => `· ${line}`).join('\n')}`);
  if (patch.added.length) parts.push(`spec_lock 的 typography 补了 ${patch.added.length} 个角色：${patch.added.join('、')}。`);
  if (patch.updated.length) parts.push(`spec_lock 的 typography 对齐了 ${patch.updated.length} 个字号：${patch.updated.join('、')}。`);
  if (skipped.length === 0 && patch.patched) parts.push('下一步 deck(action="check") 跑质量门；要改字就改 page_plan.json 再 scaffold force=true。');
  else if (skipped.length === 0) parts.push('下一步 deck(action="check") 跑质量门。');
  parts.push(`主题列表：\n${themeMenuText()}`);

  const artifacts = [await artifact('skeleton-report', reportPath)];
  for (const page of written.slice(0, 8)) artifacts.push(await artifact('svg-page', path.join(dir, page.file)));

  return {
    ok: true,
    action: 'scaffold',
    project,
    message: parts.join('\n'),
    artifacts,
    data: {
      theme: theme.id,
      themeLabel: theme.label,
      profile,
      written,
      skipped,
      patchedRoles: patch.added,
      updatedRoles: patch.updated,
      reportPath,
      themes: THEME_IDS,
      archetypes: ARCHETYPE_IDS,
    },
  };
}

function qualityDigest(report) {  const digest = { counts: { errors: 0, warnings: 0 }, errors: [], warnings: [] };
  if (!report || typeof report !== 'object') return digest;
  const blocking = report?.categories?.blocking;
  if (blocking && Array.isArray(blocking.issues)) {
    for (const issue of blocking.issues) {
      const line = `${issue?.file ? `${issue.file}: ` : ''}${issue?.message ?? ''}`.trim();
      if (line) digest.errors.push(line);
    }
  }
  const files = Array.isArray(report.files) ? report.files : [];
  for (const file of files) {
    for (const warning of file?.warnings ?? []) digest.warnings.push(`${file.file}: ${warning}`);
    for (const error of file?.errors ?? []) {
      const line = `${file.file}: ${error}`;
      if (!digest.errors.includes(line)) digest.errors.push(line);
    }
  }
  const summary = report.summary ?? {};
  digest.counts.errors = digest.errors.length || Number(summary.errors ?? 0);
  digest.counts.warnings = digest.warnings.length || Number(summary.warnings ?? 0);
  return digest;
}

// vendor/ppt-master is vendored verbatim (MIT), so we do not patch its error
// messages. Instead: our reports showed the same five failures over and over,
// each with a fix that is not obvious from the message. Map message → fix.
const FIX_HINTS = [
  {
    match: /non-PPT-safe typeface/i,
    hint:
      'font-family 里出现中文族名或非 PPT 安全字体：换成英文族名（Microsoft YaHei / SimSun / Arial）。' +
      '导出后 fix-pptx-cjk-fonts.py 会按 spec_lock 补 a:ea，中文不会掉字。',
  },
  {
    match: /unknown data-pptx-role/i,
    hint:
      'data-pptx-role 只接受 background / chrome / decoration / footer / header / logo / page-number / watermark ' +
      '八个结构角色；标题文字不需要这个属性，删掉即可。',
  },
  {
    match: /unsupported or unresolved geometry|Cannot verify root viewBox bounds/i,
    hint:
      '文字几何算不出来：tspan 一旦自带 y 或 dy 就必须同时带 x，坐标与 letter-spacing 也不能用百分比。' +
      '给每行补 x，或拆成各自带 x 的 <text>。',
  },
  {
    match: /without explicit data-pptx-bounds/i,
    hint: '根级 <g> 要显式写 data-pptx-bounds="x y w h"，否则导出后位置会漂。',
  },
  {
    match: /ungrouped top-level Slide-local element/i,
    hint:
      '顶层散元素要包进带 id 的 <g>；静态页框（底色、页脚、页码）声明 data-pptx-role 之后，' +
      '导出器才会把它转成背景/装饰层。',
  },
  {
    match: /本机没装 spec_lock 声明的字体/i,
    hint:
      '把 spec_lock 的 font_family 换成本机已有的字体栈（Microsoft YaHei / SimSun / Arial），' +
      '或先装上这三款；否则预览看着正常、换台机器就换字。',
  },
];

function fixHintFor(line) {
  const text = String(line || '');
  for (const entry of FIX_HINTS) {
    if (entry.match.test(text)) return entry.hint;
  }
  return '';
}

function hintsFor(lines) {
  const hints = [];
  for (const line of lines) {
    const hint = fixHintFor(line);
    if (hint && !hints.includes(hint)) hints.push(hint);
  }
  return hints;
}

async function runVisualReview(config, project, signal) {
  const script = path.join(config.skillRoot, 'scripts', 'visual_review.py');
  const result = await runPython(config, script, [project], {
    cwd: project,
    signal,
    timeoutMs: Math.max(config.timeoutMs, 240000),
  });
  const previewDir = path.join(project, '.preview');
  const previews = (await listDir(previewDir))
    .filter((item) => item.toLowerCase().endsWith('.png'))
    .sort()
    .map((item) => path.join(previewDir, item));
  return { ...result, previews };
}

async function runAnimate(config, project, args, profile, signal) {
  const script = path.join(here, 'scripts', 'animate-deck.ps1');
  const psArgs = [
    '-Project',
    project,
    '-Profile',
    profile,
    '-SkillRoot',
    config.skillRoot,
    '-Python',
    config.python,
    args.apply ? '-Apply' : '-DryRun',
  ];
  if (args.force) psArgs.push('-Force');
  if (Array.isArray(args.advanced) && args.advanced.length > 0) {
    psArgs.push('-Advanced', args.advanced.join(','));
  }
  return runPowerShell(config, script, psArgs, { cwd: project, signal });
}

async function readSourceTitle(project) {
  try {
    const text = await readText(path.join(project, 'source.md'));
    const match = text.match(/^#\s+(.+)$/m);
    return match?.[1]?.trim() || '';
  } catch {
    return '';
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function svgAspect(svg) {
  const viewBox = svg.match(/\bviewBox\s*=\s*["']\s*([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)[\s,]+([-\d.]+)\s*["']/i);
  if (viewBox) {
    const width = Number(viewBox[3]);
    const height = Number(viewBox[4]);
    if (width > 0 && height > 0) return width / height;
  }
  const w = svg.match(/\bwidth\s*=\s*["']([\d.]+)/i);
  const h = svg.match(/\bheight\s*=\s*["']([\d.]+)/i);
  if (w && h && Number(w[1]) > 0 && Number(h[1]) > 0) return Number(w[1]) / Number(h[1]);
  return 16 / 9;
}

function stripSvg(svg) {
  return String(svg)
    .replace(/<\?xml[^>]*\?>/gi, '')
    .replace(/<!DOCTYPE[\s\S]*?>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/\son[a-z]+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son[a-z]+\s*=\s*'[^']*'/gi, '')
    .trim();
}

function scopeSvgIds(svg, prefix) {
  const ids = [...svg.matchAll(/\bid\s*=\s*"([^"]+)"/g)].map((match) => match[1]);
  let out = svg;
  for (const id of ids) {
    const escaped = escapeRegExp(id);
    out = out.replace(new RegExp(`\\bid\\s*=\\s*"${escaped}"`, 'g'), `id="${prefix}${id}"`);
    out = out.replace(new RegExp(`url\\(\\s*#${escaped}\\s*\\)`, 'g'), `url(#${prefix}${id})`);
    out = out.replace(new RegExp(`(href|xlink:href)\\s*=\\s*"#${escaped}"`, 'g'), `$1="#${prefix}${id}"`);
  }
  return out;
}

async function inlineImages(svg, project) {
  const warnings = [];
  const re = /(<image\b[^>]*?\b(?:href|xlink:href)\s*=\s*["'])([^"']+)(["'])/gi;
  const matches = [...svg.matchAll(re)];
  let out = svg;
  for (const match of matches) {
    const raw = match[2];
    if (/^(data:|https?:|#)/i.test(raw)) continue;
    const candidates = [
      path.resolve(project, raw),
      path.resolve(project, 'svg_output', raw),
      path.resolve(project, 'assets', path.basename(raw)),
    ];
    let file = null;
    for (const candidate of candidates) {
      if (await exists(candidate)) {
        file = candidate;
        break;
      }
    }
    if (!file) {
      warnings.push(`图片找不到，保留原路径：${raw}`);
      continue;
    }
    const ext = path.extname(file).toLowerCase();
    const mime =
      ext === '.png'
        ? 'image/png'
        : ext === '.jpg' || ext === '.jpeg'
          ? 'image/jpeg'
          : ext === '.webp'
            ? 'image/webp'
            : ext === '.gif'
              ? 'image/gif'
              : ext === '.svg'
                ? 'image/svg+xml'
                : '';
    if (!mime) {
      warnings.push(`未知图片类型，保留原路径：${raw}`);
      continue;
    }
    const bytes = await fs.readFile(file);
    out = out.replace(match[0], `${match[1]}data:${mime};base64,${bytes.toString('base64')}${match[3]}`);
  }
  return { content: out, warnings };
}

async function buildHtml(title, svgs, project) {
  const aria = escapeHtml(title);
  const aspect = svgAspect(svgs[0]?.content || '');
  const warnings = [];
  const slides = [];
  for (let index = 0; index < svgs.length; index += 1) {
    const item = svgs[index];
    const inlined = await inlineImages(item.content, project);
    warnings.push(...inlined.warnings);
    const content = scopeSvgIds(stripSvg(inlined.content), `s${String(index + 1).padStart(2, '0')}-`);
    slides.push(
      `<section class="slide" data-title="${escapeHtml(item.name)}" aria-label="${escapeHtml(item.name)}">\n${content}\n</section>`,
    );
  }
  const body = slides.join('\n');

  const html = `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<title>${escapeHtml(title)}</title>
<style>
  :root { --ar: ${aspect.toFixed(6)}; --bg: #101318; --ink: #f5f1e8; --muted: #9aa4b2; --accent: #c23b2a; }
  * { box-sizing: border-box; }
  html, body { margin: 0; height: 100%; background: var(--bg); color: var(--ink); }
  body { overflow: hidden; font-family: "Source Han Sans SC TTF", "Microsoft YaHei", sans-serif; }
  #deck { position: relative; width: 100vw; height: 100vh; }
  .slide { position: absolute; inset: 0; display: none; align-items: center; justify-content: center; }
  .slide.active { display: flex; }
  .slide svg { width: min(100vw, calc(100vh * var(--ar))); height: auto; max-height: 100vh; display: block; }
  #hud { position: fixed; top: 18px; right: 22px; display: flex; gap: 12px; align-items: center; font-size: 12px; letter-spacing: .08em; color: var(--muted); z-index: 10; pointer-events: none; }
  #hud b { color: var(--ink); font-weight: 500; }
  #hint { position: fixed; left: 22px; bottom: 18px; font-size: 12px; color: var(--muted); z-index: 10; pointer-events: none; }
  #bar { position: fixed; left: 0; right: 0; bottom: 0; height: 2px; background: rgba(255,255,255,.08); z-index: 10; }
  #bar i { display: block; height: 100%; width: 0; background: var(--accent); transition: width .18s ease; }
  #help { position: fixed; inset: 0; display: none; place-items: center; background: rgba(8,10,14,.88); z-index: 20; }
  #help.open { display: grid; }
  #help .card { width: min(560px, calc(100vw - 48px)); border: 1px solid rgba(255,255,255,.18); padding: 28px 32px; background: #171b22; }
  #help h2 { margin: 0 0 14px; font-size: 18px; font-weight: 600; }
  #help p, #help li { color: var(--muted); font-size: 13px; line-height: 1.8; }
  #help kbd { border: 1px solid rgba(255,255,255,.25); border-bottom-width: 2px; padding: 1px 6px; color: var(--ink); font: inherit; }
  @media print {
    body { overflow: visible; background: #fff; }
    #hud, #hint, #bar, #help { display: none !important; }
    .slide { display: block !important; position: relative; width: 100%; height: auto; page-break-after: always; }
    .slide svg { width: 100%; height: auto; max-height: none; }
  }
</style>
</head>
<body>
<div id="deck">
${slides}
</div>
<div id="hud"><b id="counter">1 / ${svgs.length}</b><span>${aria}</span></div>
<div id="hint">← → 翻页 · F 全屏 · ? 帮助</div>
<div id="bar"><i></i></div>
<div id="help">
  <div class="card">
    <h2>键盘</h2>
    <p><kbd>→</kbd> / <kbd>Space</kbd> 下一页　<kbd>←</kbd> 上一页　<kbd>Home</kbd> 首页　<kbd>End</kbd> 末页</p>
    <p><kbd>F</kbd> 全屏　<kbd>?</kbd> 关闭帮助　<kbd>Esc</kbd> 退出全屏 / 关闭</p>
    <p>点击画面右半页前进，左半页后退。打印时每页一张，适合导出 PDF。</p>
  </div>
</div>
<script>
(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const counter = document.getElementById('counter');
  const bar = document.querySelector('#bar i');
  const help = document.getElementById('help');
  let index = 0;
  const clamp = (n) => Math.max(0, Math.min(slides.length - 1, n));
  function show(n, updateHash = true) {
    index = clamp(n);
    slides.forEach((slide, i) => slide.classList.toggle('active', i === index));
    counter.textContent = (index + 1) + ' / ' + slides.length;
    bar.style.width = ((index + 1) / slides.length * 100).toFixed(2) + '%';
    if (updateHash) {
      try { history.replaceState(null, '', '#' + (index + 1)); }
      catch { location.hash = String(index + 1); }
    }
  }
  function next() { show(index + 1); }
  function prev() { show(index - 1); }
  function toggleHelp(force) {
    const open = force === undefined ? !help.classList.contains('open') : force;
    help.classList.toggle('open', open);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown' || event.key === 'PageDown' || event.key === ' ') {
      event.preventDefault(); next();
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp' || event.key === 'PageUp') {
      event.preventDefault(); prev();
    } else if (event.key === 'Home') {
      event.preventDefault(); show(0);
    } else if (event.key === 'End') {
      event.preventDefault(); show(slides.length - 1);
    } else if (event.key === '?') {
      event.preventDefault(); toggleHelp();
    } else if (event.key === 'Escape') {
      toggleHelp(false);
      if (document.fullscreenElement) document.exitFullscreen();
    } else if (event.key === 'f' || event.key === 'F') {
      event.preventDefault();
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.();
    }
  });
  document.getElementById('deck').addEventListener('click', (event) => {
    if (event.target.closest('a, button, input, textarea, select')) return;
    if (event.clientX < window.innerWidth / 2) prev(); else next();
  });
  let touchX = null;
  document.addEventListener('touchstart', (event) => { touchX = event.touches[0]?.clientX ?? null; }, { passive: true });
  document.addEventListener('touchend', (event) => {
    if (touchX === null) return;
    const endX = event.changedTouches[0]?.clientX ?? touchX;
    if (Math.abs(endX - touchX) > 40) { endX < touchX ? next() : prev(); }
    touchX = null;
  }, { passive: true });
  const fromHash = Number(location.hash.replace('#', ''));
  show(Number.isFinite(fromHash) && fromHash > 0 ? fromHash - 1 : 0, false);
})();
</script>
</body>
</html>
`;
  return { html, warnings };
}

async function actionPropose(config, project, args) {
  const profile = pickProfile(args.profile, config.defaultProfile);
  const title = (args.title || '').trim() || path.basename(project);
  const brief = (args.brief || '').trim();
  const options = PROFILE_DIRECTIONS(profile).map((d) => ({
    id: d.id,
    name: d.name,
    summary: d.summary,
    palette: d.colors,
    type: d.type,
    layout: d.layout,
    motion: d.motion,
    best_for: d.best_for,
  }));
  const payload = {
    schema: 'deck-studio.direction-options.v1',
    profile,
    title,
    brief,
    generated_at: new Date().toISOString(),
    decision: 'ask_user_before_init',
    options,
  };
  const uiDir = path.join(project, 'confirm_ui');
  await ensureDir(uiDir);
  const file = path.join(uiDir, 'direction_options.json');
  await fs.writeFile(file, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');

  const lines = [
    `已生成 ${PROFILE_LABEL[profile]} 方向的 3 个候选方案，选一个再 init：`,
    ...options.map((o, i) => `${i + 1}. ${o.id}｜${o.name}——${o.summary}（适合：${o.best_for}）`),
    '',
    '把这三条原样给用户选；用户选定后调用 deck action=init option=<id>，配色与方向说明会写进 spec_lock.md。',
  ];
  // Shape must match deckOutput().schema exactly: ok/action/project/message.
  // Returning the legacy { content, data, artifacts } shape made every first
  // `propose` call fail validation *after* the JSON had already been written.
  return {
    ok: true,
    action: 'propose',
    project,
    message: lines.join('\n'),
    artifacts: [await artifact('direction-options', file)],
    data: { profile, file, decision: 'ask_user_before_init', options },
  };
}

async function actionInit(config, project, args) {
  const profile = pickProfile(args.profile, config.defaultProfile);
  const title = (args.title || '').trim() || path.basename(project);
  const brief = (args.brief || '').trim() || '（待补充：这次 deck 要解决什么问题、给谁看、看完做什么）';
  const existing = (await listDir(project)).filter((entry) => !IGNORABLE_ON_INIT.has(entry));
  if (existing.length > 0 && !args.force) {
    throw new Error(`目录非空：${project}。确认要覆盖时传 force=true。`);
  }
  await ensureDir(path.join(project, 'svg_output'));
  await ensureDir(path.join(project, 'assets'));
  await ensureDir(path.join(project, 'exports'));

  const templatePath = path.join(here, 'templates', `spec_lock-${profile}.md`);
  if (!(await exists(templatePath))) {
    throw new Error(`缺少 profile 模板：${templatePath}`);
  }
  let lock = await readText(templatePath);
  let direction = null;
  if (typeof args.option === 'string' && args.option.trim() !== '') {
    direction = findDirection(profile, args.option.trim());
    if (!direction) {
      throw new Error(
        `未知方案 "${args.option}"；${PROFILE_LABEL[profile]} 可用：${PROFILE_DIRECTIONS(profile).map((d) => d.id).join(', ')}`,
      );
    }
    lock = directionColors(lock, direction.colors);
    const anchor = lock.indexOf('\n## mode');
    const note = directionNote(direction);
    lock = anchor === -1 ? `${lock.trimEnd()}\n${note}\n` : `${lock.slice(0, anchor)}\n${note}${lock.slice(anchor)}`;
  }
  const source = `# ${title}

> ${brief}

## 内容骨架

1. 开场：一句话结论 / 一个判断
2. 背景：为什么现在要讲
3. 主体：3–5 个要点，每页一个观点
4. 证据：数据、照片、引语
5. 收束：下一步 / 行动

## 素材

- 照片：
- 数据：
- 参考：
`;
  const design = `# Design Spec — ${title}

## A. 目标
- 受众：${PROFILE_LABEL[profile]}
- 场景：班级 / 学院 / 活动
- 看完要做什么：${brief}

## B. 内容
- 核心信息：
- 支撑点：
- 证据：

## C. 视觉
- profile: ${profile}
- visual_style: custom（见 spec_lock.md）
- 参考：04-模板/视觉风格/

## I. Motion
- proactive_custom_animations: false
- motion_profile: ${profile}
- 说明：默认对象动画关闭；需要揭示顺序时用 deck animate 先出 DryRun 提案。

## IX. Content Outline

### Part 1: 开场

#### Slide 01 - 封面
- **Audience move**: 知道这是什么场合、值不值得听
- **Layout**: 大标题 + 一条规则线 + 最小元信息
- **Title**: ${title}
- **Core message**: ${brief}
- **Content**: 场合、日期、汇报人

#### Slide 02 - 一个判断
- **Audience move**: 记住一句话
- **Layout**: 一句结论占主版面，证据退到次级
- **Title**: 本场最想让人记住的判断
- **Core message**: 只写一句可被复述的话
- **Content**: 一个数字或一个事实作为支撑

#### Slide 03 - 下一步
- **Audience move**: 知道散会后做什么
- **Layout**: 三个动作，纵向排列，左对齐
- **Title**: 接下来只做三件事
- **Core message**: 动作要具体到人和时间
- **Content**: 动作 / 负责人 / 截止时间
`;
  const readme = `# ${title}

用 Deck Studio 生成。顺序：

1. 编辑 \`source.md\`，把内容压到 8–12 页。
2. 编辑 \`spec_lock.md\` 的 colors / typography；不要往 visual_style 里塞 HEX。
3. 在 \`svg_output/\` 放 \`01_cover.svg\`、\`02_*.svg\`…（1600×900）。
4. \`deck check\` 过质量门；需要看渲染时加 review。
5. \`deck export\` 出 PPTX；需要 PDF/PNG 时 format=all。
6. 需要动画时 \`deck animate\` 先 DryRun，再 Apply。

约定：文件名两位序号；一页一个观点；正文 ≥20px；不留 emoji 图标。
`;

  await fs.writeFile(path.join(project, 'source.md'), source, 'utf8');
  await fs.writeFile(path.join(project, 'design_spec.md'), design, 'utf8');
  await fs.writeFile(path.join(project, 'spec_lock.md'), lock, 'utf8');
  await fs.writeFile(path.join(project, 'README.md'), readme, 'utf8');
  await fs.writeFile(path.join(project, 'svg_output', '.gitkeep'), '', 'utf8');
  await fs.writeFile(path.join(project, 'assets', '.gitkeep'), '', 'utf8');

  const artifacts = await Promise.all([
    artifact('source', path.join(project, 'source.md')),
    artifact('design-spec', path.join(project, 'design_spec.md')),
    artifact('spec-lock', path.join(project, 'spec_lock.md')),
    artifact('readme', path.join(project, 'README.md')),
  ]);
  return {
    ok: true,
    action: 'init',
    project,
    message: direction
      ? `已初始化 ${PROFILE_LABEL[profile]} 项目，并落地方案「${direction.name}」（${direction.id}）；下一步编辑 source.md 与 spec_lock.md，再用 deck brief 拿页面契约预算写 page_plan.json。`
      : `已初始化 ${PROFILE_LABEL[profile]} 项目；下一步编辑 source.md 与 spec_lock.md，再用 deck brief 拿页面契约预算写 page_plan.json。还没给用户选方向的话，先 deck propose 出三个候选。`,
    artifacts,
    data: { profile, title, direction: direction ? direction.id : null },
  };
}

async function actionStatus(config, project) {
  const svgs = await listSvg(project);
  const hasSource = await exists(path.join(project, 'source.md'));
  const hasLock = await exists(path.join(project, 'spec_lock.md'));
  const qualityPath = path.join(project, 'validation', 'svg_quality_report.json');
  const report = await readJson(qualityPath);
  const exports_ = (await listDir(path.join(project, 'exports'))).sort();
  const previews = (await listDir(path.join(project, '.preview')))
    .filter((item) => item.toLowerCase().endsWith('.png'))
    .sort();
  const htmlFiles = exports_.filter((item) => item.toLowerCase().endsWith('.html'));
  const pptxFiles = exports_.filter((item) => item.toLowerCase().endsWith('.pptx'));
  const missing = [];
  if (!hasSource) missing.push('source.md');
  if (!hasLock) missing.push('spec_lock.md');
  if (svgs.length === 0) missing.push('svg_output/*.svg');

  const artifacts = [];
  for (const file of pptxFiles) artifacts.push(await artifact('pptx', path.join(project, 'exports', file)));
  for (const file of htmlFiles) artifacts.push(await artifact('html', path.join(project, 'exports', file)));
  for (const file of previews) artifacts.push(await artifact('preview', path.join(project, '.preview', file)));

  const runtime = runtimeInfo();
  const previewServer = await livePreviewState(project);
  const plan = await pagePlanAudit(project, {
    profile: await projectProfile(project, null),
    svgFiles: svgs,
  });
  // Say it here, not only when check(review=true) fails: a missing playwright
  // turns visual review into a no-op, and that must be visible before the work.
  const reviewHint = runtime.visualReview?.playwright
    ? ''
    : '\n视觉回渲不可用：python 里没有 playwright，check(review=true) 会返回 ok=false。安装：pip install playwright && python -m playwright install chromium';

  // Mixed export needs a real browser on this machine; say so up front instead
  // of failing in the middle of an export after the pages are rasterised.
  const browserPath = detectBrowser();
  const mixedHint = browserPath
    ? ''
    : '\n混合导出不可用：没有找到 Chrome/Edge，export(mixed=true) 会拒绝执行。装 Chrome 或设 DECK_BROWSER 指向浏览器。';

  // Native splicing is likewise all-or-nothing: a missing PowerPoint or a
  // missing template must be visible before export, not as a warning after it.
  const native = await readNativePlan(project);
  const powerPoint = detectPowerPoint();
  const nativeHint = !native.present
    ? ''
    : native.problems.length
      ? `\n原生页（${NATIVE_PLAN_FILE}）有 ${native.problems.length} 处问题：${native.problems.slice(0, 3).join('；')}`
      : !powerPoint
        ? '\n原生页不可用：没有找到 Microsoft PowerPoint（POWERPNT.EXE）。装 PowerPoint 或设 DECK_POWERPOINT；export 会跳过原生页。'
        : `\n原生页：${NATIVE_PLAN_FILE} 已就绪，export 会另存一份 -native.pptx。`;

  return {
    ok: missing.length === 0,
    action: 'status',
    project,
    message:
      (missing.length === 0
        ? `项目可用：${svgs.length} 页 SVG，spec_lock 已就绪。`
        : `还缺：${missing.join(', ')}。`) + reviewHint + mixedHint + nativeHint,
    artifacts,
    data: {
      svgCount: svgs.length,
      svgs,
      hasSource,
      hasSpecLock: hasLock,
      hasQualityReport: Boolean(report),
      qualityStatus: report?.summary?.status ?? report?.status ?? null,
      exports: exports_,
      previews,
      missing,
      powerPoint: { path: powerPoint, nativeExport: Boolean(powerPoint) },
      nativePlan: native.present
        ? { present: true, template: native.plan?.template ?? '', replace: Object.keys(native.plan?.slides ?? {}).length, append: native.plan?.append.length ?? 0, problems: native.problems }
        : { present: false },
      hasPagePlan: plan.present,
      pagePlan: { pages: plan.counts.pages, violations: plan.counts.violations, warnings: plan.counts.warnings },
      previewServer,
      runtime: { ...runtime, browser: { path: browserPath, mixedExport: Boolean(browserPath) } },
    },
  };
}

function usageLines(plan) {
  const byFile = new Map();
  for (const row of plan.usage) {
    if (!byFile.has(row.file)) byFile.set(row.file, { archetype: row.archetype, rows: [] });
    byFile.get(row.file).rows.push(row);
  }
  const lines = [];
  for (const [file, group] of byFile) {
    const cells = group.rows.map((row) => `${row.label} ${row.used}/${row.max}${row.unit}`);
    lines.push(`- ${file}（${group.archetype}）：${cells.join(' · ')}`);
  }
  return lines;
}

// action=brief is the "write the contract before the pages" stop. With no
// page_plan.json it prints the slot budgets; with one it prints the per-page
// budget against what the author actually typed.
async function actionBrief(config, project, args) {
  const svgs = await listSvg(project);
  const profile = await projectProfile(project, args.profile ?? config.defaultProfile);
  const plan = await pagePlanAudit(project, { profile, svgFiles: svgs });
  const menu = planMenuText();
  const skeleton = planSkeletonText();

  const artifacts = [];
  if (plan.present) artifacts.push(await artifact('page-plan', plan.path));
  const violationLines = formatViolations(plan.violations, 10).map((line) => `- ${clampText(line, 300)}`);
  const warningLines = plan.warnings.slice(0, 6).map((line) => `· ${clampText(line, 240)}`);

  let message;
  let ok;
  if (!plan.present) {
    ok = false;
    message = [
      `还没有 ${PLAN_FILE}：先把每页写成契约，再画 SVG。`,
      svgs.length
        ? `当前 ${svgs.length} 页 SVG 的字数审计已跳过；没有契约时 check 不判断文案会不会超版。`
        : '契约写好后，check 会逐槽核对字数与条数。',
      '',
      `在 ${project} 下建 ${PLAN_FILE}，一页一条：file 指向 svg_output/ 里的文件名，text 的键用下列槽位。`,
      '',
      '骨架（按需增删页）：',
      skeleton.text,
      '',
      `profile=${profile} 的原型与槽位预算：`,
      menu,
      '',
      '契约写完可以 deck(action="scaffold") 直接出页；视觉语言（theme）可选：',
      themeMenuText(),
    ].join('\n');
  } else {
    ok = plan.violations.length === 0;
    const head = ok
      ? `契约 ${plan.counts.pages} 页，字数与条数都在预算内。`
      : `契约 ${plan.counts.pages} 页，${plan.violations.length} 处不合规，先改文案或拆页，别缩字号。`;
    const parts = [head];
    if (violationLines.length) {
      parts.push('', `不合规（${plan.violations.length} 处${plan.violations.length > violationLines.length ? `，只列前 ${violationLines.length}` : ''}）：`, ...violationLines);
    }
    const usage = usageLines(plan);
    if (usage.length) parts.push('', '预算占用：', ...usage);
    if (warningLines.length) parts.push('', '提示：', ...warningLines);
    if (!ok) parts.push('', `改完重跑 deck(action="brief", project=…) 或 deck(action="check", project=…) 复核。`);
    if (ok) parts.push('', `下一步可以 deck(action="scaffold", project=…) 直接出草稿页；视觉语言（theme）：${THEME_IDS.join(' / ')}。`);
    message = parts.join('\n');
  }

  return {
    ok,
    action: 'brief',
    project,
    message,
    artifacts,
    data: {
      profile,
      planPath: plan.path,
      present: plan.present,
      valid: plan.valid,
      pages: plan.counts.pages,
      violations: plan.violations,
      warnings: plan.warnings,
      usage: plan.usage,
      svgCount: svgs.length,
      archetypes: ARCHETYPE_ORDER,
      menu,
      skeleton: skeleton.skeleton,
      themes: THEME_IDS,
      themeMenu: themeMenuText(),
    },
  };
}

async function actionCheck(config, project, args) {
  const svgs = await listSvg(project);
  if (svgs.length === 0) {
    throw new Error('svg_output/ 里没有 SVG；先放 01_cover.svg 等页面。');
  }
  const quality = await runQuality(config, project, args.__signal);
  const previews = [];
  // Anything that should have run but did not belongs in blockers: a green
  // gate on a half-run validation is worse than a red one.
  const blockers = [];
  if (args.review) {
    const live = await livePreviewState(project);
    if (!live.running) {
      blockers.push(
        '视觉回渲未执行：没有检测到本项目的 live-preview 服务（缺 live_preview/lock.json，或记录里的进程已退出）。' +
          '先启动 scripts/svg_editor/server.py，再重跑 review=true。',
      );
    } else {
      let reviewError = '';
      try {
        const review = await runVisualReview(config, project, args.__signal);
        previews.push(...review.previews);
        if (review.code !== 0) {
          reviewError = clampText(review.stderr || review.stdout, 1200) || `exit ${review.code}`;
        } else if (review.previews.length === 0) {
          reviewError = 'visual_review 退出码 0，但 .preview/ 里没有 PNG。';
        }
      } catch (error) {
        reviewError = String(error?.message || error);
      }
      if (reviewError) blockers.push(`视觉回渲未执行：${reviewError}`);
    }
  }

  const artifacts = [];
  if (await exists(quality.reportPath)) artifacts.push(await artifact('quality-report', quality.reportPath));
  for (const file of previews) artifacts.push(await artifact('preview', file));

  const digest = qualityDigest(quality.report);
  let audit = { notes: [], warnings: [] };
  try {
    audit = await auditProject(project);
  } catch (error) {
    const detail = `项目自查未执行：${String(error?.message || error)}`;
    audit.warnings.push(detail);
    blockers.push(detail);
  }
  let plan;
  try {
    const profile = await projectProfile(project, args.profile ?? config.defaultProfile);
    plan = await pagePlanAudit(project, { profile, svgFiles: svgs });
    for (const item of plan.violations) {
      blockers.push(`${item.kind === 'media' ? '配图' : '字数契约'}：${item.file}：${item.message}`);
    }
  } catch (error) {
    const detail = `字数契约未核查：${String(error?.message || error)}`;
    plan = missingPlan(svgs);
    plan.warnings.push(detail);
    blockers.push(detail);
  }
  const ok = quality.code === 0 && blockers.length === 0;
  const hints = hintsFor([...digest.errors, ...digest.warnings, ...audit.warnings]);
  const errorLines = digest.errors.slice(0, 5).map((line) => `- ${clampText(line, 400)}`);
  const auditLines = audit.warnings.slice(0, 4).map((line) => `· ${clampText(line, 300)}`);
  const blockerLines = blockers.map((line) => `- ${clampText(line, 500)}`);
  const reviewed = previews.length ? `已回渲 ${previews.length} 页。` : '';
  let message;
  if (quality.code !== 0) {
    message = `质量门未通过（${digest.counts.errors} 个 ERROR）：\n${errorLines.join('\n')}${
      digest.counts.errors > errorLines.length ? `\n……其余见 ${quality.reportPath}` : ''
    }`;
  } else if (!ok) {
    message = `质量门通过，但验收没跑完（${blockers.length} 项）：\n${blockerLines.join('\n')}\n据此不要说“可以交付了”。`;
  } else {
    message = `质量门通过${digest.counts.warnings ? `（${digest.counts.warnings} 条 warning，可解释即可）` : ''}。${reviewed}`;
  }
  if (auditLines.length) message += `\n补充自查：\n${auditLines.join('\n')}`;
  // Violations already reach the user through blockers when the quality gate
  // passed; only print them here when the gate failed, otherwise they duplicate.
  if (plan.present) {
    const planWarnings = plan.warnings.slice(0, 3);
    const planViolations = quality.code === 0 ? [] : plan.violations.slice(0, 5);
    if (planWarnings.length || planViolations.length) {
      message += `\n字数契约（${plan.counts.pages} 页）：`;
      for (const line of formatViolations(planViolations, 5)) message += `\n- ${clampText(line, 300)}`;
      for (const line of planWarnings) message += `\n· ${clampText(line, 240)}`;
    }
  }
  if (hints.length) {
    message += `\n常见改法：\n${hints.slice(0, 4).map((hint) => `· ${hint}`).join('\n')}`;
  }
  return {
    ok,
    action: 'check',
    project,
    message,
    artifacts,
    data: {
      exitCode: quality.code,
      stdout: clampText(quality.stdout, 4000),
      stderr: clampText(quality.stderr, 2000),
      reportPath: quality.reportPath,
      report: quality.report?.summary ?? quality.report?.status ?? null,
      errors: digest.errors,
      warnings: [...digest.warnings, ...audit.warnings],
      hints,
      blockers,
      audit,
      plan: {
        present: plan.present,
        valid: plan.valid,
        planPath: plan.path,
        counts: plan.counts,
        violations: plan.violations,
        warnings: plan.warnings,
        usage: plan.usage,
      },
      previews,
    },
  };
}

// Mixed export: rasterise each skeleton page's background layer with a real
// browser, then let the PPTX converter lay native text over that picture. Text
// stays editable, the decoration layer stays pixel-exact. Opt-in only — the
// pictures make the file several times larger than the pure vector path.
async function buildMixedProject(config, project, theme, svgs, rawPlan, signal) {
  const browser = detectBrowser();
  if (!browser) {
    throw new Error(
      '混合导出需要 Chrome 或 Edge：没有找到浏览器。装一个 Chrome，或用环境变量 DECK_BROWSER 指向浏览器程序。',
    );
  }
  const declared = new Map((rawPlan?.pages ?? []).map((page) => [page.file, page]));
  const dir = path.join(project, 'validation', 'mixed');
  await fs.rm(dir, { recursive: true, force: true });
  const svgOut = path.join(dir, 'svg_output');
  const pngOut = path.join(dir, 'png');
  await ensureDir(svgOut);
  await ensureDir(pngOut);
  // The converter validates every release export against a spec lock.
  await fs.copyFile(path.join(project, 'spec_lock.md'), path.join(dir, 'spec_lock.md')).catch(() => {});
  const profileDir = await fs.mkdtemp(path.join(os.tmpdir(), 'deck-mixed-'));
  const mixed = [];
  const copied = [];
  try {
    for (let i = 0; i < svgs.length; i += 1) {
      const file = svgs[i];
      const page = declared.get(file);
      if (!page) {
        // A hand-written page has no slots to re-render: keep it vector-clean.
        await fs.copyFile(path.join(project, 'svg_output', file), path.join(svgOut, file));
        copied.push(file);
        continue;
      }
      const ctx = { theme, pageNumber: i + 1, total: svgs.length };
      // The base layer is rendered from validation/mixed/, where a relative
      // ../images/... would resolve one level too shallow: point the browser at
      // the absolute file URL instead. The composed export page keeps the
      // relative form, because that is the converter's contract.
      const baseSvg = renderSkeletonPage(page, ctx, { part: 'base' }).replace(
        /href="\.\.\/images\/([^"]+)"/g,
        (_, rel) => `href="file:///${path.join(project, 'images', rel).replace(/\\/g, '/')}"`,
      );
      const baseFile = path.join(dir, `base-${String(i + 1).padStart(2, '0')}.svg`);
      await fs.writeFile(baseFile, baseSvg, 'utf8');
      const pngName = `${String(i + 1).padStart(2, '0')}.png`;
      const pngPath = path.join(pngOut, pngName);
      const shot = await runProcess(
        browser,
        [
          '--headless=new',
          '--disable-gpu',
          '--hide-scrollbars',
          '--force-device-scale-factor=1',
          '--window-size=1600,900',
          `--user-data-dir=${profileDir}`,
          `--screenshot=${pngPath}`,
          `file:///${baseFile.replace(/\\/g, '/')}`,
        ],
        { timeoutMs: 60000, signal },
      );
      if (shot.code !== 0 || !(await exists(pngPath))) {
        throw new Error(`混合导出：背景栅格化失败（${file}）。\n${clampText(shot.stderr || shot.stdout, 800)}`);
      }
      const textSvg = renderSkeletonPage(page, ctx, { part: 'text' });
      const start = textSvg.indexOf('<g id="content"');
      if (start < 0) throw new Error(`混合导出：${file} 的文字层没有生成。`);
      const content = textSvg.slice(start, textSvg.lastIndexOf('</svg>'));
      const composed =
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" width="1600" height="900" ` +
        `data-pptx-page-role="${page.archetype === 'cover' ? 'cover' : page.archetype === 'closing' ? 'ending' : 'content'}">` +
        `<image id="mixed-bg" href="../png/${pngName}" x="0" y="0" width="1600" height="900" preserveAspectRatio="none"/>` +
        `${content}</svg>`;
      await fs.writeFile(path.join(svgOut, file), composed, 'utf8');
      mixed.push(file);
    }
  } finally {
    await fs.rm(profileDir, { recursive: true, force: true }).catch(() => {});
  }
  return { dir, mixed, copied };
}

const NATIVE_PLAN_FILE = 'native_plan.json';

// The spliced deck keeps native PowerPoint pages (3D models, video, SmartArt)
// that python-pptx cannot copy part-for-part. The plan says which exported page
// a template slide replaces, and which template slides to append.
async function readNativePlan(project) {
  const file = path.join(project, NATIVE_PLAN_FILE);
  if (!(await exists(file))) return { present: false, plan: null, problems: [], file };
  let raw;
  try {
    raw = JSON.parse(await readText(file));
  } catch {
    return { present: true, plan: null, problems: [`${NATIVE_PLAN_FILE} 不是合法 JSON。`], file };
  }
  const problems = [];
  const template = typeof raw?.template === 'string' ? raw.template.trim() : '';
  if (!template) problems.push('缺 template：写模板 pptx 的路径（相对项目根）。');
  const slides = {};
  for (const [svg, entry] of Object.entries(raw?.slides ?? {})) {
    if (!Number.isInteger(entry?.templateSlide) || entry.templateSlide < 1) {
      problems.push(`${svg}：templateSlide 必须是 ≥1 的整数。`);
      continue;
    }
    const fields = entry?.fields ?? {};
    if (typeof fields !== 'object' || Array.isArray(fields)) {
      problems.push(`${svg}：fields 必须是「字段 → 文字」的对象。`);
      continue;
    }
    slides[svg] = { templateSlide: entry.templateSlide, fields };
  }
  const append = [];
  (Array.isArray(raw?.append) ? raw.append : []).forEach((entry, index) => {
    if (!Number.isInteger(entry?.templateSlide) || entry.templateSlide < 1) {
      problems.push(`append[${index}]：templateSlide 必须是 ≥1 的整数。`);
      return;
    }
    append.push({ templateSlide: entry.templateSlide, fields: entry?.fields ?? {} });
  });
  return { present: true, plan: { template, slides, append }, problems, file };
}

async function spliceNative(context, project, deckPath, outPath, native, svgs, signal) {
  const templatePath = path.isAbsolute(native.template)
    ? native.template
    : path.join(project, native.template);
  if (!(await exists(templatePath))) {
    throw new Error(`原生页模板不存在：${templatePath}。改 ${NATIVE_PLAN_FILE} 里的 template。`);
  }
  if (!detectPowerPoint()) {
    throw new Error(
      '原生页拼接需要 Microsoft PowerPoint：没有找到 POWERPNT.EXE。装 PowerPoint，或用环境变量 DECK_POWERPOINT 指向它；否则先删掉 native_plan.json 走纯矢量导出。',
    );
  }
  const replace = [];
  for (let index = 0; index < svgs.length; index += 1) {
    const entry = native.slides[svgs[index]];
    if (!entry) continue;
    replace.push({ deckSlide: index + 1, templateSlide: entry.templateSlide, fields: entry.fields });
  }
  if (replace.length === 0 && native.append.length === 0) {
    throw new Error(`${NATIVE_PLAN_FILE} 里没有可拼接的页：至少写一个 slides 条目或 append 条目。`);
  }
  const dir = path.join(project, 'validation', 'native');
  await ensureDir(dir);
  // PowerPoint's COM Open/SaveAs reject non-ASCII paths with a bogus
  // "Filename cannot exceed 255 characters"; splice in an ASCII work dir and
  // copy the result to the real (often Chinese) file name afterwards.
  const workDeck = path.join(dir, 'deck.pptx');
  const workTemplate = path.join(dir, 'template.pptx');
  const workOut = path.join(dir, 'spliced.pptx');
  await fs.copyFile(deckPath, workDeck);
  await fs.copyFile(templatePath, workTemplate);
  const specFile = path.join(dir, 'splice-plan.json');
  const spec = { deck: workDeck, template: workTemplate, out: workOut, replace, append: native.append };
  await fs.writeFile(specFile, JSON.stringify(spec, null, 2), 'utf8');
  const script = path.join(here, 'scripts', 'native-splice.ps1');
  const result = await runPowerShell(context, script, ['-PlanFile', specFile], {
    cwd: project,
    signal,
    timeoutMs: Math.max(context.timeoutMs, 300000),
  });
  const stdout = String(result.stdout ?? '');
  if (result.code !== 0 || /FAILED/.test(stdout) || !(await exists(workOut))) {
    throw failed(result, '原生页拼接');
  }
  await ensureDir(path.dirname(outPath));
  await fs.copyFile(workOut, outPath);
  const fields = stdout
    .split(/\r?\n/)
    .filter((line) => line.startsWith('field '))
    .map((line) => line.slice(6).trim());
  return {
    output: outPath,
    template: templatePath,
    replaced: replace.map((entry) => entry.deckSlide),
    appended: native.append.length,
    fields,
    slides: Number((/OK slides=(\d+)/.exec(stdout) ?? [])[1] ?? 0),
  };
}

async function actionExport(config, project, args) {
  const svgs = await listSvg(project);
  if (svgs.length === 0) throw new Error('svg_output/ 里没有 SVG；先放页面。');
  const lock = path.join(project, 'spec_lock.md');
  if (!(await exists(lock))) {
    throw new Error('缺少 spec_lock.md；先 deck init 或补锁文件。');
  }

  // A page that already overflows its slot must not reach PPTX: the layout does
  // not wrap, it clips, and the user only finds out on a projector. Run before
  // the quality gate so a broken contract fails fast instead of after python.
  const plan = await pagePlanAudit(project, {
    profile: await projectProfile(project, args.profile ?? config.defaultProfile),
    svgFiles: svgs,
  });
  if (plan.violations.length) {
    throw new Error(
      `字数契约未通过（${plan.violations.length} 处），导出会带上超版文案：\n` +
        formatViolations(plan.violations, 6)
          .map((line) => `- ${line}`)
          .join('\n') +
        `\n改 page_plan.json 或改文案；确要强行导出，先删掉 ${PLAN_FILE}。`,
    );
  }

  const quality = await runQuality(config, project, args.__signal);
  if (quality.code !== 0) {
    throw failed(quality, 'SVG 质量门');
  }

  const format = FORMATS.has(args.format) ? args.format : 'pptx';
  const title = (args.title || '').trim() || (await readSourceTitle(project)) || path.basename(project);
  const base = slugify(title);
  const out = args.output
    ? path.isAbsolute(args.output)
      ? args.output
      : path.join(project, args.output)
    : path.join(project, 'exports', `${base}.pptx`);
  await ensureDir(path.dirname(out));

  if ((await exists(out)) && !args.force) {
    throw new Error(`输出已存在：${out}。传 force=true 覆盖。`);
  }

  const converter = path.join(config.skillRoot, 'scripts', 'svg_to_pptx.py');
  let convertSource = project;
  let mixedInfo = null;
  if (args.mixed) {
    const rawPlan = await readPagePlan(project);
    const theme = resolveTheme(args, rawPlan.plan, await lockThemeId(project), await projectProfile(project, args.profile), await reportTheme(project));
    mixedInfo = await buildMixedProject(config, project, theme, svgs, rawPlan.plan, args.__signal);
    convertSource = mixedInfo.dir;
    // The converter refuses a release export without a fresh final report, and
    // the composed pages deserve the same gate as the vector originals.
    const mixedQuality = await runQuality(config, convertSource, args.__signal);
    if (mixedQuality.code !== 0) throw failed(mixedQuality, '混合页质量门');
  }
  const convertArgs = [convertSource, '-o', out];
  const animConfig = path.join(project, 'animations.json');
  if (await exists(animConfig)) convertArgs.push('--animation-config', animConfig);
  const convert = await runPython(config, converter, convertArgs, {
    cwd: project,
    signal: args.__signal,
    timeoutMs: Math.max(config.timeoutMs, 240000),
  });
  if (convert.code !== 0) throw failed(convert, 'PPTX 导出');

  const fixer = path.join(here, 'scripts', 'fix-pptx-cjk-fonts.py');
  const fixed = await runPython(config, fixer, [out, '--spec-lock', lock, '-o', out], {
    cwd: project,
    signal: args.__signal,
  });
  if (fixed.code !== 0) throw failed(fixed, '中文字体修复');

  const warnings = [];
  const artifacts = [await artifact('pptx', out)];
  const extra = [];
  const wantsPdf = format === 'pdf' || format === 'all';
  const wantsPng = format === 'png' || format === 'all';
  if (wantsPdf || wantsPng) {
    const script = path.join(here, 'scripts', 'pptx-export.ps1');
    const pdf = wantsPdf ? out.replace(/\.pptx$/i, '.pdf') : '';
    const png = wantsPng ? out.replace(/\.pptx$/i, '.png') : '';
    const psArgs = ['-Pptx', out];
    if (pdf) psArgs.push('-Pdf', pdf);
    if (png) psArgs.push('-Png', png);
    try {
      const rendered = await runPowerShell(config, script, psArgs, {
        cwd: project,
        signal: args.__signal,
        timeoutMs: Math.max(config.timeoutMs, 240000),
      });
      if (rendered.code !== 0) {
        warnings.push(`PDF/PNG 导出失败：${clampText(rendered.stderr || rendered.stdout, 1200)}`);
      } else {
        if (pdf && (await exists(pdf))) {
          artifacts.push(await artifact('pdf', pdf));
          extra.push('pdf');
          const pdfBytes = await fileBytes(pdf);
          if (Number(pdfBytes) > 15 * 1024 * 1024) {
            warnings.push(
              `PDF ${(Number(pdfBytes) / 1048576).toFixed(1)} MB：PowerPoint COM 出的是整页位图。发群前按 SKILL.md「导出」里的轻量 PDF 做法重压一版。`,
            );
          }
        }
        if (png && (await exists(png))) {
          artifacts.push(await artifact('png', png));
          extra.push('png');
        }
      }
    } catch (error) {
      warnings.push(`PDF/PNG 导出失败：${String(error?.message || error)}`);
    }
  }

  const native = await readNativePlan(project);
  let nativeInfo = null;
  if (native.present && native.problems.length) {
    warnings.push(
      `${NATIVE_PLAN_FILE} 有 ${native.problems.length} 处问题，原生页已跳过：\n- ${native.problems.slice(0, 4).join('\n- ')}`,
    );
  } else if (native.present) {
    if (!detectPowerPoint()) {
      warnings.push(
        '原生页跳过：没找到 Microsoft PowerPoint（POWERPNT.EXE）。装 PowerPoint 或设 DECK_POWERPOINT；纯矢量页已照常导出。',
      );
    } else {
      const nativeOut = out.replace(/\.pptx$/i, '-native.pptx');
      if ((await exists(nativeOut)) && !args.force) {
        warnings.push(`原生页已存在：${nativeOut}。传 force=true 覆盖。`);
      } else {
        try {
          nativeInfo = await spliceNative(config, project, out, nativeOut, native.plan, svgs, args.__signal);
          artifacts.push(await artifact('pptx', nativeOut));
        } catch (error) {
          warnings.push(`原生页拼接失败：${String(error?.message || error)}`);
        }
      }
    }
  } else {
    warnings.push(`原生页：没有 ${NATIVE_PLAN_FILE}，本次只导出矢量页。要封面/目录用学院官方模板，按 SKILL.md §2.3d 写一份。`);
  }

  const modeLine = mixedInfo
    ? `混合导出：${mixedInfo.mixed.length} 页背景已栅格化、文字保留可编辑${mixedInfo.copied.length ? `，${mixedInfo.copied.length} 页按原矢量页复制` : ''}；体积会比纯矢量版大数倍。`
    : '';
  const nativeLine = nativeInfo
    ? `原生页：替换 ${nativeInfo.replaced.length} 页、追加 ${nativeInfo.appended} 页，共 ${nativeInfo.slides} 页 → ${path.basename(nativeInfo.output)}。3D/视频页原样保留。`
    : '';
  return {
    ok: true,
    action: 'export',
    project,
    message: `已导出 PPTX${extra.length ? ` + ${extra.join('/').toUpperCase()}` : ''}。${modeLine ? `\n${modeLine}` : ''}${nativeLine ? `\n${nativeLine}` : ''}`,
    artifacts,
    data: {
      output: out,
      format,
      mixed: Boolean(mixedInfo),
      mixedPages: mixedInfo ? { mixed: mixedInfo.mixed, copied: mixedInfo.copied } : null,
      native: nativeInfo,
      nativePlan: native.present ? { plan: native.plan, problems: native.problems } : null,
      warnings,
      quality: tail(quality),
      convert: tail(convert),
      fontFix: tail(fixed),
    },
  };
}

async function actionEdit(config, project, args) {
  const read = await readPagePlan(project);
  if (!read.present) {
    throw new Error('没有 page_plan.json：先 deck brief 拿槽位预算，写好页面契约再来编辑。');
  }
  const pages = Array.isArray(read.plan?.pages) ? read.plan.pages : [];
  if (pages.length === 0) throw new Error('page_plan.json 里没有 pages：先补页面契约。');
  const profile = await projectProfile(project, args.profile ?? config.defaultProfile);
  const theme = resolveTheme(args, read.plan, await lockThemeId(project), profile, await reportTheme(project));
  const modules = {
    themes: await readText(path.join(here, 'lib/themes.mjs')),
    contracts: await readText(path.join(here, 'lib/page-contracts.mjs')),
    skeleton: await readText(path.join(here, 'lib/skeleton.mjs')),
  };
  const title = (args.title || '').trim() || (await readSourceTitle(project)) || path.basename(project);
  const files = pages.map((page, index) =>
    page.file || `${String(index + 1).padStart(2, '0')}_${page.archetype}.svg`,
  );
  const html = buildEditorHtml({ title, profile, themeId: theme.id, plan: read.plan, files, modules });
  const out = args.output
    ? path.isAbsolute(args.output)
      ? args.output
      : path.join(project, args.output)
    : path.join(project, 'exports', `${slugify(title)}-edits.html`);
  await ensureDir(path.dirname(out));
  if ((await exists(out)) && !args.force) {
    throw new Error(`编辑器已存在：${out}。传 force=true 重新生成（会覆盖）。`);
  }
  await fs.writeFile(out, html, 'utf8');
  return {
    ok: true,
    action: 'edit',
    project,
    message: `已生成单文件编辑器（${pages.length} 页，主题 ${theme.label}）：${path.basename(out)}\n用 Chrome 或 Edge 打开它；第一次点「保存到项目目录」选这个 deck 的项目根目录（含 page_plan.json）。保存会同时写 page_plan.json 与 svg_output/，之后跑 deck check 复核。`,
    artifacts: [await artifact('html', out)],
    data: { output: out, pages: pages.length, theme: theme.id, files },
  };
}

async function actionHtml(config, project, args) {
  const svgs = await listSvg(project);
  if (svgs.length === 0) throw new Error('svg_output/ 里没有 SVG；先放页面。');
  const items = [];
  for (const name of svgs) {
    items.push({ name, content: await readText(path.join(project, 'svg_output', name)) });
  }
  const title = (args.title || '').trim() || (await readSourceTitle(project)) || path.basename(project);
  const base = slugify(title);
  const out = args.output
    ? path.isAbsolute(args.output)
      ? args.output
      : path.join(project, args.output)
    : path.join(project, 'exports', `${base}.html`);
  await ensureDir(path.dirname(out));
  if ((await exists(out)) && !args.force) {
    throw new Error(`输出已存在：${out}。传 force=true 覆盖。`);
  }
  const built = await buildHtml(title, items, project);
  await fs.writeFile(out, built.html, 'utf8');
  return {
    ok: true,
    action: 'html',
    project,
    message: `已生成单文件演示 HTML（${items.length} 页，键盘导航）。${built.warnings.length ? ` ${built.warnings.length} 条图片警告。` : ''}`,
    artifacts: [await artifact('html', out)],
    data: { output: out, pages: items.length, warnings: built.warnings },
  };
}

async function actionAnimate(config, project, args) {
  if ((await listSvg(project)).length === 0) throw new Error('svg_output/ 里没有 SVG；先放页面。');
  const profile = pickProfile(args.profile, config.defaultProfile);
  const result = await runAnimate(config, project, args, profile, args.__signal);
  if (result.code !== 0) throw failed(result, args.apply ? '动画写入' : '动画提案');
  const manifest = path.join(project, 'animations.json');
  const artifacts = [];
  if (await exists(manifest)) artifacts.push(await artifact('animations', manifest));
  return {
    ok: true,
    action: 'animate',
    project,
    message: args.apply
      ? '已写入 animations.json 并通过 schema 校验。'
      : '已生成动画提案（未写文件）；确认后再 apply。',
    artifacts,
    data: {
      profile,
      applied: Boolean(args.apply),
      stdout: clampText(result.stdout, 8000),
      stderr: clampText(result.stderr, 2000),
    },
  };
}

function deckOutput() {
  return {
    schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        ok: { type: 'boolean', required: true },
        action: { type: 'string', required: true },
        project: { type: 'string', required: true },
        message: { type: 'string', required: true },
        artifacts: {
          type: 'array',
          required: true,
          items: {
            type: 'object',
            additionalProperties: false,
            properties: {
              kind: { type: 'string', required: true },
              path: { type: 'string', required: true },
              bytes: { type: 'integer' },
            },
          },
        },
        data: { type: 'json' },
      },
    },
    render(_args, value) {
      const lines = [`[deck ${value.action}] ${value.message}`, `project: ${value.project}`];
      if (value.data && typeof value.data === 'object') {
        const summary = value.data.summary;
        if (typeof summary === 'string' && summary.trim()) lines.push(summary.trim());
        if (Array.isArray(value.data.warnings)) {
          for (const warning of value.data.warnings) lines.push(`warning: ${warning}`);
        }
        if (value.action === 'animate' && typeof value.data.stdout === 'string' && value.data.stdout.trim()) {
          lines.push(clampText(value.data.stdout.trim(), 6000));
        }
      }
      for (const item of value.artifacts || []) {
        lines.push(`- ${item.kind}: ${item.path}${item.bytes ? ` (${item.bytes} bytes)` : ''}`);
      }
      return [{ type: 'text', text: lines.join('\n') }];
    },
  };
}

function deckTool(config) {
  return defineTool({
    name: 'deck',
    description:
      'Deck Studio: scaffold, validate, export, animate, or turn a PPT-master SVG deck into a single-file presentation HTML. ' +
      'Start with action=propose to offer three visual directions and let the user choose before init. ' +
      'Use for any PPT/PPTX/幻灯片/演示文稿/幻灯片动画/演示HTML task. Requires an absolute project path because tools have no cwd. ' +
      'Typical flow: propose -> (user picks) -> init option=<id> -> edit source.md/spec_lock.md -> put SVG pages in svg_output/ -> check -> export -> animate.',
    parameters: {
      action: {
        type: 'string',
        required: true,
        enum: ['propose', 'init', 'status', 'brief', 'scaffold', 'edit', 'check', 'export', 'html', 'animate'],
        description:
          'propose writes three candidate visual directions (ask the user first, then init option=<id>); ' +
          'init scaffolds a project; status reports files; brief prints the page-contract slot budgets (and audits page_plan.json when present); ' +
          'scaffold renders svg_output/ pages from page_plan.json using one visual language (theme); ' +
          'edit writes a single-file browser editor for page_plan.json and svg_output/ (no server; save with Chrome/Edge); ' +
          'check runs the SVG quality gate plus font/image/copy audit (optionally visual review); ' +
          'export builds PPTX and repairs CJK fonts, optionally PDF/PNG; html builds a keyboard-navigable single-file deck; ' +
          'animate runs the animation proposal/write gate.',
      },
      project: {
        type: 'string',
        required: true,
        description: 'Absolute project directory. Relative paths are rejected because the plugin tool has no cwd.',
      },
      profile: {
        type: 'string',
        enum: ['formal', 'campaign', 'literary'],
        description: 'Visual/motion recipe: formal (汇报), campaign (活动), literary (文艺).',
      },
      title: {
        type: 'string',
        description: 'Deck title; used for source.md and artifact filenames.',
      },
      brief: {
        type: 'string',
        description: 'One-sentence objective for source.md / design_spec.md.',
      },
      option: {
        type: 'string',
        description:
          'Direction id returned by action=propose — copy the id from that result, never guess. ' +
          'Ids differ per profile: formal (navy-brief / graphite-orange / paper-stamp), ' +
          'campaign (warm-orange / neon-cyan / black-gold), ' +
          'literary (warm-paper / ink-water / desert-ochre). ' +
          'Pass it to init so spec_lock colors and the direction note follow the choice.',
      },
      theme: {
        type: 'string',
        enum: [...THEME_IDS],
        description:
          'Visual language for action=scaffold. Defaults to page_plan.json theme, then spec_lock "- theme:", ' +
          'then the profile default (formal->paper-stamp, campaign->neon-cyan, literary->print-mono). ' +
          'Same content under two themes is the fastest way to tell whether the layout carries the deck.',
      },
      force: {
        type: 'boolean',
        description: 'Overwrite an existing project/artifact/animations.json.',
      },
      format: {
        type: 'string',
        enum: ['pptx', 'pdf', 'png', 'all'],
        description: 'Export format. pdf/png require PowerPoint COM; png is the first-slide preview.',
      },
      review: {
        type: 'boolean',
        description: 'In check, also render PNG previews with visual_review.',
      },
      mixed: {
        type: 'boolean',
        description:
          'In export, rasterise each page background with Chrome/Edge and keep native text on top. ' +
          'Opt-in fallback for backgrounds the vector converter cannot hold; the file grows several times.',
      },
      apply: {
        type: 'boolean',
        description: 'In animate, write animations.json (true) instead of only printing a proposal (false).',
      },
      advanced: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['slow-push', 'micro-shift', 'mask-reveal'],
        },
        description: 'Advanced motion hints. slow-push/micro-shift are warnings, not native effects.',
      },
      output: {
        type: 'string',
        description: 'Optional output path (absolute, or relative to project) for export/html.',
      },
    },
    output: deckOutput(),
    async execute(args, exec) {
      const config = deckTool.config || normalizeConfig();
      const action = requireAction(args.action);
      const project = projectPath(args.project);
      const callArgs = { ...args, __signal: exec?.signal };

      if (!(await exists(project)) && action !== 'init' && action !== 'propose') {
        throw new Error(`项目目录不存在：${project}`);
      }
      if (action === 'propose') return actionPropose(config, project, callArgs);
      if (action === 'init') return actionInit(config, project, callArgs);
      if (action === 'status') return actionStatus(config, project);
      if (action === 'brief') return actionBrief(config, project, callArgs);
      if (action === 'scaffold') return actionScaffold(config, project, callArgs);
      if (action === 'edit') return actionEdit(config, project, callArgs);
      if (action === 'check') return actionCheck(config, project, callArgs);
      if (action === 'export') return actionExport(config, project, callArgs);
      if (action === 'html') return actionHtml(config, project, callArgs);
      return actionAnimate(config, project, callArgs);
    },
    presentCall(args) {
      return {
        card: 'generic',
        title: `Deck ${args.action}: ${path.basename(args.project || '')}`,
        kind: ['status', 'check', 'brief', 'edit'].includes(args.action) ? 'read' : 'execute',
      };
    },
  });
}

const SKILL_DESCRIPTION =
  'Deck Studio: the full PPT / 演示 HTML pipeline for this machine — scaffold a deck, write SVG pages, run the quality gate, ' +
  'export editable PPTX with CJK font repair, render PDF/PNG, build a single-file keyboard-navigable HTML deck, and design ' +
  'animation with a review gate. Use when the user asks for PPT、PPTX、幻灯片、演示文稿、deck、演示 HTML、幻灯片动画、' +
  '或要把一份内容做成可交付的演示。';

function skillProvider() {
  const skillDir = path.join(here, 'skills', 'deck-studio');
  const candidate = {
    name: 'deck-studio',
    description: SKILL_DESCRIPTION,
    invocation: INVOCATION,
    provider: PROVIDER_NAME,
    source: 'bundled',
    resourceBase: { kind: 'directory', path: skillDir },
    rank: 100,
    locator: new URL('./skills/deck-studio/SKILL.md', import.meta.url),
  };
  return {
    name: PROVIDER_NAME,
    list: () => Promise.resolve([candidate]),
    async get(item) {
      const target = item?.locator || candidate.locator;
      const raw = await fs.readFile(target, 'utf8');
      const content = raw.startsWith('---\n')
        ? (() => {
            const end = raw.indexOf('\n---\n', 4);
            return end === -1 ? raw : raw.slice(end + 5);
          })()
        : raw;
      return {
        name: candidate.name,
        description: candidate.description,
        invocation: candidate.invocation,
        provider: candidate.provider,
        source: candidate.source,
        resourceBase: candidate.resourceBase,
        content,
      };
    },
  };
}

export function apply(ctx, config = {}) {
  const normalized = normalizeConfig(config);
  const tool = deckTool(normalized);
  deckTool.config = normalized;
  ctx.tools.register(tool);
  ctx.skills.registerProvider(() => skillProvider());
}
