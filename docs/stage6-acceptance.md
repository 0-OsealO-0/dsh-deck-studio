# 阶段 6 验收：主题扩容 + 结论位置开关

日期：2026-11-24 · 版本 0.7.0

## 这一阶段做了什么

1. 把"对比页结论落哪"从按剩余空间自动判定，改成 `page_plan.json` 里的槽位开关 `takeawayAnchor`。
2. 主题从 5 套扩到 7 套：新增 `warm-sand`（活动·浅底）与 `ink-water`（文艺·宋体）。
3. 新增字体授权台账 `docs/theme-fonts.md`，并把"每个主题都在表里"写进冒烟。
4. 顺手修掉一个只有宽字体主题才暴露的问题：`closing` 页标题会折出孤字（宋体更宽）。

## 验收口径

| 口径 | 结果 | 证据 |
| --- | --- | --- |
| 结论位置可控 | ✅ | 同一页 `flow` → 结论基线 `y=462`；`bottom` → `y=796`（页脚）；`auto` 与 `bottom` 一致。写 `middle` 会被 `brief`/`check` 点名「只接受 auto / bottom / flow」 |
| 新主题肉眼可辨且可导出 | ✅ | `warm-sand` / `ink-water` 各画 7 个原型，`check` 均 `ok=true`（8 条 warning 全是已知的思源字体非 PPT-safe + 图片分辨率）；`docs/stage6-new-themes.png` 为两套主题 × 7 页对照 |
| 门禁不放宽 | ✅ | 主题只改配色/字阶/几何参数，没有新增任何 `skip` 或降级分支；冒烟 60/60 |
| 字体授权有据可查 | ✅ | `docs/theme-fonts.md` 列出 7 套主题的标题/正文/回退字体与许可；冒烟断言每个主题 id 都在表中 |
| 收束页标题不折行 | ✅ | `closing` 的 `fitRole` 改为单行优先、允许降一档字号；`ink-water` 9 字标题由两行（`…三样东` / `西`）改为一行 |

## 自动检查

```text
node scripts/smoke-deck.mjs   →  全部通过（60 项）
deck(action="check")           →  ok=true, 8 warnings（均为已知项）
deck(action="export")          →  ok=true, 8 页，358 KB 量级
```

## 已知边界

- 主题仍然是"一套版式语言"，不是 1020 个版式；同一主题下同一原型的版面关系固定，差异来自文案与变体。
- `takeawayAnchor` 只作用于 `comparison`；其它原型没有"结论条"这个概念。
- 两套新主题的配图与图表能力跟老主题一样：有 `image` 槽位，没有图表原型。
- 字体仍依赖本机安装；`SimSun` / `Microsoft YaHei` 只是回退，不能随 PPTX 分发。

## 下一步候选

- campaign 侧原型（招新大图页、活动预告页）——比继续加主题更值钱。
- 图表原型（柱/折线/占比），需要先定"数据从哪来、缺数据怎么降级"。
- 阶段 5 遗留：`native_plan.json` 的字段替换目前只支持 `!!字段名` 文本占位，不支持图片占位。
