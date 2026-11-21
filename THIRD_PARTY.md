# 第三方组件说明 / Third-party notices

## ppt-master（随插件内置 / bundled）

- 目录 / Path: `vendor/ppt-master`
- 上游 / Upstream: <https://github.com/hugohe3/ppt-master>
- 许可证 / License: MIT — Copyright (c) 2025-2026 Hugo He
- 本插件内置的是官方发行版的脚本子集：`SKILL.md`、`LICENSE`、`SPONSORS.md`、`SPONSORS_CN.md`、`requirements.txt` 与完整 `scripts/`。
- 所有文件均未修改。`scripts/attribution_guard.py` 的完整性校验保持原样并通过；请勿删除 `LICENSE` / `SPONSORS*.md` / `SKILL.md`，否则脚本会拒绝运行。
- 升级方式：用上游发行版整体替换 `vendor/ppt-master`，不要手工改其中的脚本。

本插件自身的代码以 MIT 许可证发布，见根目录 `LICENSE`。

## 运行时依赖（不随包分发 / not redistributed）

- Python 3 与 `python-pptx`（间接包含 `lxml`、`Pillow`）
- 可选：`skia-pathops`、`uharfbuzz`（合并形状等高级导出）
- 可选：Microsoft PowerPoint 桌面版（仅 PDF/PNG 导出用）
- 可选：Playwright + Chromium（仅 `check(review=true)` 的视觉回渲用）
