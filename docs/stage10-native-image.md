# 阶段 10 验收：原生页图片占位（v0.9.2）

日期：2026-11-24 · 项目：`C:\Users\30139\Documents\deepseek-harness\dsh-deck-studio`

## 做了什么

`native_plan.json` 的 `fields` 原先是"字段 → 文字"，现在是"字段 → 文字或图片"：

```json
{ "01_cover.svg": { "templateSlide": 1,
    "fields": { "!!title": "原生页图片占位测试", "!!logo": "images/logo.png" } } }
```

值以 `png/jpg/jpeg/webp/gif/bmp` 结尾且文件存在时，按图片处理。

## 三条口径

| 口径 | 结果 | 证据 |
|---|---|---|
| 占位换成真图片，位置大小沿用占位 | ✅ | 矩形占位 115.2×115.2pt → 缩放 1.25 倍后图片 144×144pt，落在同一坐标；见 [stage10-native-image.png](stage10-native-image.png) |
| 图片是可再编辑的原生对象 | ✅ | python-pptx 读回 `PICTURE (13)`，PowerPoint 里可裁切、可替换 |
| 图片文件缺失时提前报错 | ✅ | `status` 的 `nativePlan.problems` 出现「字段 !!logo 的图片不存在：images/nope.png」，不会走到 COM |

## 过程中修掉的三个问题

1. **图片尺寸和位置都不对**：COM 的 `Left/Top/Width/Height` 是 double，直接传给 `AddPicture` 会被丢掉，图片按默认尺寸落在 13.0in 处 → 逐个 `[single]` 转换。
2. **autofit 文本框把占位缩没了**：模板里用自动缩放文本框做占位时，插入缩放后宽高被文字撑成 76×34.5pt（原 115.2pt），图片跟着变小 → 文档写死"图片占位用矩形/图片占位符"，并在 SKILL 里给了实测数字。
3. **边删边遍历跳元素**：换图片是"新建 + 删旧"，直接 `foreach ($slide.Shapes)` 会漏形状 → 先 `@($slide.Shapes)` 快照。

## 已知边界

- 组合里的图片占位退化为"图片填充"（不能删子形状），视觉一致但对象类型不是图片。
- 表格单元格里的图片字段会被跳过（记一行日志），表格只能换文字。
- 只按扩展名 + 文件存在判断，不做图片内容校验；`images/` 之外的文件也能用（如 `templates/logo.png`）。
