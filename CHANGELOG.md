# 更新记录 / Changelog

## 0.9.0 — 2026-11-24

阶段 8：`notice` 通知页 —— 把班级群通知的固定五段搬上版。

- **新原型 `notice`**（第 9 个）：一句话结论 + 时间 / 地点 / 对象 + 待办清单 + 联系人。
  - 槽位：`title`（4–24，必填）、`when` / `where`（各 2–26，必填，放得下「11 月 28 日（周五）14:00–16:00」这种全写）、`who`（2–24，必填）、`todo`（0–4 条，每条 ≤16）、`note`（≤30）、`contact`（2–30，必填）。
  - 版式：标题从 `title` 起排（不再用 display 96，给下面的行留高度），三行信息用「标签 + 值」两栏、逐行 hairline 分隔；待办画成空心方块勾选；联系人固定在页脚。
  - **高度预算**：排版前先算各段高度，放不下就依次删掉最后一条待办、再丢 `note`——宁可少列一条，也不让内容压到页脚或画布外（首版就是没算高度，联系人直接叠在待办上）。
- `variant` 在 notice 上只影响标题字号：`impact` 走 `title`，`density` 走 `headline`，行内容不删减。
- 冒烟 64/64（新增「通知页：时间地点对象 + 勾选清单 + 联系人」「缺『对象』会被当成必填缺失」）。

## 0.8.0 — 2026-11-24

阶段 7：补上 campaign 侧最缺的一页——招新 / 活动预告大图页。

- **新原型 `hero`**（第 8 个）：整页照片 + 一句主张 + 时间地点 + 报名号召。
  - 槽位：`kicker`（2–10，必填）、`title`（4–16，必填）、`subtitle`（≤30）、`when` / `where`（各 2–20，必填）、`cta`（2–20，必填）、`image`（必填，`images/` 里的照片）。
  - 版式自下而上排：CTA 色块贴页脚 → 时间地点行 → accent 细线 → 副标题 → 大标题；标题块过高时整体上移，不把 CTA 挤出画布。
  - 专门的 `heroScrimDefs()`：比封面的压暗层更重（0.62 / 0.78 / 0.9 / 0.97），因为 hero 的标题落在照片中部，而封面的标题落在本来就接近不透明的底部。
- **`brief` 会拦缺项**：hero 页没写 `cta`（报名号召）会被判 `missing` 必填缺失，`check` 里以「字数契约：」进 blockers；没写 `image` 同理。
- 冒烟 62/62（新增「招新大图页：整页照片 + 报名按钮 + 时间地点」「缺报名号召会被当成必填缺失」）。

## 0.7.0 — 2026-11-24

阶段 6：主题扩容 + 把"结论落哪"从空间猜测改成槽位开关。

- **新增两套主题**（共 7 套）：
  - `warm-sand` 暖沙招新（活动·浅底）：`#FFF6EC` 纸底、`#E2632A` 橘红强调、8px 粗规则线，适合白天发群里的招新与预告。
  - `ink-water` 水墨宣纸（文艺·宋体）：`#F4F1E9` 宣纸底、墨黑正文、`#A62B1F` 朱砂、宋体标题、更宽的页边距，适合诗会与读书会。
- **对比页结论位置改成槽位**：`page_plan.json` 的 `text.takeawayAnchor` 可写 `auto`（默认，按剩余空间判定）/ `bottom`（永远贴页脚）/ `flow`（永远紧跟两栏）。写错值会被 `brief` / `check` 点名，只接受这三个词。
- **收束页标题只排一行**：`closing` 的标题不再在 `东西` 后面折行——`fitRole` 允许降一档字号而不是换行（`ink-water` 的宋体更宽，旧行为会折出孤字）。
- **字体授权台账**：新增 `docs/theme-fonts.md`，登记 7 套主题的标题/正文字体、回退字体、许可与可否分发；冒烟会检查每个主题 id 都在表里。
- 冒烟 60/60（新增「七套主题 × 七个原型都能画」「主题都登记在字体授权表」两项，`takeawayAnchor` 两项此前已加）。

## 0.6.1 — 2026-11-24

用真实 deck 跑一遍之后修的六处（样本：`03-活动项目\20261124-学期宣传复盘`，8 页，blueprint-seu）：

