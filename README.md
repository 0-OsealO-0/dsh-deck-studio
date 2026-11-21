# Deck Studio

一个 Host-only 的 DeepSeek Harness 插件，把本机 PPT 工作流收成一个 `deck` 工具：

- `propose`：出三个候选视觉方向（写 `confirm_ui/direction_options.json`），让用户先选
- `init`：建项目骨架（`source.md` / `design_spec.md` / `spec_lock.md` / `svg_output` / `exports`）；`option=<id>` 会把选中方向落进 `spec_lock`
- `status`：看还缺什么，并报告当前探测到的 Python / ppt-master 路径
- `check`：跑 SVG 质量门，可选 `visual_review` 回渲 PNG
- `export`：SVG → 可编辑 PPTX，自动修中文字体；若已有 `animations.json` 会自动注入动画；可选 PDF/PNG
- `html`：把 SVG 页面内联成单文件键盘导航演示
- `animate`：先 DryRun 出提案，确认后 Apply 写 `animations.json`；只对顶层 group 生效

A host-only DeepSeek Harness plugin that wraps the local PPT pipeline into one `deck` tool. See [INSTALL.md](INSTALL.md) for the bilingual install guide.

## 为什么不是“再做一个 PPT 生成器”

生成 SVG 的能力在 `ppt-master` 里已经有了。真正拖后腿的是交付链：

1. OTF 字体 PowerPoint 不认，需要 TTF 家族；
2. 主题字体被 `FONT_FALLBACK_WIN` 映射成 SimSun/微软雅黑，需要按 `spec_lock` 回写；
3. 质量门、回渲、PDF 导出、动画注入分散在多个脚本；
4. 网页 deck 和 PPTX 各做一套，容易分叉。

本插件只做“收口”，不复制生成逻辑。`ppt-master` 以官方 MIT 发行版子集内置在 `vendor/ppt-master`（含 LICENSE 与 SPONSORS，脚本未修改），见 [THIRD_PARTY.md](THIRD_PARTY.md)。

## 安装

```text
plugin_manager(action="install_bundle", target="D:\\plugins\\dsh-deck-studio")
```

`target` 指向解压后的插件目录，也可以是 `git+https://...`。安装后新会话里应出现 `deck` 工具与 `deck-studio` skill。完整步骤、配置项与排错见 [INSTALL.md](INSTALL.md)。

## 依赖

- **Python 3.10+**，且 `import pptx` 可用（`pip install python-pptx`）。插件会按
  `DSH_DECK_PYTHON` → `DSH_PYTHON` → `PYTHON` → DSH 运行时 → 常规安装 → PATH
  的顺序自动探测，并优先选择能导入 `python-pptx` 的解释器。
- **内置** `vendor/ppt-master`（`svg_to_pptx.py`、`svg_quality_checker.py`、`visual_review.py`、`animation_config.py`）。
- **可选** PowerPoint 桌面版（仅 PDF/PNG）、Playwright + Chromium（仅视觉回渲）。
- **字体**：微软雅黑 / 宋体可用；正式交付建议装思源黑体、思源宋体 TTF。

所有路径都可在插件 Config 里覆盖（`python`、`skillRoot`、`defaultProfile`、`timeoutMs`），不依赖任何特定用户名或安装位置。

## 典型用法

```text
deck(action="propose", project="D:\\work\\demo", profile="formal", title="月报", brief="三分钟讲清本月三件事")
# 用户选定后
deck(action="init", project="D:\\work\\demo", profile="formal", title="月报", brief="…", option="navy-brief")
deck(action="check", project="D:\\work\\demo", review=true)
deck(action="export", project="D:\\work\\demo", format="all")
deck(action="html", project="D:\\work\\demo")
deck(action="animate", project="D:\\work\\demo", profile="formal")
```

`project` 必须是绝对路径；插件工具没有 cwd。

写 SVG 之前先做一轮**大纲红队**（SKILL.md §2.4）：每页写「主张 / 支撑 / 反问」三行进 `slide_claims.md`，删掉删了不损失什么的页、删掉没有来源的数字。`check` 通过不等于内容值得讲——它还查不了这件事。

## 设计边界

- 不替代 `ppt-master` 的 Strategist/Executor，也不改它的源码。
- 不把 HEX/字体塞进 `visual_style`；分层保持“版式语言进 style，配色/字体进 spec_lock”。
- 动画默认关闭；DryRun 是硬门，防止一键给整套 deck 加飞入。
- 生成前必须先 `propose` 给方向、用户选定后 `init option=`；用户说"你定"才可以自己挑。
- `check` 失败时直接列前 5 条错误，并附 `audit` 自查（字号未登记、图片缺失/未登记版权）。
- 不承诺跨机器字体一致；正式交付优先 PDF。

## 目录

```text
index.js                  Host 插件入口 + deck 工具 + skill provider
lib/paths.mjs             Python / ppt-master / 运行时自动探测
vendor/ppt-master/        内置的官方 ppt-master 脚本（MIT，未修改）
cordis.patch.yml          bundle patch
templates/                三套 spec_lock 模板
scripts/                  fix-pptx-cjk-fonts.py / pptx-export.ps1 / animate-deck.ps1
skills/deck-studio/       工作流说明
locale/                   插件卡片文案
INSTALL.md                双语安装、配置与排错
THIRD_PARTY.md            第三方组件与许可证
```

## 许可证

插件自身 MIT，见 [LICENSE](LICENSE)。内置的 `ppt-master` 同样是 MIT，版权归 Hugo He，完整声明保留在 `vendor/ppt-master/LICENSE`。
