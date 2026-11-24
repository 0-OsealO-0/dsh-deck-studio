# Vendor 改动登记

`vendor/` 是从 ppt-master 拷进来的第三方代码。**升级 vendor 前先看这份清单**，升级后逐条补回并复测；每一条都写了为什么改、怎么验证。

## 1. 首行上沿估算 0.85em → 0.98em（v0.5.1）

- 文件：`vendor/ppt-master/scripts/svg_to_pptx/drawingml/elements.py`
- 位置：`_text_line_vertical_extent()`，原 `ascent = font_size * 0.85`
- 改动：`ascent = font_size * 0.98`（保留上方 6 行注释）
- 为什么：转换器按 0.85em 估首行上沿，PowerPoint 实际按约 0.98em 放首行基线，导出的每个文本框整体偏低 0.11–0.14em（100px 字号下 11–14px，标题 128px 下 13–14px）。
- 事实依据：`data-pptx-frame` 只改 `top_inset`，文本框顶 + 内边距恒等于 `visual_box_y`，改它不影响基线（实测补 frame 前后 `dy` 完全一致：3 / 7 / 16px）。真正能改基线的只有这个 ascent 估算。
- 复测：五种字体（思源黑体/思源宋体/微软雅黑/Arial/Consolas）100px，`dy` 从 +11～+14 变为 −2～+1；四页样本标题带 `dy` = 0 / 0 / −1 / 0。
- 复测命令：PowerPoint COM 逐页导 PNG（1600×900）→ headless Chrome 直接打开 SVG 截图 → `bands.py` 比标题带、`inkbox.py` 比单块墨迹。
- 注意：这个常数也影响文本框高度（`ascent + descent + 0.30em`），改完要跑一遍 `deck check` 与 `deck export`（矢量 + `mixed=true`）确认没有越界告警。

## 其他改动

目前没有第二处。若以后要改 vendor，按上面的格式追加编号、文件、位置、原因、复测方法。