- **指标拆读错位**：`splitMetric()` 的量词表只有 `场/次/页/天…`，「22 项成品」被拆成数值 `22` + 标签 `项成品`，「29 天」又把整句当标签重复一遍。补 `项/篇/张/版/套/条/封/份/名/位/件/款/支/届/轮/周/月/年`，并允许 `|`/`｜` 分隔；剩下没有标签时不再重复画整句。
- **新增 `imageFit`**：竖幅图片框放 5:3 的海报时 `slice` 会把两侧裁成碎片。`imageFit: "contain"` 改为整图显示 + 主题底色留白（封面与图文页槽位都支持，审计给 12 字预算）。
- **对比页空洞**：两栏文字短时，原来的「把两栏下浮 42% 空余」会造出上下两个洞。现在两栏贴着标题排，正文按列宽自动在 subtitle / body 之间选一档放得下的大字号；页底留白超过 120px 时，结论条压到页脚、中缝竖线一路延伸到结论上方，空白变成结构而不是事故。
- **指标数字与量词贴太紧**：`22项` 让 120 号数字和量词黏在一起。数值与单位之间插一个 thin space（`\u2009`，0.18em），`measure()` 同步认识这个字符，既不拆成两列也不再糊成一团。
- **封面页脚散架**：`note` 原来固定压在 `bottom-84`，和下面的 meta 之间隔着 40px，像漏了一行没填。改成贴到分隔线上方 18px（`bottom-62`），note + 线 + meta 读成一个页脚块。
- **信息版观点页正文过小**：`density` 变体的正文原来用 body（24），一段支撑说明被压成横贯整页的小字条；改用 subtitle（34）并收窄到 0.8 宽。
- **开引号被挤到行尾**：`「五个还是六项」` 曾断成 `…仍是「` / `五个还是六项」`。`wrap()` 加反向禁则：行尾是 `（【「『《“‘` 时把该符号挪到下一行行首。
- 冒烟 56/56（新增 `imageFit=contain` 一项）。

## 0.6.0 — 2026-11-24

- **原生页拼接**：项目根放 `native_plan.json`，`export` 会在矢量/混合产物之外再生成一份 `<标题>-native.pptx`——用 PowerPoint COM 的 `Slides.InsertFromFile` 把学院官方模板里的封面、目录、致谢页整页搬进来，3D 模型、视频这些 python-pptx 搬不动的原生对象原样保留；`fields` 把模板里的 `!!字段名` 换成你的文案，保留字号字重（组合里的文本框与表格单元格也能命中）。
- **三种降级都不拦**：没有 `native_plan.json` → 只导矢量页并提示怎么加；模板缺失/字段写错 → 矢量页照常产出，warning 指出具体哪条；找不到 `POWERPNT.EXE` → 跳过原生页（可用 `DECK_POWERPOINT` 指定）。`deck status` 的 `data.powerPoint` / `data.nativePlan` 提前报这些情况。
- 实测：4 页 deck 替换第 1 页、追加模板结尾页 → 5 页 PPTX（94,143 B），第 1 页为原生封面（字段已替换）、第 5 页视频对象 `has_media=true`。
- 实现里固化四个坑（SKILL.md §2.3d 有说明）：COM 遇中文路径报误导性的 `Filename cannot exceed 255 characters`（改在 `validation/native/` 的 ASCII 目录里拼）；`InsertFromFile` 的 `Index` 是"插在某页之后"不是"插成第 N 页"；PowerShell 里 `[string]$Spec` 参数与 `$spec` 变量同名会把对象强制转成字符串；`.ps1` 含中文必须 UTF-8 with BOM，`finally` 必须关演示文稿并清掉残留 `POWERPNT.EXE`。
- 冒烟 55/55；新增 `scripts/qa/`（bands.py / inkbox.py / render-slides.ps1）用于导出的像素级回归。

## 0.5.1 — 2026-11-24

