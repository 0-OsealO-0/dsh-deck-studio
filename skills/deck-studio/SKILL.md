---
name: deck-studio
description: Deck Studio 的完整 PPT / 演示 HTML 工作流：建项目、写 SVG、过质量门、导出可编辑 PPTX 并修复中文字体、导出 PDF/PNG、生成单文件键盘演示 HTML、用 DryRun/Apply 两道门设计动画。
---

# Deck Studio

本 skill 把内置的 `ppt-master`（`vendor/ppt-master`，官方 MIT 发行版子集）、字体修复、PowerPoint 回导、质量门和动画脚本串成一条流程。只有一个工具：`deck`。所有 `project` 必须是**绝对路径**，因为插件工具没有 cwd。

## 何时用

用户说：做 PPT、做幻灯片、演示文稿、deck、演示 HTML、把这份内容做成汇报、给这套 SVG 加动画、导出 PPTX/PDF。

不适用：纯 Word/Excel；需要后端交互的 Web App；只要一张海报（用海报 skill）。

## 先问清楚（最多 4 个问题）

1. 给谁看、什么场景（班会 / 评优 / 答辩 / 活动 / 分享会）？
2. 多少页、必须包含哪些信息？
3. 交付是 PPTX、PDF，还是现场播放的 HTML？
4. **要不要动画**？三档：不要 / 整页淡入 / 关键页分层揭示。这个必须在开工时问，不能等到交付。

没有明确风格时，按内容选 profile：

- `formal`：汇报、评优、答辩、月报。结论先行、12 栏网格、蓝黑/群青/瑞士红。
- `campaign`：招新、晚会、比赛、活动预告。全幅图、大字号、镉橙、日期卡/流程条。
- `literary`：三行诗、读书会、作品集。燕麦纸、衬线标题、大留白、一页一字。

## 标准流程

### 0. 先给方案，用户选了再动工（硬门）

不要直接 init。先出三个视觉方向，让用户挑一个：

```text
deck(action="propose", project="D:\\work\\20261120-迎新晚会", profile="campaign", title="迎新晚会", brief="让同学知道时间地点并扫码报名")
```

返回三条 `id｜名称——一句话说明（适合：…）`，落到 `<project>/confirm_ui/direction_options.json`。把这三条原样转给用户，等用户选定：

```text
deck(action="init", project="…", profile="campaign", option="warm-orange")
```

`option` 会把该方向的配色写进 `spec_lock.md` 的 `## colors`，并插入 `design_direction*` 说明行。**用户没选就不 init**；用户说"你定"才可以自己挑，并在回复里说明挑了哪个、为什么。

### 1. 建项目

```text
deck(action="init", project="D:\\work\\20261120-迎新晚会", profile="campaign", title="迎新晚会", brief="让同学知道时间地点并扫码报名")
```

生成：

```text
source.md          内容骨架，先改这里
design_spec.md     设计意图 + Motion 默认关闭
spec_lock.md       canvas / colors / typography / mode
svg_output/        放 01_cover.svg、02_*.svg
images/            实拍图 + image_sources.json（质量门只认这个目录）
assets/            logo、装饰素材
exports/           PPTX / PDF / HTML
```

### 2. 写内容与锁文件

- 先把 `source.md` 压到 8–12 页，一页一个观点。
- `spec_lock.md` 里改 `colors` 与 `typography`；**不要把 HEX 或字体写进 visual_style**，visual_style 只描述版式语言。
- SVG 画布 1600×900；文件按 `01_`、`02_` 编号；正文 ≥20px；不要 emoji 图标、假 3D、紫蓝渐变。
- 字号先登记再使用：`spec_lock.md` 的 `typography` 里写成 `- 角色名: 数值`（如 `- headline: 60`）。未登记的字号在整册出现到第 3 次，就算一个"角色"：ppt-master 本该报 ERROR，但那条规则依赖 spec_lock 解析与字号解析器，解析失败会**静默跳过**（本项目实测：77px 用了 5 次，`--stage final` 没报错）。`deck check` 现在自己会数一遍并提示，看到就补一行 `- 新角色: 77`。一版控制在 6–8 个角色（display / title / headline / quote / subtitle / body / meta / micro）。
- 页角色写清楚：封面 `<svg data-pptx-page-role="cover">`，结尾 `"ending"`，中间页 `"content"`；根级可见 `<g>` 必须带 `data-pptx-bounds="0 0 1600 900"`；带 `data-pptx-role` 的元素要同时有稳定 `id`。
- 同列多行文字合成一个 `<text>` + `<tspan x dy>`，不要兄弟 `<text>` 叠行，否则报 "paragraph-like line run(s) split"。
- 字体优先用已装 TTF：`Source Han Sans SC TTF`、`Source Han Serif SC TTF`、`Glow Sans SC Normal TTF`、`Smiley Sans Oblique`、`LXGW WenKai`。字重是独立家族，下拉要选全名（如 `Source Han Serif SC TTF Light`）。

