<!-- ppt-master-schema: spec-lock/v1 -->
# Execution Lock

## canvas
- viewBox: 0 0 1600 900
- format: PPT 16:9

## communication
- primary_language: zh-Hans-CN
- audience: 班级同学与辅导员
- objective: 用一页一个结论的方式，让观众在 10 分钟内理解现状、判断和下一步
- core_message: 这学期班级宣传工作的关键判断与下一步动作
- consumption_mode: presentation

## mode
- mode: pyramid

## visual_style
- visual_style: custom
- visual_style_behavior: Rectilinear editorial grid: 12 columns, hard left alignment, 96px outer margins, square corners, 1px hairlines and one 4px rule, no cards or shadows. One large element per page (headline, numeral, image, or color field); asymmetric 8/4 or 7/5 splits; 35–45% whitespace. Typography is a tight sans headline over the same sans body, with a serif reserved for pull quotes; hierarchy by size and weight, never by decorative color. Paper and ink carry 90% of the page; one structural field color and one small mark color only. Flat, no texture, no gradients, no elevation. Photography is square or 4:3, true color, hairline-framed, captioned with facts.
- visual_style_references: swiss-minimal, editorial

## colors
- bg: #F7F7F4
- surface: #ECECE6
- text: #1B2430
- muted: #6B7280
- primary: #2F4FA3
- on_primary: #FFFFFF
- accent: #C23B2A
- rule: #D9D9D3

## typography
- font_family: Source Han Sans SC TTF
- title_family: Source Han Sans SC TTF
- body_family: Source Han Sans SC TTF
- quote_family: Source Han Serif SC TTF
- body: 20
- title: 54
- subtitle: 28
- caption: 12
- page_number: 10

## icons
- library: none
- inventory: none

## page_rhythm
- P01: anchor
- P02: breathing
- P03: dense
- P04: anchor
- P05: dense
- P06: breathing
- P07: dense
- P08: anchor
- P09: breathing
- P10: anchor

## pptx_structure
- mode: flat

## forbidden
- `mask`, `<style>`, `class`, external CSS, `<foreignObject>`, `textPath`, `@font-face`, `<animate*>`, `<set>`, `<script>` / event attributes, `<iframe>`
- HTML named entities in text; write typography as raw Unicode and escape XML reserved characters
- 三张等宽卡片 + 图标 + 两行说明
- card-in-card、圆角卡片、投影、玻璃拟态
- 每页标题上方的小标签（eyebrow）
- 紫蓝渐变、发光、彩虹图表、emoji 图标