- **修掉导出文字纵向下移 8–14px**：转换器 `_text_line_vertical_extent()` 把首行上沿估成 `0.85em`，PowerPoint 实际按约 `0.98em` 放基线；改成 `0.98` 后四页样本标题带 `dy` = 0 / 0 / −1 / 0，页码块 `dx=1 dy=0`。这是本仓库唯一一处 vendor 改动，登记在 `docs/vendor-patches.md`，升级 vendor 时要补回。
- 结论记录：`data-pptx-frame` **不能**修纵向偏移（它只改 `top_inset`，文本框顶 + 内边距恒等于 `visual_box_y`）；对照实验里补 frame 前后 `dy` 完全一致（3 / 7 / 16px），别再走这条路。
- 矢量导出与 `mixed=true` 两条路径复测一致；图片槽位、字数契约、质量门都不受影响（`check` 仍 `ok=true`，冒烟 50/50）。
- 验收文档 `docs/stage4-acceptance.md` 的位置误差一行从「未达成」改为「通过」，并补上 1.1 节的校准数据与复测方法。

## 0.5.0 — 2026-11-24

- **图片槽位**：`cover` 增加可选 `image`（全幅背景图 + 渐变压暗），新增第 7 个原型 `image`（图文页，左文右图）。槽位写 `images/photo.jpg`，`scaffold` 输出 `../images/photo.jpg`（导出器与浏览器解析基准不同，只有这种写法两边都对）。
- 契约审计区分三类问题：外链 / 绝对路径 / 非图片扩展名进 `blockers`（`check` 里前缀「配图：」）；图片文件还没放进 `images/` 只 warning；条目截断等仍走字数契约。
- 编辑器图片槽位带「选图…」：选中文件不落盘，保存时连同 `page_plan.json`、`svg_output/` 一起写进项目 `images/`。
- **混合导出** `export(mixed=true)`：每页背景层（底色/装饰/照片/渐变）用 Chrome/Edge 栅格化成 1600×900 PNG，文字层仍走原生文本框——文字可编辑、背景 1:1 保真。默认仍是纯矢量导出。
- 混合导出前会对合成页跑同一套质量门，并复制 `spec_lock.md` 进中间项目（转换器要求）；找不到浏览器时直接报错，不会导到一半才失败；`status` 暴露 `data.runtime.browser`。
- 实测：同一份 4 页 deck，纯矢量 20,965 B，混合 74,637 B（3.56×）；像素差 2.3–4.5%、墨迹包围盒位移 ≤1px。结论：照片与渐变已经是矢量路径能保真的，混合只在转换器保不住背景时用。
- 冒烟 50 项（新增 4 项：图文页半幅 `<image>` 与 `../images` 前缀、背景层/文字层可拆分、图片槽位拒绝外链与非图片、`status` 报告浏览器）。

## 0.4.0 — 2026-11-24

- `deck` 新增动作 `edit`：从 `page_plan.json` 生成单文件浏览器编辑器（`exports/<标题>-edits.html`），左栏切页、中间实时预览、右栏槽位表单带字数预算；保存走 File System Access API，一次写好 `page_plan.json` 与全部 `svg_output/` 页面。
- 编辑器内联 `lib/themes.mjs` / `lib/page-contracts.mjs` / `lib/skeleton.mjs`，与 CLI 共用同一个渲染器：保存出来的 SVG 与 `scaffold` 逐字节相同（实测 6/6 页一致），不存在第二套排版。
- 编辑器支持切主题（实时重渲染）、切 `impact` / `density`、必填槽位为空时标红；主题会写进 `page_plan.json` 的 `theme`，下次 `scaffold` 不会掉回默认。
- 冒烟 46 项（新增 5 项：`edit` 无契约时报错、单文件生成、内联无占位符、不覆盖已有编辑器）。

## 0.3.0 — 2026-11-24

### Added
- `deck(action="scaffold")`：按 `page_plan.json` 生成 SVG 草稿页。6 个原型（cover / statement / metrics / comparison / process / closing）、2 个变体（`impact` / `density`）、5 套主题（`paper-stamp` / `navy-brief` / `blueprint-seu` / `neon-cyan` / `print-mono`）。
- `lib/themes.mjs`：主题即数据（palette + 字号阶梯 + 网格 + 边框几何），`typeSize()` 只查表，不做乘数——质量门会把未登记字号的第 3 次使用算成新角色。
- `lib/skeleton.mjs`：纯函数骨架渲染器（`measure` / `wrap` / `fitRole` / `renderPage` / `renderDeck`），含 CJK 避头点、按角色逐级降字号、按主题几何调整内容框。
- `scaffold` 会把主题字号阶梯同步进 `spec_lock.md` 的 `## typography`（缺的补、值不同就改），报告写在 `validation/skeleton_report.json`。
- 冒烟从 32 项扩到 41 项：scaffold 无契约报错、3 页生成、字号对齐、不覆盖已存在页、未知主题报错、骨架纯函数、换主题文字不变。

