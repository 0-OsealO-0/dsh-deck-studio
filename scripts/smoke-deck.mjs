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
  record(
    'propose 给出三个方向',
    options.length === 3,
    `实际 ${options.length}`,
  );
  const optionDoc = String(tool?.parameters?.option?.description ?? '');
  record(
    'option 说明按 profile 分组举例（含 campaign 的 id）',
    optionDoc.includes('warm-orange') && optionDoc.includes('navy-brief') && optionDoc.includes('warm-paper'),
    optionDoc.slice(0, 160),
  );

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
    '\n## Typography\n- 冒烟标题: 120\n- 冒烟正文: 40\n- smoke_family: Definitely Missing Font 123\n',
    'utf8',
  );
  await fs.mkdir(path.join(project, 'svg_output'), { recursive: true });
  await fs.writeFile(
    path.join(project, 'svg_output', '01_cover.svg'),
    `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <rect width="1280" height="720" fill="#F6F0E4"/>
  <text x="80" y="120" font-size="37" font-family="微软雅黑" fill="#241F1A">冒烟标题一</text>
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
  record(
    'audit 抓到本机没装的声明字体',
    auditWarnings.some((line) => String(line).includes('本机没装')),
    auditWarnings.slice(0, 3).join(' | '),
  );
  const hints = checked?.data?.hints ?? [];
  record(
    '质量门报错带出了改法提示（中文族名 → Microsoft YaHei）',
    hints.some((hint) => String(hint).includes('Microsoft YaHei')),
    hints.join(' | ').slice(0, 200),
  );
  record(
    'check 的 message 里有「常见改法」段',
    String(checked?.message ?? '').includes('常见改法'),
    String(checked?.message ?? '').slice(-160),
  );

  // 4. Page contract (v0.2.0). A legacy project without page_plan.json must stay
  //    green, and brief must hand back usable slot budgets instead of failing.
  const brief0 = await tool.execute({ action: 'brief', project }, {});
  expectShape('brief（无契约）', brief0);
  record(
    '没有 page_plan.json 时 brief 说清楚并给出槽位预算',
    brief0?.ok === false &&
      String(brief0?.message ?? '').includes('page_plan.json') &&
      String(brief0?.message ?? '').includes('metrics'),
    String(brief0?.message ?? '').slice(0, 120),
  );
  record(
    'brief 的 data 带 9 个原型与可编辑骨架',
    Array.isArray(brief0?.data?.archetypes) &&
      brief0.data.archetypes.length === 9 &&
      Array.isArray(brief0?.data?.skeleton?.pages),
    JSON.stringify(brief0?.data?.archetypes ?? null),
  );
  // The fixture's 1280x720 canvas and missing <image> already fail the quality
  // gate (by design), so "backward compatible" here means: no plan file => no
  // contract blocker, and the audit still ran.
  record(
    '旧稿（无契约）不会被字数契约拦下',
    checked?.data?.plan?.present === false && (checked?.data?.blockers ?? []).length === 0,
    JSON.stringify({
      ok: checked?.ok,
      exitCode: checked?.data?.exitCode,
      blockers: checked?.data?.blockers,
    }),
  );

  const planPath = path.join(project, 'page_plan.json');
  await fs.writeFile(
    planPath,
    JSON.stringify(
      {
        version: 1,
        profile: 'formal',
        pages: [
          { file: '01_cover.svg', archetype: 'cover', text: { title: '冒烟测试', subtitle: '契约', meta: '2026-11-24' } },
          {
            file: '02_statement.svg',
            archetype: 'statement',
            text: {
              headline: '这句主张故意写到远超二十二个字的上限用来确认字数契约真的会拦住超版页面的文案',
            },
          },
          { file: '03_unknown.svg', archetype: 'nope', text: {} },
          { file: '04_metrics.svg', archetype: 'metrics', text: { headline: '数据', metrics: ['很多', '42% 参与率'] } },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const checkedPlan = await tool.execute({ action: 'check', project }, {});
  expectShape('check（契约违规）', checkedPlan);
  record(
    '超限文案被判 blocker',
    checkedPlan?.ok === false &&
      (checkedPlan?.data?.blockers ?? []).some((line) => String(line).includes('超了')),
    (checkedPlan?.data?.blockers ?? []).join(' | ').slice(0, 240),
  );
  record(
    '未知原型被抓住',
    (checkedPlan?.data?.plan?.violations ?? []).some((item) => item?.kind === 'archetype'),
    JSON.stringify(checkedPlan?.data?.plan?.violations ?? []).slice(0, 240),
  );
  record(
    '指标没数字被判「很多」这类空话',
    (checkedPlan?.data?.plan?.violations ?? []).some((item) => item?.kind === 'vague'),
    JSON.stringify(checkedPlan?.data?.plan?.violations ?? []).slice(0, 240),
  );
  record(
    '契约声明了不存在的页面只给 warning',
    (checkedPlan?.data?.plan?.warnings ?? []).some((line) => String(line).includes('02_statement.svg')),
    JSON.stringify(checkedPlan?.data?.plan?.warnings ?? []).slice(0, 200),
  );

  let exportBlocked = '';
  try {
    await tool.execute({ action: 'export', project, force: true }, {});
  } catch (error) {
    exportBlocked = String(error?.message || error);
  }
  record(
    '导出被超限文案挡住（在跑 python 质量门之前）',
    exportBlocked.includes('字数契约未通过'),
    exportBlocked.slice(0, 200),
  );

  await fs.writeFile(
    planPath,
    JSON.stringify(
      {
        version: 1,
        profile: 'formal',
        pages: [
          { file: '01_cover.svg', archetype: 'cover', text: { title: '冒烟测试', subtitle: '字数契约', meta: '2026-11-24' } },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );
  const brief1 = await tool.execute({ action: 'brief', project }, {});
  expectShape('brief（修好契约后）', brief1);
  record(
    '修好契约后 brief 通过并报预算占用',
    brief1?.ok === true && String(brief1?.message ?? '').includes('主标题'),
    String(brief1?.message ?? '').slice(0, 200),
  );

  // 4b. scaffold: the skeleton renderer is the only place pages are drawn
  //     without a model in the loop, so its contract and its idempotence both
  //     need a test.
  const scaffoldProject = path.join(tmpRoot, 'scaffold');
  await fs.mkdir(scaffoldProject, { recursive: true });
  await fs.copyFile(path.join(project, 'spec_lock.md'), path.join(scaffoldProject, 'spec_lock.md'));

  let noPlanError = '';
  try {
    await tool.execute({ action: 'scaffold', project: scaffoldProject }, {});
  } catch (error) {
    noPlanError = String(error?.message || error);
  }
  record('scaffold 没有 page_plan.json 时指回 brief', noPlanError.includes('page_plan.json'), noPlanError.slice(0, 160));

  await fs.writeFile(
    path.join(scaffoldProject, 'page_plan.json'),
    JSON.stringify(
      {
        version: 1,
        profile: 'formal',
        pages: [
          { file: '01_cover.svg', archetype: 'cover', text: { title: '骨架冒烟', subtitle: '同一份文案', meta: '2026-11-24' } },
          { file: '02_statement.svg', archetype: 'statement', text: { kicker: '判断', headline: '先有骨架再谈好看', body: '每页只讲一件事，版式由原型决定，不靠临场发挥。' } },
          { file: '03_closing.svg', archetype: 'closing', text: { headline: '下一步', actions: ['跑质量门', '导出 PPTX'], contact: '宣传委员' } },
        ],
      },
      null,
      2,
    ),
    'utf8',
  );

  const scaffolded = await tool.execute({ action: 'scaffold', project: scaffoldProject, theme: 'navy-brief' }, {});
  expectShape('scaffold', scaffolded);
  const scaffoldSvgs = ['01_cover.svg', '02_statement.svg', '03_closing.svg'];
  const writtenTexts = await Promise.all(
    scaffoldSvgs.map((file) => fs.readFile(path.join(scaffoldProject, 'svg_output', file), 'utf8').catch(() => '')),
  );
  record(
    'scaffold 按契约写出 3 页并带上主题与原型标记',
    scaffolded?.ok === true &&
      scaffoldSvgs.every((_, index) => writtenTexts[index].includes('deck-scaffold theme="navy-brief"')) &&
      writtenTexts.every((svg) => svg.includes('viewBox="0 0 1600 900"')),
    JSON.stringify(scaffolded?.data?.written?.map((page) => page.file) ?? null),
  );
  record(
    'scaffold 把 spec_lock 的字号阶梯对齐到主题',
    (scaffolded?.data?.updatedRoles ?? []).some((line) => String(line).includes('body: 20 → 24')) &&
      String(await fs.readFile(path.join(scaffoldProject, 'spec_lock.md'), 'utf8')).includes('body: 24'),
    JSON.stringify(scaffolded?.data?.updatedRoles ?? null),
  );
  record(
    'scaffold 的 data 带主题清单',
    Array.isArray(scaffolded?.data?.themes) && scaffolded.data.themes.includes('blueprint-seu'),
    JSON.stringify(scaffolded?.data?.themes ?? null),
  );

  const scaffoldAgain = await tool.execute({ action: 'scaffold', project: scaffoldProject, theme: 'navy-brief' }, {});
  record(
    'scaffold 不覆盖已生成的页面（跳过 3 页）',
    (scaffoldAgain?.data?.skipped ?? []).length === 3 && (scaffoldAgain?.data?.written ?? []).length === 0,
    JSON.stringify({ written: scaffoldAgain?.data?.written, skipped: scaffoldAgain?.data?.skipped }),
  );

  let badThemeError = '';
  try {
    await tool.execute({ action: 'scaffold', project: scaffoldProject, theme: 'nope', force: true }, {});
  } catch (error) {
    badThemeError = String(error?.message || error);
  }
  record('未知主题报错并列出可用主题', badThemeError.includes('paper-stamp'), badThemeError.slice(0, 160));

  const { renderPage } = await import(new URL('../lib/skeleton.mjs', import.meta.url));
  const { getTheme } = await import(new URL('../lib/themes.mjs', import.meta.url));
  const sample = { archetype: 'statement', variant: 'impact', text: { headline: '同一句话两套语言', body: '结构不变，只换配色、字阶与边框。' } };
  const first = renderPage(sample, { theme: getTheme('paper-stamp'), pageNumber: 1, total: 1 });
  const second = renderPage(sample, { theme: getTheme('paper-stamp'), pageNumber: 1, total: 1 });
  const other = renderPage(sample, { theme: getTheme('print-mono'), pageNumber: 1, total: 1 });
  record('骨架渲染是纯函数（同输入同输出）', first === second && first.length > 200);
  record(
    '同一内容换主题后版面语言不同、文字相同',
    first !== other &&
      (first.match(/<tspan/g) ?? []).length === (other.match(/<tspan/g) ?? []).length &&
      other.includes('同一句话两套语言'),
  );

  // 4b0. themes: every registered visual language must draw every archetype,
  //      and every one of them must be listed in the font-licence registry.
  const { THEMES, THEME_IDS, ARCHETYPE_IDS } = await import(new URL('../lib/skeleton.mjs', import.meta.url))
    .then(async (skeleton) => ({ ...(await import(new URL('../lib/themes.mjs', import.meta.url))), ARCHETYPE_IDS: skeleton.ARCHETYPE_IDS }));
  const themeFails = [];
  for (const id of THEME_IDS) {
    const theme = THEMES[id];
    for (const archetype of ARCHETYPE_IDS) {
      try {
        const svg = renderPage(
          { archetype, variant: 'impact', text: { title: '标题', kicker: '社团', headline: '标题一句话', metrics: ['4 场活动'], steps: ['一', '二', '三'], actions: ['一'], image: 'images/x.jpg', when: '11-24', where: '报告厅', cta: '扫码报名' } },
          { theme, pageNumber: 1, total: 1 },
        );
        if (!svg.includes('<svg') || svg.length < 200) themeFails.push(`${id}/${archetype}: 空`);
      } catch (error) {
        themeFails.push(`${id}/${archetype}: ${String(error?.message || error)}`);
      }
    }
  }
  record('每套主题都能画出全部原型', themeFails.length === 0 && THEME_IDS.length === 7, themeFails.join(' | ') || `${THEME_IDS.length} 主题 × ${ARCHETYPE_IDS.length} 原型`);

  const fontDoc = await fs.readFile(new URL('../docs/theme-fonts.md', import.meta.url), 'utf8');
  const undocumented = THEME_IDS.filter((id) => !fontDoc.includes(id));
  record('主题都登记在字体授权表里', undocumented.length === 0, undocumented.join(', ') || 'docs/theme-fonts.md');

  const { auditPlan } = await import(new URL('../lib/page-contracts.mjs', import.meta.url));

  // 4b0b. hero: a full-bleed photo page must render the photo, a CTA chip and
  //       the when/where line, and the audit must demand all three.
  const heroSvg = renderPage(
    {
      archetype: 'hero',
      variant: 'impact',
      text: { kicker: '社团', title: '秋季招新，找会讲故事的人', when: '11-28 19:00', where: '人文楼 302', cta: '扫码进群', image: 'images/x.jpg' },
    },
    { theme: getTheme('neon-cyan'), pageNumber: 1, total: 3 },
  );
  record(
    '招新大图页：整页照片 + 报名按钮 + 时间地点',
    heroSvg.includes('width="1600" height="900" preserveAspectRatio="xMidYMid slice"') &&
      heroSvg.includes('id="hero-cta-chip"') &&
      heroSvg.includes('id="hero-info"') &&
      heroSvg.includes('11-28 19:00'),
    heroSvg.slice(0, 120),
  );
  const heroAudit = auditPlan(
    {
      version: 1,
      profile: 'campaign',
      pages: [{ file: '01_hero.svg', archetype: 'hero', text: { kicker: '社团', title: '秋季招新', when: '11-28', where: '人文楼', image: 'images/x.jpg' } }],
    },
    { svgFiles: ['01_hero.svg'], profile: 'campaign', images: ['images/x.jpg'] },
  );
  record(
    '招新大图页缺报名号召会被当成必填缺失',
    heroAudit.violations.some((item) => item.kind === 'missing' && String(item.message).includes('报名')),
    JSON.stringify(heroAudit.violations.map((item) => item.message)),
  );

  // 4b0c. notice: the class-group notice has a fixed five-part shape, and the
  //       audit must demand the parts a reader would look for first.
  const noticeSvg = renderPage(
    {
      archetype: 'notice',
      variant: 'impact',
      text: { title: '本周五团日活动，全体到场', when: '11-28 14:00', where: '人文楼 302', who: '全班同学', todo: ['带学生证'], note: '请假提前说', contact: '找宣传委员' },
    },
    { theme: getTheme('paper-stamp'), pageNumber: 1, total: 2 },
  );
  record(
    '通知页：时间地点对象 + 勾选清单 + 联系人',
    noticeSvg.includes('id="notice-when"') &&
      noticeSvg.includes('id="notice-where"') &&
      noticeSvg.includes('id="notice-todo-1"') &&
      noticeSvg.includes('id="notice-contact"'),
    noticeSvg.slice(0, 100),
  );
  const noticeAudit = auditPlan(
    { version: 1, profile: 'formal', pages: [{ file: '01_notice.svg', archetype: 'notice', text: { title: '开会通知', when: '11-28', where: '302', contact: '找班长' } }] },
    { svgFiles: ['01_notice.svg'], profile: 'formal', images: [] },
  );
  record(
    '通知页缺"对象"会被当成必填缺失',
    noticeAudit.violations.some((item) => item.kind === 'missing' && String(item.message).includes('对象')),
    JSON.stringify(noticeAudit.violations.map((item) => item.message)),
  );

  // 4b0d. qr: a signup QR is a white card with a dark label, on both the hero
  //       and the notice, and the label colour must not follow the theme.
  const qrHero = renderPage(
    {
      archetype: 'hero',
      variant: 'impact',
      text: { kicker: '招新', title: '秋季招新', when: '11-28 19:00', where: '人文楼 302', cta: '扫码报名', image: 'images/x.jpg', qr: 'images/qr.png', qrLabel: '扫码填表' },
    },
    { theme: getTheme('neon-cyan'), pageNumber: 1, total: 1 },
  );
  const qrNotice = renderPage(
    {
      archetype: 'notice',
      variant: 'impact',
      text: { title: '征稿延期', when: '11-20', where: '线上', who: '全院', contact: '找学术部', qr: 'images/qr.png', qrLabel: '扫码投稿' },
    },
    { theme: getTheme('ink-water'), pageNumber: 1, total: 1 },
  );
  record(
    '二维码：白卡 + 深色标签（hero 与 notice 都支持）',
    qrHero.includes('id="qr-card"') &&
      qrHero.includes('fill=\"#1B2430\"') &&
      qrNotice.includes('id="qr-card"') &&
      qrNotice.includes('href=\"../images/qr.png\"'),
    qrHero.slice(0, 100),
  );
  const qrAudit = auditPlan(
    { version: 1, profile: 'campaign', pages: [{ file: '01_hero.svg', archetype: 'hero', text: { kicker: 'x', title: '招新', when: '11-28', where: '302', cta: '报名', image: 'images/x.jpg', qr: 'https://example.com/qr.png' } }] },
    { svgFiles: ['01_hero.svg'], profile: 'campaign', images: ['images/x.jpg'] },
  );
  record(
    '二维码不接受外链',
    qrAudit.violations.some((item) => item.kind === 'media' && String(item.message).includes('二维码')),
    JSON.stringify(qrAudit.violations.map((item) => item.message)),
  );

  // 4b1. takeawayAnchor: the comparison conclusion is pinned by a slot switch
  //      instead of only by leftover space, so a page can force either reading.
  const cmp = {
    archetype: 'comparison',
    variant: 'density',
    text: {
      headline: '两条产出线，共用一套物料',
      leftTitle: '活动宣传',
      leftBody: '海报、展板、二维码：对外传播，先定版式再上素材。',
      rightTitle: '内容分享',
      rightBody: '读书会文稿与六页 PPT：对内讲述，先定主张再配图。',
      takeaway: '共用：色卡、字体、二维码、模板库',
    },
  };
  const takeawayY = (svg) => Number((svg.match(/<text id="takeaway" x="[^"]*" y="([\d.]+)"/) ?? [])[1] ?? 0);
  const flowY = takeawayY(
    renderPage({ ...cmp, text: { ...cmp.text, takeawayAnchor: 'flow' } }, { theme: getTheme('paper-stamp'), pageNumber: 5, total: 8 }),
  );
  const bottomY = takeawayY(
    renderPage({ ...cmp, text: { ...cmp.text, takeawayAnchor: 'bottom' } }, { theme: getTheme('paper-stamp'), pageNumber: 5, total: 8 }),
  );
  record('takeawayAnchor=bottom 把结论压到页脚、flow 让它紧跟两栏', bottomY > flowY + 150, `${flowY} → ${bottomY}`);

  const badChoice = auditPlan(
    {
      version: 1,
      profile: 'formal',
      pages: [{ file: '05_comparison.svg', archetype: 'comparison', text: { ...cmp.text, takeawayAnchor: 'middle' } }],
    },
    { svgFiles: ['05_comparison.svg'], profile: 'formal', images: [] },
  );
  record(
    'takeawayAnchor 只接受 auto / bottom / flow，写错会被点名',
    badChoice.violations.some((item) => String(item.message).includes('auto / bottom / flow')),
    JSON.stringify(badChoice.violations.map((item) => item.message)),
  );

  // 4b2. images: a media slot is a path contract, not free text — the renderer
  //      must prefix ../images in the SVG (browser vs converter roots) while the
  //      audit rejects anything that is not a local image file.
  const imagePage = {
    archetype: 'image',
    variant: 'impact',
    text: { headline: '先拍全景，再补细节', body: '站在入口拍一张能看出人数和布置的横图。', image: 'images/photo.jpg' },
  };
  const imageSvg = renderPage(imagePage, { theme: getTheme('paper-stamp'), pageNumber: 2, total: 4 });
  record(
    '图文页把照片写成半幅 <image> 并补 ../images 前缀',
    imageSvg.includes('<image') && imageSvg.includes('href="../images/photo.jpg"') && imageSvg.includes('x="780"'),
    imageSvg.slice(imageSvg.indexOf('<image'), imageSvg.indexOf('<image') + 140),
  );
  const splitBase = renderPage(imagePage, { theme: getTheme('paper-stamp'), pageNumber: 2, total: 4 }, { part: 'base' });
  const splitText = renderPage(imagePage, { theme: getTheme('paper-stamp'), pageNumber: 2, total: 4 }, { part: 'text' });
  record(
    '混合导出可拆分背景层与文字层',
    splitBase.includes('<image') &&
      !splitBase.includes('<g id="content"') &&
      splitText.includes('<g id="content"') &&
      !splitText.includes('<image'),
    JSON.stringify({ base: splitBase.length, text: splitText.length }),
  );
  // A 5:3 poster in the portrait frame is cropped to ribbons by `slice`;
  // imageFit=contain must letterbox it instead (found on a real deck).
  const containSvg = renderPage(
    { ...imagePage, text: { ...imagePage.text, imageFit: 'contain' } },
    { theme: getTheme('paper-stamp'), pageNumber: 2, total: 4 },
  );
  record(
    '图片槽位支持 imageFit=contain（整图显示 + 底色留白）',
    containSvg.includes('xMidYMid meet') && containSvg.includes('fill="#F7F7F4"'),
    containSvg.slice(containSvg.indexOf('<g id="media"'), containSvg.indexOf('<g id="media"') + 200),
  );
  const { mediaProblem } = await import(new URL('../lib/page-contracts.mjs', import.meta.url));
  record(
    '图片槽位拒绝外链与非图片文件',
    Boolean(mediaProblem('http://example.com/a.jpg')) && Boolean(mediaProblem('images/notes.txt')) && !mediaProblem('images/photo.jpg'),
    JSON.stringify({ remote: mediaProblem('http://example.com/a.jpg'), text: mediaProblem('images/notes.txt') }),
  );
  const statusWithBrowser = await tool.execute({ action: 'status', project: scaffoldProject }, {});
  record(
    'status 报告混合导出所需的浏览器',
    typeof statusWithBrowser?.data?.runtime?.browser?.path === 'string' &&
      typeof statusWithBrowser?.data?.runtime?.browser?.mixedExport === 'boolean',
    JSON.stringify(statusWithBrowser?.data?.runtime?.browser ?? null),
  );

  // 4c. edit: the browser editor inlines the same renderer, so a page saved
  //     there must be byte-identical to a scaffold of the same contract.
  const planlessProject = path.join(tmpRoot, 'planless');
  await fs.mkdir(planlessProject, { recursive: true });
  let editNoPlanError = '';
  try {
    await tool.execute({ action: 'edit', project: planlessProject }, {});
  } catch (error) {
    editNoPlanError = String(error?.message || error);
  }
  record('edit 没有 page_plan.json 时指回 brief', editNoPlanError.includes('page_plan.json'), editNoPlanError.slice(0, 160));

  const edited = await tool.execute({ action: 'edit', project: scaffoldProject }, {});
  expectShape('edit', edited);
  const editPath = edited?.data?.output ?? '';
  const editHtml = editPath ? await fs.readFile(editPath, 'utf8').catch(() => '') : '';
  record(
    'edit 写出单文件编辑器（页数、主题、无外链脚本）',
    edited?.ok === true &&
      edited?.data?.pages === 3 &&
      edited?.data?.theme === 'navy-brief' &&
      editHtml.includes('window.__deckEditor') &&
      !editHtml.includes('<script src='),
    JSON.stringify({ path: editPath, pages: edited?.data?.pages, theme: edited?.data?.theme }),
  );
  record(
    '编辑器内联了契约、渲染器与当前文案，没有残留占位符',
    editHtml.includes('ARCHETYPES') &&
      editHtml.includes('renderPage(page, ctx,') &&
      editHtml.includes('骨架冒烟') &&
      editHtml.includes('01_cover.svg') &&
      !editHtml.includes('__THEMES__') &&
      !editHtml.includes('__DATA__'),
    editHtml.slice(0, 120),
  );

  let editExistsError = '';
  try {
    await tool.execute({ action: 'edit', project: scaffoldProject }, {});
  } catch (error) {
    editExistsError = String(error?.message || error);
  }
  record('edit 不覆盖已存在的编辑器（需 force）', editExistsError.includes('force'), editExistsError.slice(0, 160));

  // 6. native pages: the plan is a file contract. Bad entries must be reported
  //    per field, and a project without a plan must say the export stays vector.
  const nativeProject = path.join(tmpRoot, 'native');
  await fs.mkdir(path.join(nativeProject, 'svg_output'), { recursive: true });
  await fs.writeFile(path.join(nativeProject, 'spec_lock.md'), await fs.readFile(path.join(tmpRoot, 'scaffold', 'spec_lock.md'), 'utf8'));
  await fs.copyFile(path.join(tmpRoot, 'scaffold', 'svg_output', '01_cover.svg'), path.join(nativeProject, 'svg_output', '01_cover.svg'));
  const noPlanStatus = await tool.execute({ action: 'status', project: nativeProject }, {});
  record(
    'status 无 native_plan.json 时 nativePlan.present=false',
    noPlanStatus?.data?.nativePlan?.present === false,
    JSON.stringify(noPlanStatus?.data?.nativePlan ?? null),
  );
  record(
    'status 报告 powerPoint 探测结果',
    typeof noPlanStatus?.data?.powerPoint?.nativeExport === 'boolean',
    JSON.stringify(noPlanStatus?.data?.powerPoint ?? null),
  );
  await fs.writeFile(
    path.join(nativeProject, 'native_plan.json'),
    JSON.stringify({ template: 'templates/missing.pptx', slides: { '01_cover.svg': { templateSlide: 0, fields: [] } }, append: [{ templateSlide: 2, fields: { '!!x': 'y' } }] }),
    'utf8',
  );
  const badPlanStatus = await tool.execute({ action: 'status', project: nativeProject }, {});
  const problems = badPlanStatus?.data?.nativePlan?.problems ?? [];
  record('坏 native_plan 逐条报错（templateSlide 必须是 ≥1 的整数）', problems.some((line) => line.includes('templateSlide')), problems.join(' | ').slice(0, 200));
  record('坏 native_plan 不会被当成可用（replace=0）', badPlanStatus?.data?.nativePlan?.replace === 0, JSON.stringify(badPlanStatus?.data?.nativePlan ?? null));
  record(
    '坏 native_plan 在 status 的 message 里说清楚',
    String(badPlanStatus?.message ?? '').includes('native_plan.json'),
    String(badPlanStatus?.message ?? '').slice(0, 200),
  );

  // 5. review without a live-preview server must be a visible failure, not a
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
