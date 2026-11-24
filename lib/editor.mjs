// Single-file browser editor for scaffolded decks.
//
// Why a generated HTML and not a server: the plugin runs inside the agent host
// and must not leave a daemon behind. The page inlines the same three modules
// the scaffold uses (themes, contracts, skeleton), so what the user sees in the
// browser is rendered by the very same code that will write the SVG files —
// there is no second renderer to drift.
//
// Saving goes through the File System Access API: the user picks the project
// folder once, and the page writes page_plan.json plus every svg_output file
// directly. No server, no upload, no copy-paste of JSON.

const HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>__TITLE__ · 编辑</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin: 0; height: 100vh; display: grid; grid-template-rows: 52px 1fr;
         background: #17181c; color: #e8e9ee;
         font: 13px/1.5 "Microsoft YaHei UI", "Segoe UI", system-ui, sans-serif; }
  header { display: flex; align-items: center; gap: 12px; padding: 0 16px;
           border-bottom: 1px solid #2b2d34; background: #1d1f24; }
  header h1 { font-size: 14px; font-weight: 600; margin: 0; }
  header .muted { color: #8d92a3; }
  main { display: grid; grid-template-columns: 208px minmax(0, 1fr) 336px; min-height: 0; }
  nav { border-right: 1px solid #2b2d34; overflow: auto; padding: 8px; }
  nav button { display: block; width: 100%; text-align: left; padding: 7px 10px; margin-bottom: 4px;
               border: 1px solid transparent; border-radius: 6px; background: transparent;
               color: #c9ccd8; font: inherit; cursor: pointer; }
  nav button:hover { background: #24262d; }
  nav button.active { background: #2a2d36; border-color: #3b3f4b; color: #fff; }
  nav .num { color: #7c8193; margin-right: 8px; font-variant-numeric: tabular-nums; }
  .stage { display: flex; align-items: center; justify-content: center; padding: 22px; overflow: auto; }
  .sheet { width: 100%; max-width: 1080px; aspect-ratio: 16 / 9; background: #fff;
           box-shadow: 0 16px 40px rgba(0,0,0,.45); border-radius: 2px; overflow: hidden; }
  .sheet svg { display: block; width: 100%; height: 100%; }
  aside { border-left: 1px solid #2b2d34; overflow: auto; padding: 14px; }
  .field { margin-bottom: 14px; }
  .field label { display: flex; justify-content: space-between; gap: 8px;
                 color: #9aa0b0; margin-bottom: 5px; }
  .field .budget { font-variant-numeric: tabular-nums; }
  .field .budget.over { color: #ff7b72; }
  .field .budget.near { color: #e3b341; }
  .field input, .field textarea, .field select {
    width: 100%; padding: 7px 9px; border-radius: 6px; border: 1px solid #353944;
    background: #202329; color: #eef0f6; font: inherit; resize: vertical; }
  .field textarea { min-height: 64px; }
  .field input:focus, .field textarea:focus { outline: 1px solid #5a7ad6; border-color: #5a7ad6; }
  .row { display: flex; gap: 8px; align-items: center; }
  .row button { flex: 1; }
  button.primary { background: #3b62d9; border: 1px solid #4a70e6; color: #fff; }
  button { padding: 8px 12px; border-radius: 6px; border: 1px solid #3a3e49;
           background: #24272f; color: #dfe3ee; font: inherit; cursor: pointer; }
  button:hover { background: #2c3039; }
  button:disabled { opacity: .45; cursor: default; }
  .status { margin-top: 10px; color: #8d92a3; white-space: pre-wrap; }
  .status.ok { color: #56d364; }
  .status.err { color: #ff7b72; }
  .hint { color: #7c8193; font-size: 12px; line-height: 1.5; margin-top: 10px; }
  .badge { display: inline-block; padding: 1px 7px; border-radius: 99px; background: #2a2d36;
           color: #9aa0b0; font-size: 11px; }
  h2 { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: #7c8193;
       margin: 0 0 10px; }
  hr { border: 0; border-top: 1px solid #2b2d34; margin: 16px 0; }
</style>
</head>
<body>
<header>
  <h1>__TITLE__</h1>
  <span class="muted" id="meta">__META__</span>
  <span style="flex:1"></span>
  <label class="muted">主题
    <select id="theme" style="margin-left:6px;padding:5px 8px;border-radius:6px;border:1px solid #3a3e49;background:#24272f;color:#dfe3ee;font:inherit"></select>
  </label>
  <button id="save" class="primary">保存到项目目录</button>
  <button id="download">下载 JSON</button>
</header>
<main>
  <nav id="pages"></nav>
  <section class="stage"><div class="sheet" id="sheet"></div></section>
  <aside>
    <h2>这一页</h2>
    <div id="form"></div>
    <hr>
    <div class="hint" id="hint">
      第一次保存会弹出目录选择：选这个 deck 的项目目录（里面有 <code>page_plan.json</code> 和 <code>svg_output/</code>）。
      保存会同时写 <code>page_plan.json</code> 与所有页面 SVG，之后跑 <code>deck check</code> 复核。
    </div>
    <div class="status" id="status"></div>
  </aside>
</main>
<script type="module">
/* ---- inlined: lib/themes.mjs ---- */
__THEMES__
/* ---- inlined: lib/page-contracts.mjs ---- */
__CONTRACTS__
/* ---- inlined: lib/skeleton.mjs ---- */
__SKELETON__
/* ---- editor ---- */
const PLAN = __DATA__;
const state = JSON.parse(JSON.stringify(PLAN.plan));
const files = PLAN.files;
const slots = PLAN.slots;
const themeSelect = document.getElementById('theme');
const sheet = document.getElementById('sheet');
const form = document.getElementById('form');
const pagesEl = document.getElementById('pages');
const statusEl = document.getElementById('status');
let index = 0;
let currentTheme = PLAN.theme;
// name → File, filled by the image picker. Bytes stay out of page_plan.json and
// are written to images/ only when the author saves.
const pendingMedia = new Map();

// Pages that predate scaffold have no file name yet; the editor is the place
// they get one, so page_plan.json and svg_output stay in step after a save.
state.pages.forEach((page, i) => { if (!page.file) page.file = files[i]; });

function len(value) {
  return Array.from(stripOrdinal(String(value || ''))).length;
}

function listValue(value) {
  if (Array.isArray(value)) return value.join('\\n');
  return String(value || '');
}

function readField(input, slot) {
  const raw = input.value;
  return slot.list ? raw.split(/\\r?\\n/).map((s) => s.trim()).filter(Boolean) : raw;
}

function budgetClass(used, max) {
  if (!max) return '';
  if (used > max) return 'over';
  if (used >= max * 0.9) return 'near';
  return '';
}

function pageTitle(page) {
  const text = page.text || {};
  return String(text.title || text.headline || text.kicker || page.file);
}

function renderPages() {
  pagesEl.innerHTML = '';
  state.pages.forEach((page, i) => {
    const btn = document.createElement('button');
    btn.className = i === index ? 'active' : '';
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = String(i + 1).padStart(2, '0');
    btn.appendChild(num);
    btn.appendChild(document.createTextNode(pageTitle(page)));
    btn.title = page.file + ' · ' + page.archetype + ' · ' + (page.variant || 'impact');
    btn.addEventListener('click', () => { index = i; renderAll(); });
    pagesEl.appendChild(btn);
  });
}

function renderForm() {
  const page = state.pages[index];
  const contract = ARCHETYPES[page.archetype] || { slots: [] };
  form.innerHTML = '';

  const variant = document.createElement('div');
  variant.className = 'field';
  variant.innerHTML = '<label>版式强度</label>';
  const row = document.createElement('div');
  row.className = 'row';
  ['impact', 'density'].forEach((v) => {
    const btn = document.createElement('button');
    btn.textContent = v === 'impact' ? '主张版' : '信息版';
    btn.className = (page.variant || 'impact') === v ? 'primary' : '';
    btn.addEventListener('click', () => { page.variant = v; renderAll(); });
    row.appendChild(btn);
  });
  variant.appendChild(row);
  form.appendChild(variant);

  contract.slots.forEach((slot) => {
    const wrap = document.createElement('div');
    wrap.className = 'field';
    const label = document.createElement('label');
    const name = document.createElement('span');
    name.textContent = slot.label + (slot.required ? ' *' : '');
    const budget = document.createElement('span');
    budget.className = 'budget';
    label.appendChild(name);
    label.appendChild(budget);

    let input;
    if (slot.media) {
      const mediaRow = document.createElement('div');
      mediaRow.className = 'row';
      input = document.createElement('input');
      input.value = page.text?.[slot.key] || '';
      input.placeholder = 'images/photo.jpg';
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.textContent = '选图…';
      const fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = 'image/*';
      fileInput.style.display = 'none';
      pick.addEventListener('click', () => fileInput.click());
      fileInput.addEventListener('change', () => {
        const file = fileInput.files && fileInput.files[0];
        if (!file) return;
        // Keep the bytes in memory and only write them on save: picking a photo
        // must not touch the project until the author commits the page.
        const name = file.name.replace(/[^\\w.\\-\\u4e00-\\u9fff]+/g, '_');
        pendingMedia.set(name, { file, url: URL.createObjectURL(file) });
        page.text = page.text || {};
        page.text[slot.key] = 'images/' + name;
        input.value = page.text[slot.key];
        updateBudget();
        renderPreview();
        renderPages();
        setStatus('已登记 images/' + name + '，保存时写进项目。', '');
      });
      mediaRow.appendChild(input);
      mediaRow.appendChild(pick);
      mediaRow.appendChild(fileInput);
      input.dataset.slot = slot.key;
      input.addEventListener('input', () => {
        page.text = page.text || {};
        page.text[slot.key] = input.value.trim();
        updateBudget();
        renderPreview();
      });
      wrap.appendChild(label);
      wrap.appendChild(mediaRow);
      form.appendChild(wrap);
      return;
    }
    if (slot.list) {
      input = document.createElement('textarea');
      input.rows = Math.max(2, (page.text?.[slot.key] || []).length + 1);
      input.value = listValue(page.text?.[slot.key]);
      input.placeholder = '一行一条，最多 ' + slot.max + ' 条';
    } else if ((slot.max || 0) > 40) {
      input = document.createElement('textarea');
      input.rows = 3;
      input.value = page.text?.[slot.key] || '';
    } else {
      input = document.createElement('input');
      input.value = page.text?.[slot.key] || '';
    }
    input.dataset.slot = slot.key;
    input.addEventListener('input', () => {
      page.text = page.text || {};
      page.text[slot.key] = readField(input, slot);
      updateBudget();
      renderPreview();
      renderPages();
    });
    wrap.appendChild(label);
    wrap.appendChild(input);
    form.appendChild(wrap);
  });

  form._budgets = () => {
    const nodes = form.querySelectorAll('.field .budget');
    let i = 0;
    contract.slots.forEach((slot) => {
      const value = state.pages[index].text?.[slot.key];
      let used;
      let max = slot.max;
      if (slot.media) {
        const node0 = nodes[i++];
        if (!node0) return;
        node0.textContent = value ? '已选 1 张' : '未选图';
        node0.className = 'budget ' + (value ? '' : slot.required ? 'over' : '');
        return;
      }
      if (slot.list) {
        const items = Array.isArray(value) ? value : [];
        used = items.length;
        max = slot.itemMax || slot.max;
      } else {
        used = len(value);
      }
      const node = nodes[i++];
      if (!node) return;
      if (slot.required && used === 0) {
        node.textContent = '必填';
        node.className = 'budget over';
        return;
      }
      node.textContent = used + ' / ' + max + (slot.list ? ' 条' : ' 字');
      node.className = 'budget ' + budgetClass(used, max);
    });
  };
  updateBudget();
}

function updateBudget() {
  if (form._budgets) form._budgets();
}

function withPendingMedia(html) {
  let out = html;
  pendingMedia.forEach((entry, name) => {
    out = out.split('../images/' + name).join(entry.url);
  });
  return out;
}

function renderPreview() {
  const page = state.pages[index];
  try {
    sheet.innerHTML = withPendingMedia(renderPage(page, { theme: getTheme(currentTheme), pageNumber: index + 1, total: state.pages.length }));
  } catch (error) {
    sheet.innerHTML = '';
    statusEl.className = 'status err';
    statusEl.textContent = '渲染失败：' + (error && error.message);
  }
}

function renderAll() {
  renderPages();
  renderForm();
  renderPreview();
}

function bodyText(page) {
  return String((page.text && (page.text.title || page.text.headline)) || page.file);
}

function header(page) {
  return '<!-- deck-scaffold theme="' + currentTheme + '" archetype="' + page.archetype +
    '" variant="' + (page.variant || 'impact') + '" -->\\n';
}

function planJson() {
  const plan = JSON.parse(JSON.stringify(state));
  plan.version = 1;
  plan.profile = plan.profile || PLAN.profile;
  plan.theme = currentTheme;
  return JSON.stringify(plan, null, 2) + '\\n';
}

function setStatus(text, cls) {
  statusEl.className = 'status ' + (cls || '');
  statusEl.textContent = text;
}

async function save() {
  if (!window.showDirectoryPicker) {
    setStatus('这个浏览器不支持直接写目录（需要 Chrome 或 Edge）。用「下载 JSON」后手动覆盖 page_plan.json。', 'err');
    return;
  }
  let dir;
  try {
    dir = await window.showDirectoryPicker({ mode: 'readwrite', id: 'deck-studio' });
  } catch (error) {
    return;
  }
  try {
    const probe = await dir.getFileHandle('page_plan.json');
    await probe.getFile();
  } catch (error) {
    setStatus('这个目录里没有 page_plan.json —— 要选项目根目录（不是 svg_output）。', 'err');
    return;
  }
  setStatus('正在保存…');
  try {
    const planHandle = await dir.getFileHandle('page_plan.json', { create: true });
    const planStream = await planHandle.createWritable();
    await planStream.write(planJson());
    await planStream.close();

    const svgDir = await dir.getDirectoryHandle('svg_output', { create: true });
    let written = 0;
    for (let i = 0; i < state.pages.length; i += 1) {
      const page = state.pages[i];
      const name = page.file || (String(i + 1).padStart(2, '0') + '_' + page.archetype + '.svg');
      const handle = await svgDir.getFileHandle(name, { create: true });
      const stream = await handle.createWritable();
      await stream.write(header(page) + renderPage({ ...page, file: name }, { theme: getTheme(currentTheme), pageNumber: i + 1, total: state.pages.length }) + '\\n');
      await stream.close();
      written += 1;
    }

    let images = 0;
    if (pendingMedia.size > 0) {
      const imagesDir = await dir.getDirectoryHandle('images', { create: true });
      for (const [name, entry] of pendingMedia) {
        const handle = await imagesDir.getFileHandle(name, { create: true });
        const stream = await handle.createWritable();
        await stream.write(await entry.file.arrayBuffer());
        await stream.close();
        images += 1;
      }
      pendingMedia.clear();
    }

    setStatus(
      '已保存：page_plan.json + ' + written + ' 页 SVG' + (images ? ' + ' + images + ' 张图' : '') + '。\\n下一步：deck check 复核，或 deck export 出 PPTX。',
      'ok',
    );
  } catch (error) {
    setStatus('保存失败：' + (error && error.message), 'err');
  }
}

function download() {
  const blob = new Blob([planJson()], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'page_plan.json';
  a.click();
  URL.revokeObjectURL(url);
}

themeSelect.innerHTML = '';
THEME_IDS.forEach((id) => {
  const option = document.createElement('option');
  option.value = id;
  option.textContent = THEMES[id].label;
  option.selected = id === currentTheme;
  themeSelect.appendChild(option);
});
themeSelect.addEventListener('change', () => {
  currentTheme = themeSelect.value;
  renderPreview();
});

document.getElementById('save').addEventListener('click', save);
document.getElementById('download').addEventListener('click', download);
document.addEventListener('keydown', (event) => {
  if (event.target.closest('input, textarea, select')) return;
  if (event.key === 'ArrowDown' || event.key === 'PageDown') {
    index = Math.min(state.pages.length - 1, index + 1);
    renderAll();
    event.preventDefault();
  }
  if (event.key === 'ArrowUp' || event.key === 'PageUp') {
    index = Math.max(0, index - 1);
    renderAll();
    event.preventDefault();
  }
});

renderAll();

// Small, read-only handle for the smoke suite: verifies the generated page
// carries the same contract and renderer the CLI does, without a real picker.
window.__deckEditor = {
  get pageCount() { return state.pages.length; },
  get theme() { return currentTheme; },
  planJson: () => planJson(),
};
</script>
</body>
</html>
`;

/**
 * Strip ESM syntax so the three modules can share one browser scope.
 * They are written for this: the only import in the trio is skeleton's
 * `typeSize`, and the only collisions would be duplicate names, which the
 * current sources do not have.
 */
function inlineModule(source) {
  const stripped = source
    .replace(/^import\s.*$/gm, '')
    .replace(/^export\s+/gm, '')
    .replace(/^\s*\n/, '');
  // Guard: inlining only works while the modules stay import-free. If someone
  // adds a default export or a new import, fail here instead of shipping a
  // page that silently renders half a deck.
  if (/^\s*import\s/m.test(stripped) || /\bexport\s+default\b/.test(stripped)) {
    throw new Error('lib/editor.mjs 只能内联无 import / 无 default export 的模块');
  }
  return stripped;
}

export function buildEditorHtml({ title, profile, themeId, plan, files, modules }) {
  const data = {
    plan,
    files,
    profile,
    theme: themeId,
    slots: undefined,
  };
  // Slots are read inside the page from the inlined ARCHETYPES; keep DATA lean.
  const payload = JSON.stringify(data, null, 2);

  return HTML_TEMPLATE
    .replace('__TITLE__', escapeHtml(title))
    .replace('__TITLE__', escapeHtml(title))
    .replace('__META__', escapeHtml(`${plan.pages.length} 页 · ${profile} · ${themeId}`))
    .replace('__THEMES__', inlineModule(modules.themes))
    .replace('__CONTRACTS__', inlineModule(modules.contracts))
    .replace('__SKELETON__', inlineModule(modules.skeleton))
    .replace('__DATA__', payload);
}

export function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
