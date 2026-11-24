// Page contracts: the one place that says how much text a formal slide slot can
// hold before the layout breaks.
//
// Why this exists: audits used to check font sizes, images and fonts, but never
// copy length. Every "字太多溢出" defect found in the 2026-11-24 baseline came
// from a page being hand-authored against an imagined budget. The contract turns
// that budget into data, so `check` can refuse a page that has already overflowed
// instead of the user discovering it in a projector.
//
// Pure functions only (no fs, no DSH imports) so scripts/smoke-deck.mjs can drive
// them directly. index.js owns reading/writing page_plan.json.
//
// Counting rule: 1 character = 1 字, CJK or ASCII alike. Deliberately not a
// word/px estimate — an estimate that drifts from what the author sees is worse
// than a crude rule they can predict.

export const PLAN_FILE = 'page_plan.json';
export const PLAN_VERSION = 1;

// Tuned against templates/spec_lock-formal.md type steps (display 120 / title 48 /
// body 28). max values are the point where a single line stops fitting the
// 1280x720 canvas at that step; over-limit is a hard fail, so they are set at the
// first width where wrapping was measured, not at a stylistic preference.
export const ARCHETYPES = {
  cover: {
    id: 'cover',
    label: '封面',
    role: 'cover',
    purpose: '让人 3 秒内知道这是什么场合、值不值得听。只有一个主张。',
    slots: [
      { key: 'title', label: '主标题', min: 2, max: 18, required: true },
      { key: 'subtitle', label: '副标题', min: 0, max: 30 },
      { key: 'meta', label: '元信息（场合 / 日期 / 汇报人）', min: 0, max: 40 },
      { key: 'note', label: '一句话判断', min: 0, max: 24 },
      { key: 'image', label: '背景图（images/xxx.jpg，可留空）', min: 0, max: 200, media: true },
      { key: 'imageFit', label: '图片裁切方式（cover 裁满 / contain 完整显示）', min: 0, max: 12 },
    ],
  },
  statement: {
    id: 'statement',
    label: '观点页',
    role: 'statement',
    purpose: '一页一个主张，配一句支撑。放不下就拆页，不要缩字号。',
    slots: [
      { key: 'kicker', label: '分组标签', min: 0, max: 8 },
      { key: 'headline', label: '一句话主张', min: 4, max: 22, required: true },
      { key: 'body', label: '支撑说明', min: 0, max: 60 },
      { key: 'evidence', label: '证据 / 出处', min: 0, max: 40 },
    ],
  },
  notice: {
    id: 'notice',
    label: '通知页',
    role: 'content',
    purpose: '一句话结论 + 时间地点对象 + 要做什么 + 找谁：班级群通知的固定五段。',
    slots: [
      { key: 'title', label: '一句话结论', min: 4, max: 24, required: true },
      // 时间/地点要放得下"11 月 28 日（周五）14:00–16:00"这种写全的格式。
      { key: 'when', label: '时间', min: 2, max: 26, required: true },
      { key: 'where', label: '地点', min: 2, max: 26, required: true },
      { key: 'who', label: '对象（谁要来）', min: 2, max: 24, required: true },
      { key: 'todo', label: '要带 / 要做的事（每条一行）', min: 0, max: 4, list: true, itemMax: 16 },
      { key: 'note', label: '补充一句（截止、备注）', min: 0, max: 30 },
      { key: 'contact', label: '联系人 / 报名找谁', min: 2, max: 30, required: true },
      { key: 'qr', label: '报名二维码（images/xxx.png，可留空）', min: 0, max: 200, media: true },
      { key: 'qrLabel', label: '二维码下方一句（如「扫码报名」）', min: 0, max: 12 },
    ],
  },

  image: {
    id: 'image',
    label: '图文页',
    role: 'image',
    purpose: '一张现场照片配一句话。照片是主角，文字只负责点题。',
    slots: [
      { key: 'headline', label: '一句话判断', min: 4, max: 20, required: true },
      { key: 'body', label: '补充说明', min: 0, max: 60 },
      { key: 'caption', label: '图注（时间 / 地点 / 拍摄者）', min: 0, max: 24 },
      { key: 'image', label: '照片（images/xxx.jpg）', min: 1, max: 200, media: true, required: true },
      { key: 'imageFit', label: '图片裁切方式（cover 裁满 / contain 完整显示）', min: 0, max: 12 },
    ],
  },
  hero: {
    id: 'hero',
    label: '招新大图页',
    role: 'cover',
    purpose: '一张整页照片压住版面，只留一句主张、时间地点和一句报名号召。',
    slots: [
      { key: 'kicker', label: '活动 / 社团名', min: 2, max: 10, required: true },
      { key: 'title', label: '一句话主张', min: 4, max: 16, required: true },
      { key: 'subtitle', label: '补充一句', min: 0, max: 30 },
      { key: 'when', label: '时间', min: 2, max: 20, required: true },
      { key: 'where', label: '地点', min: 2, max: 20, required: true },
      { key: 'cta', label: '怎么报名（一句话）', min: 2, max: 20, required: true },
      { key: 'image', label: '背景照片（images/xxx.jpg）', min: 0, max: 200, media: true, required: true },
      { key: 'qr', label: '报名二维码（images/xxx.png，可留空）', min: 0, max: 200, media: true },
      { key: 'qrLabel', label: '二维码下方一句（如「扫码报名」）', min: 0, max: 12 },
    ],
  },

  metrics: {
    id: 'metrics',
    label: '数据页',
    role: 'metrics',
    purpose: '2–4 个数字说明一件事。每个值必须带数字，不许写「很多」「大幅」。',
    slots: [
      { key: 'headline', label: '标题', min: 2, max: 20, required: true },
      { key: 'metrics', label: '指标（数值 + 口径，如「42% 参与率」）', min: 2, max: 4, required: true, list: true, itemMax: 16, itemMin: 3, needsDigit: true },
      { key: 'footnote', label: '单位 / 口径说明', min: 0, max: 30 },
    ],
  },
  chart: {
    id: 'chart',
    label: '图表页',
    role: 'metrics',
    purpose: '3–6 根柱子比构成：一眼看出哪一类占大头。每个数必须能核对。',
    slots: [
      { key: 'headline', label: '标题', min: 2, max: 20, required: true },
      { key: 'bars', label: '柱子（标签 + 数值，如「海报 18」）', min: 3, max: 6, required: true, list: true, itemMax: 14, itemMin: 3, needsDigit: true },
      { key: 'unit', label: '单位（如「项」「版」）', min: 0, max: 6 },
      { key: 'note', label: '一句结论', min: 0, max: 40 },
      { key: 'source', label: '数据来源', min: 0, max: 40 },
    ],
  },
  comparison: {
    id: 'comparison',
    label: '对比页',
    role: 'comparison',
    purpose: '两边各一句标题、各自支撑，最后给一句取舍。',
    slots: [
      { key: 'headline', label: '标题', min: 2, max: 18, required: true },
      { key: 'leftTitle', label: '左侧标题', min: 2, max: 8, required: true },
      { key: 'leftBody', label: '左侧支撑', min: 0, max: 60 },
      { key: 'rightTitle', label: '右侧标题', min: 2, max: 8, required: true },
      { key: 'rightBody', label: '右侧支撑', min: 0, max: 60 },
      { key: 'takeaway', label: '结论 / 取舍', min: 0, max: 30 },
      {
        key: 'takeawayAnchor',
        label: '结论位置（auto 自动 / bottom 贴页脚 / flow 紧跟两栏）',
        min: 0,
        max: 8,
        choices: ['auto', 'bottom', 'flow'],
      },
    ],
  },
  process: {
    id: 'process',
    label: '流程页',
    role: 'process',
    purpose: '3–5 步讲清怎么走。步骤多于 5 个说明该合并或拆页。',
    slots: [
      { key: 'headline', label: '标题', min: 2, max: 18, required: true },
      { key: 'steps', label: '步骤', min: 3, max: 5, required: true, list: true, itemMax: 18, itemMin: 2 },
      { key: 'note', label: '说明 / 时间点', min: 0, max: 40 },
    ],
  },
  closing: {
    id: 'closing',
    label: '结尾页',
    role: 'closing',
    purpose: '说清下一步做什么、找谁。不喊口号。',
    slots: [
      { key: 'headline', label: '结论 / 号召', min: 2, max: 14, required: true },
      { key: 'actions', label: '下一步（1–3 条）', min: 1, max: 3, required: true, list: true, itemMax: 18, itemMin: 2 },
      { key: 'contact', label: '联系人 / 方式', min: 0, max: 30 },
    ],
  },
};

