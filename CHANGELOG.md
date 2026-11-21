# 更新记录 / Changelog

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
