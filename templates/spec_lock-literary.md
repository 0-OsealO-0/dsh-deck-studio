<!-- ppt-master-schema: spec-lock/v1 -->
# Execution Lock

## canvas
- viewBox: 0 0 1600 900
- format: PPT 16:9

## communication
- primary_language: zh-Hans-CN
- audience: 班级同学、文学社、分享会观众
- objective: 用克制的版面和可读的文字，让观众把注意力放在内容本身
- core_message: 一次安静的分享，留下一句话或一个画面
- consumption_mode: presentation

## mode
- mode: narrative

## visual_style
- visual_style: custom
- visual_style_behavior: Quiet specimen sheet: rectilinear composition with 120–160px margins, hairline rules and one double rule, square corners, no cards, no shadows, no texture. One oversized serif headline or one poem per page; asymmetric left-aligned text with 45–55% whitespace; type specimens may use baseline/cap-height guides on one page only. Typography is a high-contrast serif for display, a clean sans or serif for body, and a kai face for quotations only; hierarchy by scale and weight, never by color. Oat paper and near-black ink carry 95% of the page; one ink-blue mark under 5%. Flat and quiet. At most one square, low-saturation or black-and-white photograph per page, captioned with facts; no decorative illustration.
- visual_style_references: editorial

## colors
- bg: #F6F0E4
- surface: #EDE3D2
- text: #241F1A
- muted: #7A6E5F
- primary: #2E4A8A
- on_primary: #FFFFFF
- accent: #2E4A8A
- rule: #D8CBB8

## typography
- font_family: Source Han Sans SC TTF
- title_family: Source Han Serif SC TTF
- body_family: Source Han Sans SC TTF
- quote_family: LXGW WenKai
- body: 20
- title: 72
- subtitle: 30
- caption: 12
- page_number: 10

## icons
- library: none
- inventory: none

## page_rhythm
- P01: anchor
- P02: breathing
- P03: dense
- P04: breathing
- P05: anchor
- P06: dense
- P07: breathing
- P08: anchor

## pptx_structure
- mode: flat

## forbidden
- `mask`, `<style>`, `class`, external CSS, `<foreignObject>`, `textPath`, `@font-face`, `<animate*>`, `<set>`, `<script>` / event attributes, `<iframe>`
- HTML named entities in text; write typography as raw Unicode and escape XML reserved characters
- 水墨、印章、金色“新中式”三件套
- 书法体做大标题、竖排正文
- 三张等宽卡片、圆角、阴影
- 紫蓝渐变、发光、emoji 图标