### 2.4 大纲红队（写 SVG 之前，不可跳过）

质量门只查结构，不判断内容值不值得讲。这一步补的正是那个缺口：在排版之前先把主张打一遍。

1. 先把 `source.md` 压到 8–12 页、一页一个判断句（这步在 §2 已经做过）。
2. 然后对每页写三行，落在 `slide_claims.md`（或 `source.md` 每页标题下的注释）：

```text
P3 主张：换电比快充更适合校园高频短途
   支撑：日均 3.2 次/车，快充 40 分钟占用桩位（来源：后勤处 2026-09 统计）
   反问：换电站谁出钱、谁来换？
```

3. 逐页过四个问题，答不上来就改页，不要改措辞：

- **这页删掉会损失什么？** 答不出 → 删页。
- **这个数字哪来的？** 没来源 → 删数字，或降级为「估计」并写明口径。
- **听众第一个反问是什么？** 页面上必须有半句回应，或口头稿里准备。
- **如果只讲三页，留哪三页？** 留不下的页多半是过程不是结论。

4. 一页出现两个主张就拆页或删一个；形容词堆叠（"高效、可靠、智能"）换成具体数字或场景。

5. 可用 `grilling` skill 跑对抗式提问（它专攻"主张是否有支撑、替代方案是否排除"），
   也可自己按上面四问走一遍。**8 页以上、答辩/评优/汇报类项目必须做**；纯活动通知可跳过，
   但要在交付说明里写明跳过的原因。

红队的产物是页序与取舍的改动，不是措辞润色；改完再进 §2.5 配图与 SVG。

### 2.5 配图（有实拍图才做，先解决版权）

`deck init` 建的是空 `images/`；照片走这个顺序，别直接把网图塞进去：

1. **找图**：Wikimedia Commons 的 API 能读到元数据（`action=query&prop=imageinfo&iiprop=url|size|extmetadata`），挑 `LicenseShortName` 是 CC BY / CC BY-SA / 公有领域的。国内网络下 `upload.wikimedia.org` 常连不上，改抓 API 返回的 `thumburl`（`thumb.wikimedia.org` 域），必要时套一层 `https://wsrv.nl/?url=<编码后的地址>&w=2000&output=jpg` 取 JPEG。
2. **处理**：`python <ppt-master>/scripts/image_treat.py <项目> <源文件名> --output <新名>.png --desaturate 0.3 --contrast 1.05`。降饱和 0.3 左右能压掉"图库味"，比硬套双色调更耐看；双色调只在整册都要印刷感时用。
3. **裁切**：按版面比例预裁并缩到版面的 2–3 倍（1600×900 版面里，460×350 的图给 1380×1050 就够），存 JPEG q90。既省 PPTX 体积，也避免 slice 裁掉主体。
4. **登记**：写 `images/image_sources.json`，每张图至少要有 `filename / slide / purpose / provider / title / author / source_page_url / license_name / license_url / license_tier / attribution_required / width / height / attribution_text / status`。
5. **署名**：`license_tier: attribution-required` 的图，**页面里必须有一段可见文字同时含作者名和 `CC BY`/`CC BY-SA`**，否则质量门报 `Missing image-specific inline attribution`。署名放图下方 16px 灰字，或页脚右侧；末页可再汇总一行。
6. SVG 里用 `<image href="../images/xxx.jpg" preserveAspectRatio="xMidYMid slice"/>`；相对路径以 `svg_output/` 为基准。

### 2.6 文案去 AI 味（先过稿，再排版）

幻灯片最常见的 AI 味不在版式，在字。写 `source.md` 之前先按 `lieflat-less-ai-tone` 的白名单过一遍，几条高频问题：

- "不是…而是…"的翻案腔；破折号后面再揭晓一次；"说白了/换句话说/这意味着"。
- 三项顿号排比（"稳定、可靠、可持续"）；抽象名词当主语（"效率的提升体现在…"）。
- 每段第一句都是无主语评论（"值得注意的是…"）。
- 一页三个并列卡片 + 图标 + 两行说明，观点被平均分配。

一页只留一个判断句；标题能独立成句；用具体的人、时间、物件代替形容词。

### 3. 质检

```text
deck(action="check", project="...", review=true)
```