export const ARCHETYPE_ORDER = ['cover', 'statement', 'notice', 'image', 'hero', 'metrics', 'chart', 'comparison', 'process', 'closing'];

export function countChars(value) {
  return [...String(value ?? '')].length;
}

// A leading "01　" / "1." / "①" is decoration the layout already draws, so it
// must not eat the slot budget: a real page measured 15 chars purely because of
// its ordinal prefix and tripped a 14-char limit on a 12-char step.
const ORDINAL_PREFIX_RE = /^\s*(?:\d{1,2}[.、)．]\s*|\d{1,2}\u3000+|[①-⑳]\s*)/;

export function stripOrdinal(value) {
  return String(value ?? '').replace(ORDINAL_PREFIX_RE, '');
}

export function normalizeChoice(slot, value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const options = slot.choices ?? [];
  if (!options.length) return raw;
  const hit = options.find((option) => option.toLowerCase() === raw.toLowerCase());
  if (!hit) {
    throw new Error(`槽位「${slot.label}」只接受 ${options.join(' / ')}，收到「${raw}」。`);
  }
  return hit;
}

export function getArchetype(id) {
  return ARCHETYPES[String(id ?? '').trim()] ?? null;
}

function slotValueOk(slot, value) {
  if (Array.isArray(value)) return slot.list === true;
  return typeof value === 'string';
}

