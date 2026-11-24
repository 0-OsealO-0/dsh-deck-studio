// Visual languages for generated pages.
//
// A theme is data, not code: palette + type ladder + grid + a few geometry
// knobs. The skeleton renderer reads it and emits SVG, so "换一套语言" is
// changing one id — the page structure stays put and the two decks stay
// comparable.
//
// Only roles that the spec_lock templates declare may appear as sizes here:
// the quality gate treats a third use of an unregistered size as a new role.

export const THEME_IDS = ['paper-stamp', 'navy-brief', 'blueprint-seu', 'neon-cyan', 'warm-sand', 'print-mono', 'ink-water'];

// Sizes shared by every theme. They are also the roles written into
// templates/spec_lock-*.md; scaffold patches a project lock that lacks them.
export const TYPE_ROLES = {
  display: 128,
  title: 76,
  headline: 54,
  subtitle: 34,
  body: 24,
  meta: 16,
  caption: 13,
  pageNumber: 11,
  metric: 120,
  kicker: 18,
};

const SANS = 'Source Han Sans SC TTF';
const SERIF = 'Source Han Serif SC TTF';
const SANS_FALLBACK = 'Microsoft YaHei';

export const THEMES = {
  'paper-stamp': {
    id: 'paper-stamp',
    label: '纸感印章（正式·冷白）',
    profile: 'formal',
    mode: 'light',
    families: { sans: SANS, serif: SERIF, fallback: SANS_FALLBACK },
    type: { ...TYPE_ROLES },
    grid: { marginX: 108, marginY: 84, gap: 40, columns: 12 },
    color: {
      bg: '#F7F7F4',
      ink: '#1B2430',
      muted: '#6B7280',
      accent: '#C23B2A',
      rule: '#D9D9D3',
      field: '#ECECE6',
      onField: '#1B2430',
      hairline: 1,
    },
    geometry: { field: 'none', ruleWeight: 4, corner: 0, stamp: true },
  },

  'navy-brief': {
    id: 'navy-brief',
    label: '深蓝简报（正式·深底）',
    profile: 'formal',
    mode: 'dark',
    families: { sans: SANS, serif: SERIF, fallback: SANS_FALLBACK },
    type: { ...TYPE_ROLES },
    grid: { marginX: 108, marginY: 84, gap: 44, columns: 12 },
    color: {
      bg: '#0E1B2C',
      ink: '#E8EDF3',
      muted: '#93A4BA',
      accent: '#5B9DFF',
      rule: '#243549',
      field: '#16273C',
      onField: '#E8EDF3',
      hairline: 1,
    },
    geometry: { field: 'left-band', ruleWeight: 2, corner: 0, stamp: false },
  },

  'blueprint-seu': {
    id: 'blueprint-seu',
    label: '建筑蓝图（东南大学）',
    profile: 'formal',
    mode: 'light',
    families: { sans: SANS, serif: SERIF, fallback: SANS_FALLBACK },
    type: { ...TYPE_ROLES },
    grid: { marginX: 96, marginY: 72, gap: 36, columns: 12 },
    color: {
      bg: '#EDF1F4',
      ink: '#12385F',
      muted: '#5A7085',
      accent: '#9A5B33',
      rule: '#B9C7D3',
      field: '#DCE5EC',
      onField: '#12385F',
      hairline: 1,
    },
    // 蓝图语言：细网格底、双线图签、大号编号，标题 6–9 字才好看。
    geometry: { field: 'grid', ruleWeight: 3, corner: 0, stamp: true, frame: true },
  },

  'neon-cyan': {
    id: 'neon-cyan',
    label: '暗色霓虹（活动）',
    profile: 'campaign',
    mode: 'dark',
    families: { sans: SANS, serif: SERIF, fallback: SANS_FALLBACK },
    type: { ...TYPE_ROLES },
    grid: { marginX: 112, marginY: 88, gap: 48, columns: 12 },
    color: {
      bg: '#0A0B0F',
      ink: '#F2F5F8',
      muted: '#8A93A6',
      accent: '#00E5FF',
      rule: '#222734',
      field: '#15181F',
      onField: '#F2F5F8',
      hairline: 1,
    },
    geometry: { field: 'top-bar', ruleWeight: 8, corner: 2, stamp: false },
  },

  'print-mono': {
    id: 'print-mono',
    label: '单色印刷（文艺·单墨）',
    profile: 'literary',
    mode: 'light',
    families: { sans: SERIF, serif: SERIF, fallback: 'SimSun' },
    type: { ...TYPE_ROLES },
    grid: { marginX: 128, marginY: 96, gap: 52, columns: 12 },
    color: {
      bg: '#FFFFFF',
      ink: '#000000',
      muted: '#555555',
      accent: '#000000',
      rule: '#000000',
      field: '#000000',
      onField: '#FFFFFF',
      hairline: 1,
    },
    geometry: { field: 'none', ruleWeight: 6, corner: 0, stamp: false },
  },

  // 活动侧第二套：浅底暖色。和 neon-cyan 的区别不是配色，是场景——
  // 白天发在群里的招新/预告适合浅底，投影在暗厅才用霓虹。
  'warm-sand': {
    id: 'warm-sand',
    label: '暖沙招新（活动·浅底）',
    profile: 'campaign',
    mode: 'light',
    families: { sans: SANS, serif: SERIF, fallback: SANS_FALLBACK },
    type: { ...TYPE_ROLES },
    grid: { marginX: 104, marginY: 80, gap: 44, columns: 12 },
    color: {
      bg: '#FFF6EC',
      ink: '#2B2118',
      muted: '#8A7259',
      accent: '#E2632A',
      rule: '#EAD9C4',
      field: '#FDEFE0',
      onField: '#2B2118',
      hairline: 1,
    },
    geometry: { field: 'none', ruleWeight: 8, corner: 4, stamp: false },
  },

  // 文艺侧第二套：宣纸 + 墨 + 朱砂。标题走宋体，正文仍用黑体，
  // 打印出来像一本小册子而不是 PPT。
  'ink-water': {
    id: 'ink-water',
    label: '水墨宣纸（文艺·宋体）',
    profile: 'literary',
    mode: 'light',
    families: { sans: SERIF, serif: SERIF, fallback: 'SimSun' },
    type: { ...TYPE_ROLES },
    grid: { marginX: 136, marginY: 100, gap: 48, columns: 12 },
    color: {
      bg: '#F4F1E9',
      ink: '#1A1A18',
      muted: '#6B665C',
      accent: '#A62B1F',
      rule: '#CFC8B8',
      field: '#E8E2D2',
      onField: '#1A1A18',
      hairline: 1,
    },
    geometry: { field: 'none', ruleWeight: 3, corner: 0, stamp: true },
  },
};

export function getTheme(id) {
  return THEMES[id] ?? null;
}

export function themeForProfile(profile) {
  if (profile === 'campaign') return THEMES['neon-cyan'];
  if (profile === 'literary') return THEMES['print-mono'];
  return THEMES['paper-stamp'];
}

export function themeMenuText() {
  return THEME_IDS.map((id) => {
    const t = THEMES[id];
    return `- ${id}：${t.label}（${t.profile} / ${t.mode === 'dark' ? '深底' : '浅底'}）`;
  }).join('\n');
}

// Sizes are emitted verbatim: the gate counts a third use of any size that
// spec_lock does not declare as a new role, so a per-theme scale multiplier
// (88 → 93) would quietly invent roles on every page.
export function typeSize(theme, role) {
  const size = theme.type[role];
  if (!size) throw new Error(`主题 ${theme.id} 没有字号角色 ${role}`);
  return size;
}
