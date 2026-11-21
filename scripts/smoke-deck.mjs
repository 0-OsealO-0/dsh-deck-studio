// Smoke test for the deck tool's return contract.
//
// It exists because 0.1.1 shipped a `propose` that always failed DSH's output
// validation (after writing its file) and a `check` whose self-audit threw
// ENOENT on every project. Both looked fine in manual use: the files appeared,
// the quality gate reported real numbers. This script drives the real actions
// and validates every return value against deckOutput().schema, so those two
// classes of bug fail here instead of in a user's session.
//
// Run from the plugin root: node scripts/smoke-deck.mjs
import { register } from 'node:module';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

register(new URL('./smoke/hooks.mjs', import.meta.url));

const { apply } = await import(new URL('../index.js', import.meta.url));

const results = [];
function record(name, ok, detail = '') {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? `  — ${detail}` : ''}`);
}

// Deliberately tiny: only the keywords deckOutput().schema actually uses.
function validate(value, schema, where = 'value') {
  const errors = [];
  const fail = (message) => errors.push(`${where}: ${message}`);
  const type = schema?.type;
  if (type === 'json' || !schema) return errors;
  if (type === 'object') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) {
      fail('应为 object');
      return errors;
    }
    const properties = schema.properties ?? {};
    for (const [key, prop] of Object.entries(properties)) {
      if (prop?.required && value[key] === undefined) fail(`缺少必填属性 ${key}`);
      if (value[key] !== undefined) errors.push(...validate(value[key], prop, `${where}.${key}`));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in properties)) fail(`多出未声明属性 ${key}（additionalProperties: false）`);
      }
    }
    return errors;
  }
  if (type === 'array') {
    if (!Array.isArray(value)) {
      fail('应为 array');
      return errors;
    }
    value.forEach((item, index) => errors.push(...validate(item, schema.items ?? {}, `${where}[${index}]`)));
    return errors;
  }
  if (type === 'string' && typeof value !== 'string') fail('应为 string');
  if (type === 'boolean' && typeof value !== 'boolean') fail('应为 boolean');
  if (type === 'integer' && !Number.isInteger(value)) fail('应为 integer');
  return errors;
}

const exists = (target) =>
  fs.access(target).then(
    () => true,
    () => false,
  );

const tmpRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'deck-smoke-'));
const project = path.join(tmpRoot, 'project');

let tool;
const ctx = {
  tools: {
    register(registered) {
      tool = registered;
    },
  },
  skills: { registerProvider() {} },
};

try {
  apply(ctx, {});
  record('apply() 注册了 deck 工具', Boolean(tool));
  if (!tool) throw new Error('没有拿到 deck 工具，后续检查无法进行');

  const expectShape = (label, value) => {
    const errors = validate(value, tool.output?.schema);
    record(`${label} 符合 deckOutput().schema`, errors.length === 0, errors.slice(0, 3).join('; '));
  };

  // 1. propose: the action that 0.1.1 returned as {content,data,artifacts}.
  const propose = await tool.execute({ action: 'propose', project }, {});
  expectShape('propose', propose);
  const optionsFile = path.join(project, 'confirm_ui', 'direction_options.json');
  record('propose 落盘了 confirm_ui/direction_options.json', await exists(optionsFile));
  const options = propose?.data?.options ?? [];
  record('propose 给出三个方向', options.length === 3, `实际 ${options.length}`);

  // 2. init
  const init = await tool.execute(
    { action: 'init', project, force: true, option: options[0]?.id, title: '冒烟测试' },
    {},
  );
  expectShape('init', init);
  record(
    'init 生成了 source.md 与 spec_lock.md',
    (await exists(path.join(project, 'source.md'))) && (await exists(path.join(project, 'spec_lock.md'))),
  );

  // 3. One page with two planted defects: an unregistered font size used three
  //    times, and an <image> whose file is missing.
  await fs.appendFile(
    path.join(project, 'spec_lock.md'),
    '\n## Typography\n- 冒烟标题: 120\n- 冒烟正文: 40\n',
    'utf8',
  );
  await fs.mkdir(path.join(project, 'svg_output'), { recursive: true });
  await fs.writeFile(
    path.join(project, 'svg_output', '01_cover.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#F6F0E4"/>
  <text x="80" y="120" font-size="37" fill="#241F1A">冒烟标题一</text>
  <text x="80" y="200" font-size="37" fill="#241F1A">冒烟标题二</text>
  <text x="80" y="280" font-size="37" fill="#241F1A">冒烟标题三</text>
  <image href="missing-photo.png" x="80" y="320" width="400" height="300"/>
</svg>
`,
    'utf8',
  );

  const checked = await tool.execute({ action: 'check', project }, {});
  expectShape('check', checked);
  const blockers = checked?.data?.blockers ?? [];
  const auditWarnings = checked?.data?.audit?.warnings ?? [];
  record(
    '项目自查真的执行了（没再走 ENOENT 分支）',
    !blockers.some((line) => String(line).includes('项目自查未执行')),
    blockers.slice(0, 2).join(' | '),
  );
  record(
    'audit 抓到未登记字号 37px',
    checked?.data?.audit?.notes?.some((note) => (note?.detail ?? []).some((line) => line.startsWith('37px'))),
    JSON.stringify(checked?.data?.audit?.notes ?? []).slice(0, 200),
  );
  record(
    'audit 抓到缺失图片',
    auditWarnings.some((line) => String(line).includes('图片缺失')),
    auditWarnings.slice(0, 2).join(' | '),
  );

  // 4. review without a live-preview server must be a visible failure, not a
  //    green check with no previews.
  const reviewed = await tool.execute({ action: 'check', project, review: true }, {});
  expectShape('check(review=true)', reviewed);
  record('没有 live-preview 服务时 check 返回 ok=false', reviewed?.ok === false);
  record(
    '未跑视觉回渲写进了 blockers',
    (reviewed?.data?.blockers ?? []).some((line) => String(line).includes('视觉回渲')),
    (reviewed?.data?.blockers ?? []).join(' | ').slice(0, 200),
  );

  // 5. status must tell the caller whether review can work at all.
  const status = await tool.execute({ action: 'status', project }, {});
  expectShape('status', status);
  record(
    'status 暴露 runtime.visualReview.playwright',
    typeof status?.data?.runtime?.visualReview?.playwright === 'boolean',
    JSON.stringify(status?.data?.runtime?.visualReview ?? null),
  );
  record(
    'status 暴露 previewServer.running=false',
    status?.data?.previewServer?.running === false,
    JSON.stringify(status?.data?.previewServer ?? null),
  );
} catch (error) {
  record('冒烟测试未抛错', false, String(error?.message || error));
} finally {
  await fs.rm(tmpRoot, { recursive: true, force: true }).catch(() => {});
}

const failed = results.filter((item) => !item.ok);
console.log(
  failed.length === 0
    ? `\n全部通过（${results.length} 项）`
    : `\n${failed.length}/${results.length} 项失败：\n${failed.map((item) => `- ${item.name}`).join('\n')}`,
);
process.exitCode = failed.length === 0 ? 0 : 1;