// Image slots hold a path, not copy, so they get a path check instead of a
// character budget. Absolute paths and remote URLs are rejected: the exporter
// resolves hrefs inside the project, so either one exports a blank frame.
const MEDIA_EXT_RE = /\.(?:png|jpe?g|webp|gif|bmp|tif?f|svg)$/i;

export function normalizeMediaPath(value) {
  return String(value ?? '')
    .trim()
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^(?:\.\.\/)+/, '');
}

export function mediaProblem(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '没有填图片路径';
  if (/^[a-z][a-z0-9+.-]*:/i.test(raw)) return `用了外链（${raw.slice(0, 24)}…）；导出时读不到，先把图片放进 images/`;
  if (raw.startsWith('/') || /^[A-Za-z]:/.test(raw)) return '用了绝对路径；改成相对项目根的 images/xxx.jpg';
  if (!MEDIA_EXT_RE.test(raw)) return '看不出是图片文件（支持 png / jpg / webp / gif / bmp / tif / svg）';
  return null;
}

function auditSlot(file, slot, value, push) {
  const label = `${slot.label}`;
  if (slot.list) {
    if (value.length < slot.min) {
      push({ file, slot: slot.key, kind: 'under', message: `${label} 只有 ${value.length} 条，至少 ${slot.min} 条。` });
    }
    if (value.length > slot.max) {
      push({ file, slot: slot.key, kind: 'over', message: `${label} 有 ${value.length} 条，最多 ${slot.max} 条。` });
    }
    value.forEach((item, index) => {
      const text = String(item ?? '');
      const counted = stripOrdinal(text);
      const n = countChars(counted);
      if (n < (slot.itemMin ?? 1)) {
        push({ file, slot: slot.key, kind: 'under', message: `${label} 第 ${index + 1} 条只有 ${n} 字，像是没写完。` });
      }
      if (slot.itemMax && n > slot.itemMax) {
        push({
          file,
          slot: slot.key,
          kind: 'over',
          message: `${label} 第 ${index + 1} 条 ${n} 字，超了 ${n - slot.itemMax} 字（上限 ${slot.itemMax}，序号前缀不计）。`,
        });
      }
      if (slot.needsDigit && !/\d/.test(text)) {
        push({ file, slot: slot.key, kind: 'vague', message: `${label} 第 ${index + 1} 条「${text.slice(0, 12)}」没有数字；数据页的指标要能核对。` });
      }
    });
    return;
  }

  const text = String(value ?? '');
  const n = countChars(text);
  if (n === 0) return;
  if (n < slot.min) {
    push({ file, slot: slot.key, kind: 'under', message: `${label} 只写了 ${n} 字，少于 ${slot.min} 字。` });
  }
  if (n > slot.max) {
    push({ file, slot: slot.key, kind: 'over', message: `${label} ${n} 字，超了 ${n - slot.max} 字（上限 ${slot.max}）。` });
  }
}

