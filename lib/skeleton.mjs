// Skeleton renderer: turns a page contract's slots into SVG.
//
// The point is not to replace judgment, it is to stop every page from being
// laid out from scratch. Six archetypes × two densities cover the class-deck
// cases we actually ship (activity notices, term summaries, award defenses),
// and the theme decides color, type family and frame — so the same content
// rendered through two themes is recognisably two different languages.
//
// Everything here is a pure function of (archetype, variant, text, theme,
// page number): no fs, no DSH imports, so the smoke suite can diff snapshots.

import { typeSize } from './themes.mjs';

const CANVAS = { w: 1600, h: 900 };
const SAFE_FAMILIES = new Set([]);
// Characters that may not start a line in Chinese typesetting.
const LEADING_PROHIBITED = /[，。、；：！？）】」』’”%‰·…]/;
// …and a line may not end with an opening mark: 「五个还是六项」 once broke as
// 「／五个还是六项」, which reads like a typo.
const TRAILING_PROHIBITED = /[（【「『《“‘(\[\{]$/;

// ---------------------------------------------------------------- measuring

// Rough advance widths in em. CJK is monospaced-square, Latin is not; that is
// the whole model. Good enough to decide "does this line fit", which is the
// only question a skeleton asks.
function advance(ch) {
  const code = ch.codePointAt(0);
  if (ch === ' ') return 0.28;
  if (ch === '\u2009') return 0.18; // thin space between number and unit
  if (code >= 0x2e80) return 1.0; // CJK, kana, hangul, fullwidth forms
  if (/[0-9]/.test(ch)) return 0.56;
  if (/[A-Z]/.test(ch)) return 0.62;
  if (/[a-z]/.test(ch)) return 0.52;
  if (/[.,;:!?'"()\[\]{}\-–—·%]/.test(ch)) return 0.34;
  return 0.54;
}

export function measure(text, size) {
  let width = 0;
  for (const ch of String(text ?? '')) width += advance(ch) * size;
  return width;
}

// Greedy wrap: break between CJK characters anywhere, between Latin words at
// spaces. Never returns an empty array for non-empty input.
export function wrap(text, size, maxWidth) {
  const value = String(text ?? '').trim();
  if (!value) return [];
  const lines = [];
  let line = '';
  let lastSpace = -1;
  let width = 0;
  for (const ch of value) {
    const w = advance(ch) * size;
    if (width + w > maxWidth && line) {
      if (lastSpace > 0 && /[\u2e80-\u9fff]/.test(ch) === false) {
        const head = line.slice(0, lastSpace);
        const tail = line.slice(lastSpace + 1);
        lines.push(head.trimEnd());
        line = tail;
        width = measure(line, size);
      } else {
        lines.push(line.trimEnd());
        line = '';
        width = 0;
      }
      lastSpace = -1;
    }
    line += ch;
    width += w;
    if (ch === ' ') lastSpace = line.length - 1;
  }
  if (line.trim()) lines.push(line.trimEnd());
  // Hanging punctuation: a line may not begin with a closing mark, so pull it
  // back onto the previous line instead of letting it dangle in the margin.
  for (let i = 1; i < lines.length; i += 1) {
    let guard = 0;
    while (lines[i] && LEADING_PROHIBITED.test(lines[i][0]) && guard < 3) {
      lines[i - 1] += lines[i][0];
      lines[i] = lines[i].slice(1);
      guard += 1;
    }
  }
  // Kinsoku, other direction: push an opening mark down to the line it opens.
  for (let i = 0; i < lines.length - 1; i += 1) {
    let guard = 0;
    while (lines[i] && TRAILING_PROHIBITED.test(lines[i]) && guard < 3) {
      const mark = lines[i].slice(-1);
      lines[i] = lines[i].slice(0, -1);
      lines[i + 1] = mark + lines[i + 1];
      guard += 1;
    }
  }
  return lines.filter((item) => item.length > 0);
}

function fitRole(text, roles, sizes, width, maxLines, theme) {
  for (const role of roles) {
    const size = typeSize(theme, role);
    const lines = wrap(text, size, width);
    if (lines.length <= maxLines) return { role, size, lines };
  }
  const role = roles[roles.length - 1];
  const size = typeSize(theme, role);
  return { role, size, lines: wrap(text, size, width) };
}

// ------------------------------------------------------------------- SVG IO

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' };

export function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}

function block({ id, lines, x, y, size, fill, weight = 400, family, lineHeight = 1.45, anchor = 'start', opacity }) {
  if (!lines || !lines.length) return '';
  const lh = Math.round(size * lineHeight);
  const attrs = [
    id ? `id="${id}"` : '',
    `x="${round(x)}"`,
    `y="${round(y)}"`,
    `font-family="${esc(family)}"`,
    `font-size="${size}"`,
    `fill="${fill}"`,
    weight !== 400 ? `font-weight="${weight}"` : '',
    anchor !== 'start' ? `text-anchor="${anchor}"` : '',
    opacity ? `opacity="${opacity}"` : '',
  ].filter(Boolean).join(' ');
  // Every line is a positioned tspan, never direct text: the quality gate can
  // only estimate bounds when <text> holds no loose text and each tspan has x.
  const body = lines
    .map((line, index) =>
      index === 0
        ? `<tspan x="${round(x)}" y="${round(y)}">${esc(line)}</tspan>`
        : `<tspan x="${round(x)}" dy="${lh}">${esc(line)}</tspan>`)
    .join('');
  return `<text ${attrs}>${body}</text>`;
}

function round(n) {
  return Math.round(n * 100) / 100;
}

function rect({ x, y, w, h, fill, stroke, strokeWidth = 1, id, role, opacity }) {
  const attrs = [
    id ? `id="${id}"` : '',
    role ? `data-pptx-role="${role}"` : '',
    `x="${round(x)}"`,
    `y="${round(y)}"`,
    `width="${round(w)}"`,
    `height="${round(h)}"`,
    `fill="${fill}"`,
    stroke ? `stroke="${stroke}"` : '',
    stroke ? `stroke-width="${strokeWidth}"` : '',
    opacity ? `opacity="${opacity}"` : '',
  ].filter(Boolean).join(' ');
  return `<rect ${attrs}/>`;
}

function line({ x1, y1, x2, y2, stroke, width = 1, opacity }) {
  return `<line x1="${round(x1)}" y1="${round(y1)}" x2="${round(x2)}" y2="${round(y2)}" stroke="${stroke}" stroke-width="${width}"${
    opacity ? ` opacity="${opacity}"` : ''
  }/>`;
}

// ------------------------------------------------------------------- frames

function frameLayers(theme) {
  const { color, grid, geometry } = theme;
  const layers = [];
  if (geometry.field === 'left-band') {
    layers.push(rect({ x: 0, y: 0, w: 200, h: CANVAS.h, fill: color.field }));
  }
  if (geometry.field === 'top-bar') {
    layers.push(rect({ x: 0, y: 0, w: CANVAS.w, h: 14, fill: color.accent }));
  }
  if (geometry.field === 'grid') {
    // Blueprint paper, not graph paper: sparse verticals every 160px and
    // horizontals every 120px, both kept faint so the words stay dominant.
    const marks = [];
    for (let x = grid.marginX + 160; x < CANVAS.w - grid.marginX; x += 160) {
      marks.push(line({ x1: x, y1: grid.marginY, x2: x, y2: CANVAS.h - grid.marginY, stroke: color.rule, width: 0.5, opacity: 0.38 }));
    }
    for (let y = grid.marginY + 120; y < CANVAS.h - grid.marginY; y += 120) {
      marks.push(line({ x1: grid.marginX, y1: y, x2: CANVAS.w - grid.marginX, y2: y, stroke: color.rule, width: 0.5, opacity: 0.38 }));
    }
    layers.push(`<g id="grid" data-pptx-role="decoration" data-pptx-bounds="0 0 1600 900">${marks.join('')}</g>`);
  }
  if (geometry.frame) {
    // 图签式外框：双线，左下角留标签位。
    layers.push(
      `<g id="figure-frame" data-pptx-role="decoration" data-pptx-bounds="0 0 1600 900">` +
        rect({ x: grid.marginX / 2, y: grid.marginY / 2, w: CANVAS.w - grid.marginX, h: CANVAS.h - grid.marginY, fill: 'none', stroke: color.ink, strokeWidth: 1.4 }) +
        rect({ x: grid.marginX / 2 + 6, y: grid.marginY / 2 + 6, w: CANVAS.w - grid.marginX - 12, h: CANVAS.h - grid.marginY - 12, fill: 'none', stroke: color.rule, strokeWidth: 0.8 }) +
        `</g>`,
    );
  }
  return layers;
}

function contentBox(theme, variant) {
  const { grid, geometry } = theme;
  const shift = geometry.field === 'left-band' ? 152 : 0;
  const padY = variant === 'density' ? grid.marginY - 8 : grid.marginY;
  const left = grid.marginX + shift;
  const right = CANVAS.w - grid.marginX;
  const top = padY + (geometry.field === 'top-bar' ? 78 : 0);
  const bottom = CANVAS.h - grid.marginY - 24;
  return { left, right, top, bottom, width: right - left, height: bottom - top };
}

function footer(theme, box, pageNumber, total) {
  const y = CANVAS.h - 46;
  const parts = [];
  parts.push(line({ x1: box.left, y1: y - 30, x2: box.right, y2: y - 30, stroke: theme.color.rule, width: theme.color.hairline }));
  if (pageNumber && total) {
    parts.push(
      block({
        id: 'page-number',
        lines: [`${String(pageNumber).padStart(2, '0')} / ${String(total).padStart(2, '0')}`],
        x: box.right,
        y,
        size: typeSize(theme, 'pageNumber'),
        fill: theme.color.muted,
        family: theme.families.sans,
        anchor: 'end',
      }),
    );
  }
  return parts.join('');
}

// --------------------------------------------------------------- archetypes

// Image slots store a project-relative path (`images/photo.jpg`); the SVG lives
// one level down in svg_output/, so the href gains a leading `../`. The exporter
// resolves both forms inside the project root, the browser only resolves this
// one — using the same string for both is why a previewed page and the exported
// PPTX used to disagree about whether a photo existed.
export function mediaHref(value) {
  const raw = String(value ?? '').trim().replace(/\\/g, '/');
  if (!raw) return '';
  if (raw.startsWith('data:')) return raw;
  if (raw.startsWith('../') || raw.startsWith('/')) return raw;
  return `../${raw.replace(/^\.\//, '')}`;
}

function scrimDefs(theme) {
  return (
    `<defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${theme.color.bg}" stop-opacity="0"/>` +
    `<stop offset="0.34" stop-color="${theme.color.bg}" stop-opacity="0.35"/>` +
    `<stop offset="0.56" stop-color="${theme.color.bg}" stop-opacity="0.88"/>` +
    `<stop offset="1" stop-color="${theme.color.bg}" stop-opacity="0.97"/>` +
    `</linearGradient></defs>`
  );
}

// Hero pages put a headline straight over the photo, so the wash has to be
// heavier than a cover's: a cover's title sits low where the scrim is already
// opaque, a hero's title lands in the middle of the image.
function heroScrimDefs(theme) {
  const c = theme.color.bg;
  return (
    `<defs><linearGradient id="scrim" x1="0" y1="0" x2="0" y2="1">` +
    `<stop offset="0" stop-color="${c}" stop-opacity="0.62"/>` +
    `<stop offset="0.3" stop-color="${c}" stop-opacity="0.78"/>` +
    `<stop offset="0.55" stop-color="${c}" stop-opacity="0.9"/>` +
    `<stop offset="1" stop-color="${c}" stop-opacity="0.97"/>` +
    `</linearGradient></defs>`
  );
}

// The photo is its own root module, before the text, so the converter maps it to
// a single native picture and nothing else has to know it exists.
function mediaLayer(page, theme) {
  const href = mediaHref(page.text?.image);
  if (!href) return { defs: '', layer: '' };
  // A 5:3 poster dropped into the portrait image frame loses both edges with
  // `slice`; imageFit=contain letterboxes it instead so the whole piece reads.
  const contain = String(page.text?.imageFit ?? '').toLowerCase() === 'contain';
  const par = contain ? 'xMidYMid meet' : 'xMidYMid slice';
  if (page.archetype === 'hero') {
    return {
      defs: heroScrimDefs(theme),
      layer:
        `<g id="media" data-pptx-bounds="0 0 ${CANVAS.w} ${CANVAS.h}">` +
        `<image x="0" y="0" width="${CANVAS.w}" height="${CANVAS.h}" preserveAspectRatio="${par}" href="${esc(href)}"/>` +
        `<rect x="0" y="0" width="${CANVAS.w}" height="${CANVAS.h}" fill="url(#scrim)"/>` +
        `</g>`,
    };
  }
  if (page.archetype === 'image') {
    const x = 780;
    const w = CANVAS.w - x;
    const back = contain ? `<rect x="${x}" y="0" width="${w}" height="${CANVAS.h}" fill="${theme.color.bg}"/>` : '';
    return {
      defs: '',
      layer:
        `<g id="media" data-pptx-bounds="0 0 ${CANVAS.w} ${CANVAS.h}">` +
        back +
        `<image x="${x}" y="0" width="${w}" height="${CANVAS.h}" preserveAspectRatio="${par}" href="${esc(href)}"/>` +
        `</g>`,
    };
  }
  // The wash spans the full page so the gradient never shows a seam; it gets
  // opaque right where the title block starts, which keeps dark ink legible.
  const top = 0;
  return {
    defs: scrimDefs(theme),
    layer:
      `<g id="media" data-pptx-bounds="0 0 ${CANVAS.w} ${CANVAS.h}">` +
      `<image x="0" y="0" width="${CANVAS.w}" height="${CANVAS.h}" preserveAspectRatio="${par}" href="${esc(href)}"/>` +
      `<rect x="0" y="${top}" width="${CANVAS.w}" height="${CANVAS.h - top}" fill="url(#scrim)"/>` +
      `</g>`,
  };
}

function coverBody(page, ctx) {
  const { theme, box } = ctx;
  const text = page.text ?? {};
  // A photo cover swaps the whole ink set: dark text on a photo is unreadable
  // whatever the scrim does, so the theme's on-field colour takes over.
  const onPhoto = Boolean(mediaHref(text.image));
  const ink = onPhoto ? theme.color.onField : theme.color.ink;
  const soft = onPhoto ? theme.color.onField : theme.color.muted;
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const density = page.variant === 'density';
  const roles = density ? ['title', 'headline'] : ['display', 'title', 'headline'];
  const title = fitRole(text.title ?? '', roles, null, width * 0.94, density ? 3 : 2, theme);
  const subtitleSize = typeSize(theme, 'subtitle');
  const subtitleLines = text.subtitle ? wrap(text.subtitle, subtitleSize, width * 0.64) : [];
  const noteLines = text.note ? wrap(text.note, typeSize(theme, 'meta'), width * 0.44) : [];
  const metaLines = text.meta ? wrap(text.meta, typeSize(theme, 'meta'), width * 0.86) : [];

  const titleBlockH = title.lines.length * Math.round(title.size * 1.18);
  const subtitleBlockH = subtitleLines.length * Math.round(subtitleSize * 1.55);
  const groupH = 34 + titleBlockH + (subtitleLines.length ? 36 + subtitleBlockH : 0);
  const metaReserve = metaLines.length ? 96 : 24;

  // Sit the title block low — around two thirds down the canvas — so the page
  // reads as a cover rather than a form. The rule and eyebrow mark the top of
  // the block; meta data stays pinned to the footer.
  let top = box.top + Math.max(60, (height - groupH - metaReserve) * 0.62);
  if (top + groupH > box.bottom - metaReserve) top = Math.max(box.top + 60, box.bottom - metaReserve - groupH);

  const out = [];
  out.push(rect({ x: box.left, y: top, w: density ? 72 : 112, h: theme.geometry.ruleWeight, fill: theme.color.accent }));
  out.push(
    block({
      id: 'cover-title',
      lines: title.lines,
      x: box.left,
      y: top + 34 + title.size,
      size: title.size,
      fill: ink,
      weight: 700,
      family: theme.families.sans,
      lineHeight: 1.18,
    }),
  );
  let cursor = top + 34 + titleBlockH;
  if (subtitleLines.length) {
    out.push(
      block({
        id: 'cover-subtitle',
        lines: subtitleLines,
        x: box.left,
        y: cursor + 36 + subtitleSize,
        size: subtitleSize,
        fill: soft,
        family: theme.families.sans,
        lineHeight: 1.55,
      }),
    );
    cursor += 36 + subtitleBlockH;
  }
  if (noteLines.length) {
    out.push(
      block({
        id: 'cover-note',
        lines: noteLines,
        x: box.left,
        // 18px above the rule: note + meta read as one footer block. The old
        // 40px gap made the note look like a forgotten line.
        y: box.bottom - 62,
        size: typeSize(theme, 'meta'),
        fill: soft,
        family: theme.families.sans,
        lineHeight: 1.5,
      }),
    );
  }
  if (metaLines.length) {
    out.push(line({ x1: box.left, y1: box.bottom - 44, x2: box.right, y2: box.bottom - 44, stroke: onPhoto ? theme.color.onField : theme.color.rule, width: theme.color.hairline }));
    out.push(
      block({
        id: 'cover-meta',
        lines: metaLines,
        x: box.left,
        y: box.bottom - 12,
        size: typeSize(theme, 'meta'),
        fill: soft,
        family: theme.families.sans,
      }),
    );
  }
  if (theme.geometry.stamp) {
    // A seal, not a label: two nested squares in the accent colour, mirroring
    // the printed-page vocabulary the theme is named after.
    const stamp = 76;
    out.push(rect({ x: box.right - stamp, y: box.top + 8, w: stamp, h: stamp, fill: 'none', stroke: onPhoto ? theme.color.onField : theme.color.accent, strokeWidth: 2.5 }));
    out.push(rect({ x: box.right - stamp + 9, y: box.top + 17, w: stamp - 18, h: stamp - 18, fill: 'none', stroke: onPhoto ? theme.color.onField : theme.color.accent, strokeWidth: 1 }));
  }
  return out.join('');
}

function statementBody(page, ctx) {
  const { theme, box } = ctx;
  const text = page.text ?? {};
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const density = page.variant === 'density';
  const out = [];

  const kickerSize = typeSize(theme, 'kicker');
  const headline = fitRole(text.headline ?? '', density ? ['headline', 'subtitle'] : ['title', 'headline'], null, width * 0.9, density ? 3 : 2, theme);
  // Both variants carry the claim at subtitle size: at body size a dense page
  // turned its one supporting paragraph into a caption strip across the sheet.
  const bodySize = typeSize(theme, 'subtitle');
  const bodyLines = text.body ? wrap(text.body, bodySize, width * (density ? 0.8 : 0.74)) : [];
  const evidenceLines = text.evidence ? wrap(text.evidence, typeSize(theme, 'meta'), width * 0.76) : [];

  const headlineH = headline.lines.length * Math.round(headline.size * 1.22);
  const bodyH = bodyLines.length * Math.round(bodySize * 1.6);
  const leading = density ? 28 : 40;
  const groupH =
    (text.kicker ? kickerSize + leading : 0) +
    headlineH +
    (bodyLines.length ? leading + 18 + bodyH : 0) +
    (evidenceLines.length ? leading + 34 : 0);

  // Optical centre: a claim page with one headline and two lines of support
  // should sit in the middle of the sheet, not in the top third.
  let cursor = box.top + Math.max(28, (height - groupH) * 0.5);

  if (text.kicker) {
    out.push(
      block({
        id: 'kicker',
        lines: [text.kicker],
        x: box.left,
        y: cursor + kickerSize,
        size: kickerSize,
        fill: theme.color.accent,
        weight: 700,
        family: theme.families.sans,
      }),
    );
    cursor += kickerSize + leading;
  }
  out.push(
    block({
      id: 'headline',
      lines: headline.lines,
      x: box.left,
      y: cursor + headline.size,
      size: headline.size,
      fill: theme.color.ink,
      weight: 700,
      family: theme.families.sans,
      lineHeight: 1.22,
    }),
  );
  cursor += headlineH;
  if (bodyLines.length) {
    out.push(
      block({
        id: 'body',
        lines: bodyLines,
        x: box.left,
        y: cursor + leading + 18 + bodySize,
        size: bodySize,
        fill: theme.color.ink,
        family: theme.families.sans,
        lineHeight: 1.6,
      }),
    );
    cursor += leading + 18 + bodyH;
  }
  if (evidenceLines.length) {
    out.push(line({ x1: box.left, y1: cursor + leading, x2: box.left + 72, y2: cursor + leading, stroke: theme.color.accent, width: theme.geometry.ruleWeight }));
    out.push(
      block({
        id: 'evidence',
        lines: evidenceLines,
        x: box.left,
        y: cursor + leading + 34,
        size: typeSize(theme, 'meta'),
        fill: theme.color.muted,
        family: theme.families.sans,
        lineHeight: 1.5,
      }),
    );
  }
  return out.join('');
}

// 图文页: photo owns the right 45% of the sheet, the left column carries one
// judgment. Deliberately a different silhouette from cover, so a campaign deck
// alternating the two does not read as the same page twice.
// 招新大图页：整页照片 + 底部一簇文字。和 cover 的区别是它必须给出
// 时间、地点、报名方式——照拿掉就只剩一句漂亮话，招不到人。
function heroBody(page, ctx) {
  const { theme, box } = ctx;
  const text = page.text ?? {};
  const width = box.right - box.left;
  const density = page.variant === 'density';
  const ink = theme.color.onField;
  const soft = theme.color.onField;
  const out = [];

  const gutter = Math.max(box.left, 96);
  const textW = Math.min(width * 0.72, 980);

  if (text.kicker) {
    out.push(
      block({
        id: 'hero-kicker',
        lines: [String(text.kicker).toUpperCase ? String(text.kicker) : String(text.kicker)],
        x: gutter,
        y: box.top + 40,
        size: typeSize(theme, 'kicker'),
        fill: theme.color.accent,
        weight: 700,
        family: theme.families.sans,
      }),
    );
  }

  const ctaSize = typeSize(theme, 'body');
  const ctaPadX = 32;
  const ctaH = 64;
  const ctaW = Math.min(
    textW,
    Math.max(240, measure(text.cta ?? '', ctaSize) + ctaPadX * 2),
  );
  const ctaTop = box.bottom - ctaH - 12;
  const infoSize = typeSize(theme, 'meta');
  const infoLine = [text.when, text.where].filter(Boolean).join('   ·   ');
  const infoWrapped = infoLine ? wrap(infoLine, infoSize, textW) : [];
  const infoH = infoWrapped.length * Math.round(infoSize * 1.6);
  const infoBase = ctaTop - 34;
  const ruleY = infoBase - infoH - 18;

  const subtitleLines =
    text.subtitle && !density ? wrap(text.subtitle, typeSize(theme, 'subtitle'), textW * 0.9) : [];
  const subtitleH = subtitleLines.length * Math.round(typeSize(theme, 'subtitle') * 1.5);
  const titleMaxW = textW * 0.96;
  const title = fitRole(text.title ?? '', density ? ['title', 'headline', 'subtitle'] : ['display', 'title', 'headline'], null, titleMaxW, 2, theme);
  const titleH = title.lines.length * Math.round(title.size * 1.14);
  const titleBase = ruleY - 26 - (subtitleLines.length ? subtitleH + 22 : 0) - titleH + title.size * 0.82;

  // 标题块太高就整体上移，别让 CTA 被挤出画布；再高说明文案本身太长。
  const titleTop = titleBase - title.size * 0.82;
  const shift = Math.min(0, titleTop - (box.top + 110));

  out.push(
    block({
      id: 'hero-title',
      lines: title.lines,
      x: gutter,
      y: titleBase + shift,
      size: title.size,
      fill: ink,
      weight: 700,
      family: theme.families.sans,
      lineHeight: 1.14,
    }),
  );

  if (subtitleLines.length) {
    out.push(
      block({
        id: 'hero-subtitle',
        lines: subtitleLines,
        x: gutter,
        y: ruleY - 26 + shift,
        size: typeSize(theme, 'subtitle'),
        fill: soft,
        family: theme.families.sans,
        lineHeight: 1.5,
        opacity: 0.86,
      }),
    );
  }

  out.push(line({ x1: gutter, y1: ruleY + shift, x2: gutter + textW, y2: ruleY + shift, stroke: theme.color.accent, width: theme.geometry.ruleWeight }));

  if (infoWrapped.length) {
    out.push(
      block({
        id: 'hero-info',
        lines: infoWrapped,
        x: gutter,
        y: infoBase,
        size: infoSize,
        fill: soft,
        family: theme.families.sans,
        lineHeight: 1.6,
        opacity: 0.9,
      }),
    );
  }

  if (text.cta) {
    out.push(rect({ x: gutter, y: ctaTop, w: ctaW, h: ctaH, fill: theme.color.accent, id: 'hero-cta-chip' }));
    out.push(
      block({
        id: 'hero-cta',
        lines: wrap(text.cta, ctaSize, ctaW - ctaPadX * 2).slice(0, 1),
        x: gutter + ctaPadX,
        y: ctaTop + ctaH / 2 + ctaSize * 0.34,
        size: ctaSize,
        fill: theme.color.bg,
        weight: 700,
        family: theme.families.sans,
      }),
    );
  }
  return out.join('');
}

// 通知页：班级群通知的固定五段搬上版。时间 / 地点 / 对象用"标签 + 值"的
// 两栏行，逐行 hairline 分隔；要带的东西用小方块勾选；联系人在页脚。
// 排版前先把各段高度算出来：内容多时先收间距、再丢备注，绝不压到页脚之下。
function noticeBody(page, ctx) {
  const { theme, box } = ctx;
  const text = page.text ?? {};
  const width = box.right - box.left;
  const density = page.variant === 'density';
  const out = [];

  // 通知页是文本页：标题从 title 起排，给下面的时间地点和待办留出高度。
  const title = fitRole(text.title ?? '', density ? ['headline', 'subtitle'] : ['title', 'headline', 'subtitle'], null, width * 0.82, 2, theme);
  const titleH = title.lines.length * Math.round(title.size * 1.18);
  const rowSize = typeSize(theme, 'body');
  const todoSize = typeSize(theme, 'body');
  const rows = [
    ['when', '时间', text.when],
    ['where', '地点', text.where],
    ['who', '对象', text.who],
  ].filter(([, , value]) => value);
  const rowLines = rows.map(([, , value]) => wrap(value, rowSize, width - 108 - 24));
  const todos = Array.isArray(text.todo) ? text.todo.filter(Boolean).slice(0, 4) : [];
  const todoLines = todos.map((item) => wrap(item, todoSize, width - 46));
  const noteLines = text.note ? wrap(text.note, typeSize(theme, 'meta'), width * 0.82) : [];

  const contactTop = box.bottom - 48;
  const startY = box.top + 56 + 28;
  const available = contactTop - startY;

  // 先算内容高度；放不下就从最后一条待办开始删，再删备注。
  const rowHeights = rowLines.map((lines) => Math.max(lines.length, 1) * Math.round(rowSize * 1.5) + 30);
  const todoHeights = (list) => list.map((lines) => Math.max(lines.length, 1) * Math.round(todoSize * 1.6) + 16);
  const noteH = noteLines.length ? noteLines.length * Math.round(typeSize(theme, 'meta') * 1.6) + 12 : 0;
  const baseH = titleH + 28 + rowHeights.reduce((a, b) => a + b, 0);

  let keptTodos = todoLines.slice();
  let keptNote = noteLines.slice();
  const total = () => baseH + todoHeights(keptTodos).reduce((a, b) => a + b, 0) + (keptNote.length ? noteH : 0);
  while (total() > available && keptTodos.length) keptTodos.pop();
  if (total() > available) keptNote = [];

  let cursor = box.top + 56;
  out.push(block({ id: 'notice-label', lines: ['通知'], x: box.left, y: cursor, size: typeSize(theme, 'kicker'), fill: theme.color.accent, weight: 700, family: theme.families.sans }));
  cursor += 28;
  out.push(block({ id: 'notice-title', lines: title.lines, x: box.left, y: cursor + title.size * 0.84, size: title.size, fill: theme.color.ink, weight: 700, family: theme.families.sans, lineHeight: 1.18 }));
  cursor += titleH + 28;

  rows.forEach(([key, label, value], index) => {
    const lines = rowLines[index];
    const rowH = Math.max(lines.length, 1) * Math.round(rowSize * 1.5);
    out.push(block({ id: `notice-${key}-label`, lines: [label], x: box.left, y: cursor + rowSize * 0.86, size: typeSize(theme, 'meta'), fill: theme.color.muted, weight: 700, family: theme.families.sans }));
    out.push(block({ id: `notice-${key}`, lines, x: box.left + 108, y: cursor + rowSize * 0.86, size: rowSize, fill: theme.color.ink, family: theme.families.sans, lineHeight: 1.5 }));
    cursor += rowH + 20;
    out.push(line({ x1: box.left, y1: cursor, x2: box.right, y2: cursor, stroke: theme.color.rule, width: theme.color.hairline }));
    cursor += 10;
  });

  if (keptTodos.length) {
    cursor += 6;
    keptTodos.forEach((lines, index) => {
      out.push(rect({ x: box.left, y: cursor + 4, w: 18, h: 18, fill: 'none', stroke: theme.color.accent, strokeWidth: 2 }));
      out.push(block({ id: `notice-todo-${index + 1}`, lines, x: box.left + 34, y: cursor + todoSize * 0.86, size: todoSize, fill: theme.color.ink, family: theme.families.sans, lineHeight: 1.6 }));
      cursor += Math.max(lines.length, 1) * Math.round(todoSize * 1.6) + 16;
    });
  }

  if (keptNote.length) {
    cursor += 8;
    out.push(block({ id: 'notice-note', lines: keptNote, x: box.left, y: cursor + typeSize(theme, 'meta') * 0.86, size: typeSize(theme, 'meta'), fill: theme.color.muted, family: theme.families.sans, lineHeight: 1.6 }));
  }

  if (text.contact) {
    out.push(line({ x1: box.left, y1: box.bottom - 44, x2: box.right, y2: box.bottom - 44, stroke: theme.color.rule, width: theme.color.hairline }));
    out.push(block({ id: 'notice-contact', lines: wrap(text.contact, typeSize(theme, 'body'), width * 0.7), x: box.left, y: box.bottom - 14, size: typeSize(theme, 'body'), fill: theme.color.ink, weight: 700, family: theme.families.sans, lineHeight: 1.6 }));
  }
  return out.join('');
}

function imageBody(page, ctx) {
  const { theme, box } = ctx;
  const text = page.text ?? {};
  const width = Math.min(box.width * 0.4, 560);
  const height = box.bottom - box.top;
  const headline = fitRole(text.headline ?? '', ['title', 'headline'], null, width, 3, theme);
  const bodySize = typeSize(theme, 'body');
  const bodyLines = text.body ? wrap(text.body, bodySize, width) : [];
  const headlineH = headline.lines.length * Math.round(headline.size * 1.22);
  const bodyH = bodyLines.length * Math.round(bodySize * 1.6);
  const groupH = 26 + headlineH + (bodyLines.length ? 30 + bodyH : 0);
  const cursor = box.top + Math.max(24, (height - groupH) * 0.42);

  const out = [];
  out.push(rect({ x: box.left, y: cursor, w: 72, h: theme.geometry.ruleWeight, fill: theme.color.accent }));
  out.push(
    block({
      id: 'image-headline',
      lines: headline.lines,
      x: box.left,
      y: cursor + 26 + headline.size,
      size: headline.size,
      fill: theme.color.ink,
      weight: 700,
      family: theme.families.sans,
      lineHeight: 1.22,
    }),
  );
  if (bodyLines.length) {
    out.push(
      block({
        id: 'image-body',
        lines: bodyLines,
        x: box.left,
        y: cursor + 26 + headlineH + 30 + bodySize,
        size: bodySize,
        fill: theme.color.muted,
        family: theme.families.sans,
        lineHeight: 1.6,
      }),
    );
  }
  if (text.caption) {
    out.push(
      line({ x1: box.left, y1: box.bottom - 44, x2: box.left + width * 0.5, y2: box.bottom - 44, stroke: theme.color.rule, width: theme.color.hairline }),
    );
    out.push(
      block({
        id: 'image-caption',
        lines: wrap(text.caption, typeSize(theme, 'caption'), width),
        x: box.left,
        y: box.bottom - 6,
        size: typeSize(theme, 'caption'),
        fill: theme.color.muted,
        family: theme.families.sans,
      }),
    );
  }
  return out.join('');
}

function splitMetric(item) {
  const value = String(item ?? '').trim();
  // Measure words are part of the number ("22 项"), so the label must not
  // repeat them. "29 天" alone leaves no label; drawing the full string as the
  // label printed "29 天" twice.
  const match = value.match(
    /^([+\-]?\d+(?:\.\d+)?\s*(?:%|％|万|亿|人|场|次|页|天|周|月|年|分钟|小时|个|倍|分|项|篇|张|版|套|条|封|份|名|位|件|款|支|届|轮)?)\s*[·:：,，|｜]?\s*(.*)$/,
  );
  if (!match) return { value: '', label: value };
  return { value: match[1].replace(/\s+/g, ''), label: (match[2] ?? '').trim() };
}

function metricsBody(page, ctx) {
  const { theme, box } = ctx;
  const text = page.text ?? {};
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const density = page.variant === 'density';
  const out = [];

  const headline = fitRole(text.headline ?? '', density ? ['headline', 'subtitle'] : ['title', 'headline'], null, width * 0.86, 2, theme);
  const headlineH = headline.lines.length * Math.round(headline.size * 1.24);
  out.push(
    block({
      id: 'headline',
      lines: headline.lines,
      x: box.left,
      y: box.top + headline.size,
      size: headline.size,
      fill: theme.color.ink,
      weight: 700,
      family: theme.families.sans,
      lineHeight: 1.24,
    }),
  );

  const items = Array.isArray(text.metrics) ? text.metrics.slice(0, 4) : [];
  const columns = Math.max(items.length, 1);
  const gap = theme.grid.gap * (columns > 2 ? 1.1 : 2);
  const cellW = (width - gap * (columns - 1)) / columns;
  const labelSize = typeSize(theme, density ? 'meta' : 'body');
  const metricSize = typeSize(theme, 'metric');
  const metrics = items.map((item) => {
    const { value, label } = splitMetric(item);
    const valueSize = value && measure(value, metricSize) > cellW ? typeSize(theme, 'title') : metricSize;
    return { value, label, valueSize, lines: wrap(label || String(item ?? ''), labelSize, cellW) };
  });
  const maxLabelLines = Math.max(...metrics.map((metric) => metric.lines.length), 1);
  const valueH = Math.round(metricSize * 1.02);
  const rowH = valueH + 26 + maxLabelLines * Math.round(labelSize * 1.5);

  const top = box.top + headlineH + 48;
  const avail = box.bottom - 40 - top;
  const rowTop = top + Math.max(0, (avail - rowH) * 0.46);

  metrics.forEach((metric, index) => {
    const x = box.left + index * (cellW + gap);
    const { value, valueSize } = metric;
    if (value) {
      out.push(
        block({
          id: `metric-${index + 1}`,
          // "22项" reads glued; a thin space keeps the unit attached to the
          // number without making it look like a second column.
          lines: [value.replace(/^([+\-]?\d+(?:\.\d+)?)(.+)$/, '$1\u2009$2')],
          x,
          y: rowTop + valueSize,
          size: valueSize,
          fill: theme.color.accent,
          weight: 700,
          family: theme.families.sans,
          lineHeight: 1.02,
        }),
      );
    } else {
      out.push(line({ x1: x, y1: rowTop + 18, x2: x + Math.min(72, cellW), y2: rowTop + 18, stroke: theme.color.accent, width: theme.geometry.ruleWeight }));
    }
    out.push(
      block({
        id: `metric-label-${index + 1}`,
        lines: metric.lines,
        x,
        y: rowTop + (value ? valueH + 26 + labelSize : valueH * 0.55),
        size: labelSize,
        fill: theme.color.muted,
        family: theme.families.sans,
        lineHeight: 1.5,
      }),
    );
    if (index > 0) {
      const ruleX = x - gap / 2;
      out.push(line({ x1: ruleX, y1: rowTop, x2: ruleX, y2: rowTop + rowH - 10, stroke: theme.color.rule, width: theme.color.hairline }));
    }
  });

  if (text.footnote) {
    const noteLines = wrap(text.footnote, typeSize(theme, 'meta'), width * 0.8);
    out.push(line({ x1: box.left, y1: box.bottom - 34, x2: box.right, y2: box.bottom - 34, stroke: theme.color.rule, width: theme.color.hairline }));
    out.push(
      block({
        id: 'footnote',
        lines: noteLines,
        x: box.left,
        y: box.bottom - 4,
        size: typeSize(theme, 'meta'),
        fill: theme.color.muted,
        family: theme.families.sans,
      }),
    );
  }
  return out.join('');
}

function comparisonBody(page, ctx) {
  const { theme, box } = ctx;
  const text = page.text ?? {};
  const width = box.right - box.left;
  const density = page.variant === 'density';
  const out = [];
  const gap = theme.grid.gap * 2;
  const colW = (width - gap) / 2;
  const midX = box.left + colW + gap / 2;

  const headline = fitRole(text.headline ?? '', density ? ['headline', 'subtitle'] : ['title', 'headline'], null, width * 0.86, 2, theme);
  const headlineH = headline.lines.length * Math.round(headline.size * 1.24);
  out.push(
    block({
      id: 'headline',
      lines: headline.lines,
      x: box.left,
      y: box.top + headline.size,
      size: headline.size,
      fill: theme.color.ink,
      weight: 700,
      family: theme.families.sans,
      lineHeight: 1.24,
    }),
  );

  let top = box.top + headlineH + 96;
  const titleSize = typeSize(theme, 'subtitle');
  const sides = [
    { title: text.leftTitle, body: text.leftBody, x: box.left },
    { title: text.rightTitle, body: text.rightBody, x: midX + gap / 2 },
  ];
  // Short two-line bodies left the lower half of the page empty; step the body
  // size up while the columns still fit their line budget, instead of always
  // drawing at body size.
  const maxBodyLines = density ? 6 : 4;
  const bodyBudgets = ['subtitle', 'body'];
  let bodySize = typeSize(theme, 'body');
  let bodies = sides.map((side) => (side.body ? wrap(side.body, bodySize, colW) : []));
  for (const role of bodyBudgets) {
    const size = typeSize(theme, role);
    const trial = sides.map((side) => (side.body ? wrap(side.body, size, colW) : []));
    if (Math.max(...trial.map((lines) => lines.length), 1) <= maxBodyLines) {
      bodySize = size;
      bodies = trial;
      break;
    }
  }
  const tallest = Math.max(...bodies.map((lines) => lines.length), 1);
  const columnH = titleSize + 20 + tallest * Math.round(bodySize * 1.65);
  const takeawaySize = typeSize(theme, 'body');
  const takeawayLines = text.takeaway ? wrap(text.takeaway, takeawaySize, width * 0.82) : [];
  const takeawayH = takeawayLines.length ? 40 + takeawayLines.length * Math.round(takeawaySize * 1.5) : 0;
  // Centre the columns + takeaway as one block instead of pinning the takeaway
  // to the page bottom: with short bodies that left a 300px hole in the middle.
  // Keep the block top-aligned under the headline: centring it split the spare
  // space into two holes (above and below), which read worse than one at the
  // bottom. The takeaway now travels with the columns, so nothing floats.
  const spare = box.bottom - 40 - (top + columnH + takeawayH);
  if (spare < 0) top = Math.max(box.top + headlineH + 40, top + spare);

  sides.forEach((side, index) => {
    out.push(
      block({
        id: `side-title-${index + 1}`,
        lines: [side.title ?? ''],
        x: side.x,
        y: top + titleSize,
        size: titleSize,
        fill: theme.color.ink,
        weight: 700,
        family: theme.families.sans,
      }),
    );
    out.push(
      block({
        id: `side-body-${index + 1}`,
        lines: bodies[index],
        x: side.x,
        y: top + titleSize + 20 + bodySize,
        size: bodySize,
        fill: theme.color.muted,
        family: theme.families.sans,
        lineHeight: 1.65,
      }),
    );
  });

  // The divider runs the full height of both columns — the earlier version
  // stopped short and read as a stray mark.
  // When the columns are short the conclusion drops to the foot of the page and
  // the centre rule runs down to meet it, so the whitespace becomes structure.
  // takeawayAnchor lets a page override the space rule: "bottom" always pins the
  // conclusion to the foot, "flow" always keeps it under the columns, "auto"
  // (or unset) decides from the leftover space.
  const anchorMode = String(text.takeawayAnchor ?? '').trim().toLowerCase();
  const anchorBottom = anchorMode === 'bottom' ? true : anchorMode === 'flow' ? false : spare > 120;
  const takeawayBaseline = anchorBottom
    ? box.bottom - 8 - Math.max(0, takeawayLines.length - 1) * Math.round(takeawaySize * 1.65)
    : 0;
  out.push(line({ x1: midX, y1: top - 12, x2: midX, y2: anchorBottom ? takeawayBaseline - 34 : top + columnH + 12, stroke: theme.color.rule, width: theme.color.hairline }));

  if (text.takeaway && takeawayLines.length) {
    const lines = takeawayLines;
    // Anchored to the foot when the columns are short; otherwise it follows
    // them directly. A middling gap reads as an accident.
    const takeawayY = anchorBottom ? takeawayBaseline : top + columnH + 40 + Math.round(takeawaySize * 1.2);
    out.push(line({ x1: box.left, y1: takeawayY - Math.round(takeawaySize * 1.5) - 8, x2: box.left + 72, y2: takeawayY - Math.round(takeawaySize * 1.5) - 8, stroke: theme.color.accent, width: theme.geometry.ruleWeight }));
    out.push(
      block({
        id: 'takeaway',
        lines,
        x: box.left,
        y: takeawayY,
        size: typeSize(theme, 'body'),
        fill: theme.color.ink,
        weight: 700,
        family: theme.families.sans,
      }),
    );
  }
  return out.join('');
}

function processBody(page, ctx) {
  const { theme, box } = ctx;
  const text = page.text ?? {};
  const width = box.right - box.left;
  const density = page.variant === 'density';
  const steps = Array.isArray(text.steps) ? text.steps : [];
  const out = [];

  const headline = fitRole(text.headline ?? '', density ? ['headline', 'subtitle'] : ['title', 'headline'], null, width * 0.9, 2, theme);
  const headlineH = headline.lines.length * Math.round(headline.size * 1.24);
  out.push(
    block({
      id: 'headline',
      lines: headline.lines,
      x: box.left,
      y: box.top + headline.size,
      size: headline.size,
      fill: theme.color.ink,
      weight: 700,
      family: theme.families.sans,
      lineHeight: 1.24,
    }),
  );

  const top = box.top + headlineH + 72;
  const vertical = steps.length >= 4 || density;
  const stepSize = typeSize(theme, vertical ? 'subtitle' : 'body');
  const numeralSize = typeSize(theme, vertical ? 'title' : 'metric');

  if (!vertical && steps.length) {
    const gap = theme.grid.gap * 1.4;
    const cols = steps.length;
    const cellW = (width - gap * (cols - 1)) / cols;
    const bodyLines = steps.map((step) => wrap(step, stepSize, cellW));
    const tallest = Math.max(...bodyLines.map((lines) => lines.length), 1);
    const blockH = numeralSize + 34 + tallest * Math.round(stepSize * 1.6);
    const blockTop = top + Math.max(0, (box.bottom - 40 - top - blockH) * 0.34);
    steps.forEach((step, index) => {
      const x = box.left + index * (cellW + gap);
      out.push(line({ x1: x, y1: blockTop, x2: x + Math.min(96, cellW * 0.5), y2: blockTop, stroke: theme.color.accent, width: theme.geometry.ruleWeight }));
      out.push(
        block({
          id: `step-${index + 1}-numeral`,
          lines: [String(index + 1).padStart(2, '0')],
          x,
          y: blockTop + 26 + numeralSize,
          size: numeralSize,
          fill: theme.color.accent,
          weight: 700,
          family: theme.families.sans,
          lineHeight: 1,
        }),
      );
      out.push(
        block({
          id: `step-${index + 1}`,
          lines: bodyLines[index],
          x,
          y: blockTop + 26 + numeralSize + 34 + stepSize,
          size: stepSize,
          fill: theme.color.ink,
          family: theme.families.sans,
          lineHeight: 1.6,
        }),
      );
    });
  } else if (steps.length) {
    const rows = steps.length;
    const area = box.bottom - (text.note ? 96 : 24) - top;
    const rowH = Math.min(148, area / rows);
    const blockTop = top + Math.max(0, (area - rowH * rows) * 0.28);
    steps.forEach((step, index) => {
      const y = blockTop + index * rowH;
      out.push(
        block({
          id: `step-${index + 1}-numeral`,
          lines: [String(index + 1).padStart(2, '0')],
          x: box.left,
          y: y + numeralSize * 0.78,
          size: numeralSize,
          fill: theme.color.accent,
          weight: 700,
          family: theme.families.sans,
          lineHeight: 1,
        }),
      );
      out.push(
        block({
          id: `step-${index + 1}`,
          lines: wrap(step, stepSize, width - numeralSize * 1.6),
          x: box.left + numeralSize * 1.5,
          y: y + numeralSize * 0.62,
          size: stepSize,
          fill: theme.color.ink,
          family: theme.families.sans,
          lineHeight: 1.6,
        }),
      );
      if (index < rows - 1) {
        out.push(line({ x1: box.left, y1: y + rowH - 20, x2: box.right, y2: y + rowH - 20, stroke: theme.color.rule, width: theme.color.hairline }));
      }
    });
  }

  if (text.note) {
    const lines = wrap(text.note, typeSize(theme, 'meta'), width * 0.8);
    out.push(
      block({
        id: 'note',
        lines,
        x: box.left,
        y: box.bottom - 8 - (lines.length - 1) * 24,
        size: typeSize(theme, 'meta'),
        fill: theme.color.muted,
        family: theme.families.sans,
      }),
    );
  }
  return out.join('');
}

function closingBody(page, ctx) {
  const { theme, box } = ctx;
  const text = page.text ?? {};
  const width = box.right - box.left;
  const height = box.bottom - box.top;
  const density = page.variant === 'density';
  const out = [];

  // One line, always: a closing headline that breaks after "东西" reads like a
  // layout accident. fitRole drops to a smaller role instead of wrapping.
  const headline = fitRole(text.headline ?? '', density ? ['title', 'headline', 'subtitle'] : ['display', 'title', 'headline'], null, width * 0.86, 1, theme);
  const headlineH = headline.lines.length * Math.round(headline.size * 1.2);
  const actions = Array.isArray(text.actions) ? text.actions.slice(0, 3) : [];
  const stepSize = typeSize(theme, density ? 'body' : 'subtitle');
  const actionLines = actions.map((action) => wrap(action, stepSize, width * 0.78));
  const actionsH = actionLines.reduce((sum, lines) => sum + Math.max(lines.length, 1) * Math.round(stepSize * 1.6) + 34, 0);
  const groupH = headlineH + (actions.length ? 64 + actionsH : 0);
  let cursor = box.top + Math.max(40, (height - groupH - 60) * 0.44);

  out.push(rect({ x: box.left, y: cursor, w: 96, h: theme.geometry.ruleWeight, fill: theme.color.accent }));
  out.push(
    block({
      id: 'headline',
      lines: headline.lines,
      x: box.left,
      y: cursor + 40 + headline.size,
      size: headline.size,
      fill: theme.color.ink,
      weight: 700,
      family: theme.families.sans,
      lineHeight: 1.2,
    }),
  );
  cursor += 40 + headlineH;

  if (actions.length) {
    cursor += 64;
    actionLines.forEach((lines, index) => {
      out.push(
        block({
          id: `action-${index + 1}-index`,
          lines: [String(index + 1).padStart(2, '0')],
          x: box.left,
          y: cursor + stepSize * 0.72,
          size: typeSize(theme, 'meta'),
          fill: theme.color.accent,
          weight: 700,
          family: theme.families.sans,
        }),
      );
      out.push(
        block({
          id: `action-${index + 1}`,
          lines,
          x: box.left + 64,
          y: cursor + stepSize,
          size: stepSize,
          fill: theme.color.ink,
          family: theme.families.sans,
          lineHeight: 1.6,
        }),
      );
      cursor += Math.max(lines.length, 1) * Math.round(stepSize * 1.6) + 34;
      if (index < actionLines.length - 1) {
        out.push(line({ x1: box.left, y1: cursor - 8, x2: box.right, y2: cursor - 8, stroke: theme.color.rule, width: theme.color.hairline }));
      }
    });
  }

  if (text.contact) {
    out.push(
      block({
        id: 'contact',
        lines: wrap(text.contact, typeSize(theme, 'meta'), width * 0.6),
        x: box.left,
        y: box.bottom - 6,
        size: typeSize(theme, 'meta'),
        fill: theme.color.muted,
        family: theme.families.sans,
      }),
    );
  }
  return out.join('');
}

const BODIES = {
  cover: coverBody,
  statement: statementBody,
  notice: noticeBody,
  image: imageBody,
  hero: heroBody,
  metrics: metricsBody,
  comparison: comparisonBody,
  process: processBody,
  closing: closingBody,
};

const PAGE_ROLE = { cover: 'cover', closing: 'ending' };

// ------------------------------------------------------------------ public

export function renderPage(page, ctx, { part = 'all' } = {}) {
  const theme = ctx.theme;
  const archetype = page.archetype;
  const body = BODIES[archetype];
  if (!body) throw new Error(`没有「${archetype}」这个原型；可用：${Object.keys(BODIES).join(' / ')}`);
  const box = contentBox(theme, page.variant);
  const local = { ...ctx, box };
  const content = body(page, local);
  const isCover = archetype === 'cover';
  const frame = frameLayers(theme);
  const media = mediaLayer(page, theme);
  // One decoration wrapper keeps the page to three root modules (background,
  // frame, content) and gives the converter an explicit subcanvas.
  const frameBlock = frame.length
    ? `<g id="frame" data-pptx-role="decoration" data-pptx-bounds="0 0 ${CANVAS.w} ${CANVAS.h}">${frame.join('')}</g>`
    : '';
  // A full-height photo on the right must not have the footer rule or the page
  // number printed over it: the rule stops at the photo edge and the number
  // rides the text column instead.
  const footerRight = archetype === 'image' ? box.left + (box.right - box.left) * 0.4 : box.right;
  const footerBox = archetype === 'image' ? { ...box, right: footerRight } : box;
  const withFooter = isCover ? content : content + footer(theme, footerBox, ctx.pageNumber, ctx.total);

  // Mixed export splits the page here: `base` is everything that gets
  // rasterised (background, frame, photo), `text` is everything the converter
  // must keep editable. `all` stays the default the CLI and editor draw.
  const head = [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CANVAS.w} ${CANVAS.h}" width="${CANVAS.w}" height="${CANVAS.h}"`,
    ` data-pptx-page-role="${PAGE_ROLE[archetype] ?? 'content'}">`,
  ].join('');
  const base = [
    media.defs,
    rect({ id: 'bg', role: 'background', x: 0, y: 0, w: CANVAS.w, h: CANVAS.h, fill: theme.color.bg }),
    frameBlock,
    media.layer,
  ].join('');
  const text = `<g id="content" data-pptx-bounds="0 0 ${CANVAS.w} ${CANVAS.h}">${withFooter}</g>`;
  if (part === 'base') return `${head}${base}</svg>`;
  if (part === 'text') return `${head}${text}</svg>`;
  return `${head}${base}${text}</svg>`;
}

export function renderDeck(pages, { theme, total }) {
  return pages.map((page, index) =>
    renderPage(
      { ...page, variant: page.variant ?? 'impact' },
      { theme, pageNumber: index + 1, total: total ?? pages.length },
    ),
  );
}

export const ARCHETYPE_IDS = Object.keys(BODIES);