### Changed
- 字号阶梯整体上调（display 96→128、title 54→76、headline 40→54、subtitle 28→34、body 20→24、meta 14→16、metric 88→120 等），原 1600×900 画布上的字在投影时偏小。
- `lib/skeleton.mjs` 版式重做：封面标题下移成主视觉、statement 垂直居中、metrics 行居中、comparison 分隔线贯穿两栏、process 序号放大、closing 的 action 加序号与分隔线；蓝图网格从 12 列满页降到 160×120 疏网格并压到 0.38 透明度。
- 列表项计数先剥离 `01　` 之类序号前缀；`wrap()` 增加避头点，标点不再落在行首。

## 0.2.0 — 页面契约：让"放不下"在排版前就被发现

阶段 1（计划见 `docs/baseline-2026-11-24.md` 的后续阶段表）。0.1.2 修的是"门禁说谎"，这一版补的是**门禁查不到的那类缺陷**：文案在槽位里放不下时 SVG 不报错，它只是压边或溢出，直到投影仪上才发现。

- 新增 `lib/page-contracts.mjs`（纯函数，无 fs / 无 DSH 依赖）：formal 六个原型 `cover / statement / metrics / comparison / process / closing`，每个槽位带必填、最少/最多字数、列表条数上限。6 个原型 × 槽位上限集中在 `ARCHETYPES` 一处，改口径不用翻文档。
- 新增 `deck(action="brief")`：没有 `page_plan.json` 时输出原型菜单 + 槽位预算 + 可编辑骨架；有则逐页报「预算占用」并列出违规（超限 / 缺必填 / 未知原型 / 槽位拼错）。
- `check` 接入契约审计：违规写成 `字数契约：<文件>：…` 进 `data.blockers`（`ok=false`），明细在 `data.plan`。`data.plan.warnings` 收"声明了不存在的页面""页面没进契约"这类软问题。
- `export` 在跑 python 质量门**之前**先过契约：超版文案不许进 PPTX。确要强行导出，删掉 `page_plan.json` 即可（逃生口写进报错文字）。
- 向后兼容：没有 `page_plan.json` 的项目完全不报错，字数审计整体跳过，只在 `data.plan.warnings` 里提示一句；旧项目实测 `check` 输出与 0.1.2 逐字一致（`ok=true`、6 条 warning、1 条字号自查）。
- 计数口径：1 字 = 1 字符；行首 `01　` / `1.` / `①` 这类序号前缀不计入（真实页面的步骤文案曾因 `01　` 前缀被判超限 1 字，属于装饰性字符）。
- `metrics` 的指标必须含数字：「很多」「大幅」这类判 `vague`，因为数据页的每个值都该能核对。
- `status` 暴露 `hasPagePlan` 与 `pagePlan.{pages,violations,warnings}`。
- 冒烟扩到 32 项：新增 brief 无契约/有契约、超限 blocker、未知原型、无数字指标、声明不存在的页面只给 warning、导出在 python 之前被拦、修好后 brief 通过等断言。
- 真机回归（`dsh-deck-test`，2 页）：补 `page_plan.json` 后 `brief` 报「主标题 11/18 · 副标题 13/30 · 说明 24/40」「步骤 3/5 条」；把标题改成 32 字后 `brief` `ok=false`、`check` 出现 `字数契约：02_body.svg：标题 32 字，超了 14 字（上限 18）`。
- 明确不在本版：编辑器（阶段 3）、混合导出（阶段 4）、`campaign` / `literary` 的原型表（只覆盖 formal，其他 profile 的 plan 会给一条 warning）。

## 0.1.2 — 修好三个"门禁说谎"的 bug