// Audit one page_plan.json against the contract table. Returns violations as
// data (not exceptions) so the caller decides whether they block.
export function auditPlan(plan, { svgFiles = [], profile = 'formal', images = null } = {}) {
  const violations = [];
  const warnings = [];
  const usage = [];
  const push = (item) => violations.push(item);

  if (!plan || typeof plan !== 'object' || Array.isArray(plan)) {
    return {
      present: true,
      valid: false,
      violations: [{ file: PLAN_FILE, slot: '', kind: 'shape', message: `${PLAN_FILE} 顶层必须是一个对象。` }],
      warnings,
      usage,
      counts: { pages: 0, violations: 1, warnings: 0 },
    };
  }

  if (plan.version !== undefined && plan.version !== PLAN_VERSION) {
    warnings.push(`${PLAN_FILE} 的 version 是 ${plan.version}，当前契约版本是 ${PLAN_VERSION}；按当前版本解释。`);
  }
  const planProfile = String(plan.profile ?? profile);
  if (planProfile !== profile) {
    warnings.push(`${PLAN_FILE} 声明 profile=${planProfile}，项目是 ${profile}；契约表目前只覆盖 formal。`);
  }

  const pages = Array.isArray(plan.pages) ? plan.pages : [];
  if (!Array.isArray(plan.pages)) {
    push({ file: PLAN_FILE, slot: 'pages', kind: 'shape', message: `${PLAN_FILE} 的 pages 必须是数组。` });
  }

  const declaredFiles = new Set();
  const knownFiles = new Set(svgFiles.map((file) => file.split(/[\\/]/).pop()));

  pages.forEach((page, index) => {
    const where = `${PLAN_FILE} pages[${index}]`;
    if (!page || typeof page !== 'object' || Array.isArray(page)) {
      push({ file: where, slot: '', kind: 'shape', message: `第 ${index + 1} 页必须是一个对象。` });
      return;
    }
    const file = String(page.file ?? '').trim();
    if (!file) {
      push({ file: where, slot: 'file', kind: 'shape', message: `第 ${index + 1} 页缺少 file（如 01_cover.svg）。` });
    } else if (declaredFiles.has(file)) {
      push({ file, slot: 'file', kind: 'duplicate', message: `${file} 在契约里声明了两次。` });
    } else {
      declaredFiles.add(file);
      if (svgFiles.length > 0 && !knownFiles.has(file)) {
        warnings.push(`契约声明了 ${file}，但 svg_output/ 里没有这个文件。`);
      }
    }

    const archetype = getArchetype(page.archetype);
    if (!archetype) {
      push({
        file: file || where,
        slot: 'archetype',
        kind: 'archetype',
        message: `未知原型「${page.archetype ?? ''}」；可用：${ARCHETYPE_ORDER.join(', ')}。`,
      });
      return;
    }

    const text = page.text && typeof page.text === 'object' && !Array.isArray(page.text) ? page.text : {};
    if (!page.text || typeof page.text !== 'object' || Array.isArray(page.text)) {
      push({ file: file || where, slot: 'text', kind: 'shape', message: `第 ${index + 1} 页的 text 必须是对象（槽位名 → 文本）。` });
    }

    const slotsByKey = new Map(archetype.slots.map((slot) => [slot.key, slot]));
    for (const key of Object.keys(text)) {
      if (!slotsByKey.has(key)) {
        warnings.push(`${file || where}：槽位「${key}」不在 ${archetype.label} 契约里，未做字数校验（可用：${[...slotsByKey.keys()].join(', ')}）。`);
      }
    }

    for (const slot of archetype.slots) {
      const has = Object.prototype.hasOwnProperty.call(text, slot.key) && text[slot.key] !== '';
      if (!has) {
        if (slot.required) {
          push({ file: file || where, slot: slot.key, kind: 'missing', message: `${archetype.label}缺少必填槽位「${slot.label}」。` });
        }
        continue;
      }
      const value = text[slot.key];
      if (slot.media) {
        const problem = mediaProblem(value);
        if (problem) {
          push({ file: file || where, slot: slot.key, kind: 'media', message: `${slot.label}：${problem}。` });
        } else if (Array.isArray(images) && !images.includes(normalizeMediaPath(value))) {
          warnings.push(`${file || where}：图片 ${normalizeMediaPath(value)} 不在 images/ 里，导出会缺图。`);
        }
        usage.push({
          file: file || where,
          archetype: archetype.id,
          slot: slot.key,
          label: slot.label,
          used: 1,
          max: 1,
          unit: '张',
        });
        continue;
      }
      if (!slotValueOk(slot, value)) {
        push({
          file: file || where,
          slot: slot.key,
          kind: 'shape',
          message: `${slot.label} 应为${slot.list ? '字符串数组' : '字符串'}，实际是 ${Array.isArray(value) ? 'array' : typeof value}。`,
        });
        continue;
      }
      if (slot.choices && !slot.choices.some((option) => option.toLowerCase() === String(value).trim().toLowerCase())) {
        push({
          file: file || where,
          slot: slot.key,
          kind: 'vague',
          message: `${slot.label} 只接受 ${slot.choices.join(' / ')}，收到「${String(value).trim()}」。`,
        });
        continue;
      }
      auditSlot(file || where, slot, value, push);
      usage.push({
        file: file || where,
        archetype: archetype.id,
        slot: slot.key,
        label: slot.label,
        used: slot.list ? value.length : countChars(value),
        max: slot.max,
        unit: slot.list ? '条' : '字',
      });
    }
  });

  const declared = new Set([...declaredFiles].map((file) => file.split(/[\\/]/).pop()));
  if (declaredFiles.size > 0 && svgFiles.length > 0) {
    const uncovered = svgFiles.map((file) => file.split(/[\\/]/).pop()).filter((file) => !declared.has(file));
    if (uncovered.length) {
      warnings.push(`这些页面没有契约声明，字数审计跳过了它们：${uncovered.join(', ')}。`);
    }
  } else if (declaredFiles.size === 0 && svgFiles.length > 0) {
    warnings.push(`${PLAN_FILE} 里没有声明任何页面，字数审计整册跳过。`);
  }

  return {
    present: true,
    valid: !violations.some((item) => item.kind === 'shape' || item.kind === 'archetype'),
    violations,
    warnings,
    usage,
    counts: { pages: pages.length, violations: violations.length, warnings: warnings.length },
  };
}