- 跑 `svg_quality_checker.py --stage final --json`；ERROR 必须修，WARN 可解释。未通过时 `check` 会把前几条 ERROR 直接打在 message 里，`data.errors` / `data.warnings` 是全量数组，不用自己解析 JSON。
- `check` 还会补一层自有自查（`data.audit`）：未登记字号的使用次数、`<image href>` 指向的文件是否存在、图片是不是小于 2KB 的失败占位、用到的图有没有登记进 `images/image_sources.json`。这些是 python 质量门容易静默放过的部分。
- `review=true` 额外跑 `visual_review.py` 出 PNG，放在 `.preview/`。先看渲染，再导出。
- 常见硬伤：文字溢出、对比度不足、一页超过 3 个视觉层级、标题换行难看、图片被拉伸、字号没登记、配图缺署名。
- **这道门不是全部**：`check` 通过只说明结构和可读性没硬伤，不说明内容值得讲。交付前还要按
  `~/.dsh/AGENTS.md`「演示文稿与网页交付」的三条走——内容红队（§2.4）、本门、以及**在投影
  分辨率下实看 PDF/PNG**（不是看编辑器里的预览）。没看渲染、或没跑门，不许说"可以用了"。

### 4. 导出

```text
deck(action="export", project="...", format="pptx")
deck(action="export", project="...", format="all")
```

- 默认出 `exports/<slug>.pptx`；`all` 再加 PDF 与首屏 PNG。
- 若项目根有 `animations.json`，导出会自动加 `--animation-config`；先 `animate apply`，再 `export`。
- 导出后自动跑 `fix-pptx-cjk-fonts.py`，按 `spec_lock.md` 的 `title_family/body_family` 修主题和 run 的 `a:ea/a:cs`。
- PDF/PNG 走 PowerPoint COM；没有 PowerPoint 时只出 PPTX。
- **PDF 会偏大**：COM 出来的是整页位图，带图的 6 页就可能 20 MB 以上，脚本会在 warnings 里提示。发群/发微信前用 qa 页图重做一版：

```text
python -c "from PIL import Image;fs=['qa/slide%d.png'%i for i in range(1,7)];ims=[Image.open(f).convert('RGB') for f in fs];ims[0].save('exports/preview.pdf',save_all=True,append_images=ims[1:],resolution=150,quality=82)"
```

- **PowerPoint 不嵌入用户字体**：正式交付优先 PDF；PPTX 给能装同款字体的机器。

### 5. 演示 HTML

```text
deck(action="html", project="...")
```

- 把 `svg_output/*.svg` 内联成一个 HTML，方向键/空格/Home/End/F/? 可用，点击左右半屏翻页，打印时每页一张。
- 适合现场播放、发群里预览；不适合需要编辑的场合。

### 6. 动画（先提案，再写入）

```text
deck(action="animate", project="...", profile="campaign")                 # DryRun，只打印
deck(action="animate", project="...", profile="campaign", apply=true)     # 写 animations.json
```

- 只对 SVG 顶层 `<g id="...">` 生效；没有 group 的页跳过，全 deck 没有 group 时明确报错，不写无效 JSON。
- 每页 formal ≤2、campaign ≤3、literary ≤2 个动作；统一切换与触发；禁 fly / bounce / spin。
- `advanced=["slow-push"]` 只给 fade + 提示用 Morph 两页；`micro-shift` 只警告；`mask-reveal` 用矩形 wipe 近似。
- 真正的慢推近/1–3% 微位移/有机遮罩：加一页做 Morph，或导出视频；不需要插件。
- 动画不保留在 PDF；正式交付仍以 PDF 为准。

## 交付前检查

- [ ] §2.4 红队做过：每页主张有支撑，删页问题能答，无来源的数字已删或标「估计」。
- [ ] 每页一个判断，标题能独立成句。
- [ ] 文案按 `lieflat-less-ai-tone` 过过一遍；没有"不是…而是"、破折号揭晓、三项排比、每段空评。
- [ ] 没有三张等宽卡片 + 图标 + 两行说明。
- [ ] 没有 emoji 图标、假 3D、紫蓝渐变、发光。
- [ ] 字体是 TTF 家族；没有 OTF 名字混进 PPTX；字号都在 typography 里登记过。
- [ ] 图片没有拉伸；文字没有溢出；页脚/页码一致。
- [ ] 用了实拍图：`images/image_sources.json` 有记录，页面上有作者 + 许可。
- [ ] 至少回渲 1 次；PPTX 在 PowerPoint 里打开过 1 次。
- [ ] 动画只保留必要的 1–3 个揭示；没有逐页自动弹入。

## 边界

- 不生成 3D、Slide Zoom、段落/逐字动画。
- 原生图表/表格可能是结构静态；要动图表用 SVG 图形组。
- `deck export` 依赖 Python（需 `python-pptx`）与内置 ppt-master；两者都能自动探测，也可在插件 Config 的 `python` / `skillRoot` 里覆盖。
- 不替代人工判断：质量门只查结构/可读性，不判断内容是否值得讲。