全部来自真实使用反馈：`propose` 必失败、`check` 的项目自查必失败、`review=true` 静默不出图。共同点是**工具看起来成功了**。

- 修复 `propose` 返回结构：0.1.1 仍返回旧的 `{content,data,artifacts}`，而工具输出 schema 要 `ok/action/project/message` 且 `additionalProperties:false`，所以每次 `propose` 都在写完 `direction_options.json` **之后**被 DSH 判为 invalid output。现在返回标准结构，`message` 里放方向摘要。
- 修复项目自查永远失败：`auditProject` 把 `listSvg()` 的裸文件名直接 `readText(file)`，裸名相对宿主进程 cwd（`.dsh/profiles/desktop`）解析，首个 SVG 就 ENOENT，于是字号未登记、图片缺失、<2KB 占位、`image_sources.json` 未登记四类检查**从未执行过**。改为 `path.join(project, 'svg_output', file)`。
- `check` 的验收缺口不再假装通过：新增 `data.blockers`，任何"本该跑却没跑"的事（review 没回渲、audit 抛错）都进 blockers 并让 `ok=false`；message 分三种——质量门失败 / 质量门过但验收没跑完（附"据此不要说可以交付了"）/ 全过。原先 review 失败只写 `data.reviewError`，而 `render()` 从不打印它，等于看不见。
- `check(review=true)` 先探测 live-preview 服务：`visual_review.py` 只能从项目内 `live_preview/lock.json` 或 `.live_preview.lock` 拿 URL，且 pid 要存活，否则必定失败。没服务时立刻以 blockers 报出，不再白等 240s。
- `status` 增加 `data.previewServer`（来自新增的 `livePreviewState()`）与 `data.runtime.visualReview`（`lib/paths.mjs` 新增 `detectVisualReview()`，探测 `import playwright.sync_api`）；缺 playwright 时 message 直接给安装命令。
- 新增 `scripts/smoke-deck.mjs`：用 stub 绕过 DSH-only 依赖，驱动真实 action，逐项校验返回值符合 `deckOutput().schema`，并用故意留的两个缺陷（37px 未登记字号、缺失 `<image href>`）证明自查真的在跑、`review` 无服务时确实 `ok=false`。`node scripts/smoke-deck.mjs`。

### 来自外部实测报告的第二轮修补

另一位使用者（v0.1.1，另一台机器）独立提交了 `插件问题清单.md`，五条里三条与上面的 bug 重合、两条是新增，核对后补进来：

- `option` 参数说明改为按 profile 分组举例（`navy-brief`/`warm-orange`/`warm-paper` 等九个），并写明"从 propose 结果里抄 id，不要猜"。原说明只举了 literary 的三个，campaign 用户照抄必然拿到不存在的方向。
- 新增字体可用性自查：`auditProject` 解析 `spec_lock.md` typography 段里的 `*_family`，与本机已装字体比对，缺字体时报 `font-not-installed`。模板默认的 `Source Han Sans SC TTF` / `Smiley Sans Oblique` / `Glow Sans SC Normal TTF` 都不是 Windows 自带字体，原先只有质量门的 warning 且 `ok` 仍为 true，导致"预览看着正常、换台机器换字"。探测在 `lib/paths.mjs#installedFontFamilies()`，懒执行 + 缓存；同名坑记在注释里——PowerShell 输出要走 UTF-8，且 `InstalledFontCollection` 给的是本地化名（微软雅黑），必须再用 `GetName(1033)` 取英文名（Microsoft YaHei），否则所有中文字体都会被误报为"没装"。
- `check` 的报错附带改法：新增 `data.hints` 与 message 里的「常见改法」段，把四类高频硬伤映射成动作——非 PPT 安全字体（中文族名换英文族名 + 导出后补 `a:ea`）、非法 `data-pptx-role`（只接受八个结构角色）、几何无法解析（`tspan` 带 `y`/`dy` 必须带 `x`，坐标与字距不能用百分比）、顶层散元素未分组。`vendor/` 保持 MIT 原样不改。
- 冒烟扩到 20 项，新增断言：`option` 说明含 campaign 的 id、audit 能抓到本机没装的声明字体、报错能带出改法提示。

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
