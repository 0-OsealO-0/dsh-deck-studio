<!-- ppt-master-schema: spec-lock/v1 -->
# Execution Lock

## canvas
- viewBox: 0 0 1600 900
- format: PPT 16:9

## communication
- primary_language: zh-Hans-CN
- audience: 班级同学、其他班同学、活动参与者
- objective: 让观众在 30 秒内知道这是什么活动、什么时候、在哪、怎么报名
- core_message: 一场值得来的班级活动，时间地点和报名方式一眼可见
- consumption_mode: presentation

## mode
- mode: showcase

## visual_style
- visual_style: custom
- visual_style_behavior: Proof-sheet poster: rectilinear 12-column layout with 72–96px margins, square corners, full-bleed photography, 1px crop marks and construction rules around one hero element only, no cards or shadows. One action per page: cover, timeline, process strip, FAQ, or recap; asymmetric composition with one oversized numeral or headline. Typography pairs one expressive display face for the cover headline only with a clean sans body; hierarchy by scale and one solid action block, never by decorative color. Cool proof white and near-black ink carry the page; one warm action color under 10%, one cool slate under 5%. Flat, minimal texture on covers only. Photography is true-color documentary; duotone only on atmosphere pages; text over images always sits on a solid scrim.
- visual_style_references: editorial, photo-editorial

## colors
- bg: #F4F7F7
- surface: #E4ECEE
- text: #101A22
- muted: #5F6B73
- primary: #E36B2C
- on_primary: #101A22
- accent: #2F6F7E
- rule: #C9D3D6

## typography
- font_family: Source Han Sans SC TTF
- title_family: Smiley Sans Oblique
- body_family: Source Han Sans SC TTF
- number_family: Glow Sans SC Normal TTF
- body: 20
- title: 64
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
- P04: anchor
- P05: dense
- P06: breathing
- P07: anchor
- P08: dense

## pptx_structure
- mode: flat

## forbidden
- `mask`, `<style>`, `class`, external CSS, `<foreignObject>`, `textPath`, `@font-face`, `<animate*>`, `<set>`, `<script>` / event attributes, `<iframe>`
- HTML named entities in text; write typography as raw Unicode and escape XML reserved characters
- emoji 当图标、假 3D 小人、霓虹发光
- 三张等宽卡片 + 图标 + 两行说明
- 紫蓝渐变、玻璃拟态、彩色阴影
- 每页都加裁切标记/施工线
