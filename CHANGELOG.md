# 更新记录 / Changelog

## 0.1.2 — 修好三个"门禁说谎"的 bug

全部来自真实使用反馈：`propose` 必失败、`check` 的项目自查必失败、`review=true` 静默不出图。共同点是**工具看起来成功了**。

- 修复 `propose` 返回结构：0.1.1 仍返回旧的 `{content,data,artifacts}`，而工具输出 schema 要 `ok/action/project/message` 且 `additionalProperties:false`，所以每次 `propose` 都在写完 `direction_options.json` **之后**被 DSH 判为 invalid output。现在返回标准结构，`message` 里放方向摘要。
- 修复项目自查永远失败：`auditProject` 把 `listSvg()` 的裸文件名直接 `readText(file)`，裸名相对宿主进程 cwd（`.dsh/profiles/desktop`）解析，首个 SVG 就 ENOENT，于是字号未登记、图片缺失、<2KB 占位、`image_sources.json` 未登记四类检查**从未执行过**。改为 `path.join(project, 'svg_output', file)`。
- `check` 的验收缺口不再假装通过：新增 `data.blockers`，任何"本该跑却没跑"的事（review 没回渲、audit 抛错）都进 blockers 并让 `ok=false`；message 分三种——质量门失败 / 质量门过但验收没跑完（附"据此不要说可以交付了"）/ 全过。原先 review 失败只写 `data.reviewError`，而 `render()` 从不打印它，等于看不见。
- `check(review=true)` 先探测 live-preview 服务：`visual_review.py` 只能从项目内 `live_preview/lock.json` 或 `.live_preview.lock` 拿 URL，且 pid 要存活，否则必定失败。没服务时立刻以 blockers 报出，不再白等 240s。
- `status` 增加 `data.previewServer`（来自新增的 `livePreviewState()`）与 `data.runtime.visualReview`（`lib/paths.mjs` 新增 `detectVisualReview()`，探测 `import playwright.sync_api`）；缺 playwright 时 message 直接给安装命令。
- 新增 `scripts/smoke-deck.mjs`：用 stub 绕过 DSH-only 依赖，驱动真实 action，逐项校验返回值符合 `deckOutput().schema`，并用故意留的两个缺陷（37px 未登记字号、缺失 `<image href>`）证明自查真的在跑、`review` 无服务时确实 `ok=false`。`node scripts/smoke-deck.mjs`。

## 0.1.1 — 内容红队进流程

- 新增 `skills/deck-studio/SKILL.md` §2.4 大纲红队（写 SVG 之前，不可跳过）：每页写「主张 / 支撑 / 反问」三行进 `slide_claims.md`，用四个问题攻击（删页损失什么、数字哪来的、听众第一个反问、只讲三页留哪三页）；一页两主张即拆页；8 页以上、答辩或评优必做，纯活动通知可跳过但要在交付说明里写明。
- §3「质检」补一句「这道门不是全部」：`check` 与 `data.audit` 只查结构、字号、图片登记，不判断内容是否值得讲。
- `## 交付前检查` 首项改为红队检查项，与 `~/.dsh/AGENTS.md` 的「演示文稿与网页交付」三条对齐。
- 无代码改动：插件仍是 link 安装，本次只改 skill 正文与版本号。

## 0.1.0 — 首个可分发包 / First shareable build

- 内置官方 `ppt-master` 脚本子集到 `vendor/ppt-master`（MIT，未修改，完整性门 `attribution_guard.py` 通过），接收方不再需要单独安装该技能。
- 新增 `lib/paths.mjs`：自动探测 Python（优先能 `import pptx` 的解释器）与 ppt-master 根目录；去掉所有写死的用户名与安装路径。
- `deck status` 返回 `runtime`（`python` / `pythonFound` / `pythonHasPptxDeps` / `skillRoot` / `bundledSkill`）。
- 缺 Python、缺依赖、`vendor` 被破坏时给出可操作的中文错误提示。
- `scripts/animate-deck.ps1` 支持独立运行（自动定位 bundled skill、回退 `python`），修复 `powershell -File` 下 `$PSScriptRoot` 为空导致的路径错误。
- 新增 `LICENSE`（MIT）、`THIRD_PARTY.md`、`INSTALL.md`（中英双语）、本 `CHANGELOG.md`；重写 `README.md`。
- 新增 `scripts/pack-zip.py`：一条命令重建分发包。