export function missingPlan(svgFiles = []) {
  return {
    present: false,
    valid: null,
    violations: [],
    warnings: svgFiles.length
      ? [`没有 ${PLAN_FILE}：本册 ${svgFiles.length} 页的字数契约未声明，字数审计跳过（deck brief 给槽位预算）。`]
      : [],
    usage: [],
    counts: { pages: 0, violations: 0, warnings: 0 },
  };
}

// The menu deck(brief) prints when there is no page_plan.json yet: one block per
// archetype with the exact slot budgets. Written to be copy-pasted into a plan.
export function planMenuText() {
  const lines = [];
  for (const id of ARCHETYPE_ORDER) {
    const archetype = ARCHETYPES[id];
    lines.push(`- ${archetype.id}（${archetype.label}）：${archetype.purpose}`);
    for (const slot of archetype.slots) {
      const bits = [];
      if (slot.required) bits.push('必填');
      if (slot.media) {
        bits.push('图片路径，如 images/photo.jpg');
      } else if (slot.list) {
        bits.push(`${slot.min}–${slot.max} 条`);
        if (slot.itemMax) bits.push(`每条 ≤ ${slot.itemMax} 字`);
        if (slot.needsDigit) bits.push('必须含数字');
      } else if (slot.choices) {
        bits.push(`可选 ${slot.choices.join(' / ')}`);
      } else {
        bits.push(slot.min > 0 ? `${slot.min}–${slot.max} 字` : `≤ ${slot.max} 字`);
      }
      lines.push(`  - ${slot.key}（${slot.label}）：${bits.join('，')}`);
    }
  }
  return lines.join('\n');
}

// A ready-to-edit skeleton for the most common deck shape (封面 → 观点 → 数据 →
// 结尾). Kept short on purpose: an agent should delete/add pages, not fill a wall.
export function planSkeletonText() {
  const skeleton = {
    version: PLAN_VERSION,
    profile: 'formal',
    pages: [
      { file: '01_cover.svg', archetype: 'cover', text: { title: '', subtitle: '', meta: '' } },
      { file: '02_statement.svg', archetype: 'statement', text: { headline: '', body: '' } },
      { file: '03_metrics.svg', archetype: 'metrics', text: { headline: '', metrics: ['', ''], footnote: '' } },
      { file: '04_closing.svg', archetype: 'closing', text: { headline: '', actions: [''], contact: '' } },
    ],
  };
  const lines = [];
  for (const id of ARCHETYPE_ORDER) {
    const archetype = ARCHETYPES[id];
    const slots = archetype.slots.map((slot) => {
      if (slot.media) return `${slot.key}: images/photo.jpg`;
      return slot.list ? `${slot.key}: [${slot.required ? '至少一条' : ''}]` : `${slot.key}: 文本`;
    });
    lines.push(`- ${id}（${archetype.label}）：${slots.join(' / ')}`);
  }
  return { skeleton, text: JSON.stringify(skeleton, null, 2), slots: lines.join('\n') };
}

export function formatViolations(violations, limit = 8) {
  return violations.slice(0, limit).map((item) => `${item.file}: ${item.message}`);
}
