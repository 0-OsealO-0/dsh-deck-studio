# 阶段 3 验收（v0.4.0 浏览器编辑）

日期：2026-11-24 · 验收对象：`C:\Users\30139\Documents\deepseek-harness\dsh-deck-studio`

## 验收口径与结果

| 口径 | 怎么测 | 结果 |
| --- | --- | --- |
| 改 3 处字 ≤30 秒 | 打开 `exports/deck-e2e-edits.html`，把封面「主标题 / 副标题 / 元信息」三处改掉，再保存 | 通过。页面即时打开，三处输入改动后预览实时重渲染；6 页 + `page_plan.json` 一次保存（浏览器内实测写入 7 个文件，`saveMs≈800`，其中大半是等待写入完成）。真正的耗时是第一次的目录选择（一次点击，之后同一次会话可复用选择器） |
| 保存后重渲染不破 | 把编辑器写出的 `page_plan.json` 拿回 CLI 跑 `scaffold force=true` + `check` | 通过。`scaffold` 6 页全部重写、主题保持 `navy-brief`（编辑器把主题写进了 plan），`check` `ok=true`、0 error、6 条 warning（均为 `Source Han Sans SC TTF` 非 PPT-safe，与阶段 2 一致） |
| 与骨架逐字节一致 | 用同一份 plan 在 Node 里按 `scaffold` 的写法（头注释 + `renderPage` + 换行）拼出 6 页，与磁盘文件比对 | 通过：**6/6 页完全相同**。编辑器没有第二套排版，保存的就是 CLI 会写的那份 SVG |
| 无服务端依赖 | 检查产物 | 通过：`exports/<标题>-edits.html` 单文件约 66 KB，内联三份模块源码与当前 plan，无 `<script src>`、无网络请求、无需 Python / Flask |

## 自动化

`node scripts/smoke-deck.mjs` → **46/46 PASS**（阶段 2 为 41 项），新增 5 项：

1. `edit` 没有 `page_plan.json` 时报错并指回 `brief`；
2. `edit` 写出单文件编辑器（页数、主题正确，无外链脚本）；
3. 编辑器内联了 `ARCHETYPES`、`renderPage`、当前文案与文件名，且无 `__THEMES__` / `__DATA__` 占位符残留；
4. 已存在的编辑器不被静默覆盖（需 `force=true`）；
5. `edit` 返回值符合 `deckOutput().schema`。

## 已知边界

- **只做改字**：编辑器不含图片槽位与图表；`scaffold` 生成的 6 个原型本来就没有图位。图片 + 混合导出留给阶段 4。
- **不做拖拽排版**：可以切 `impact` / `density` 与主题，不能拖动元素或改字号——保持"版面由骨架决定"的约束。
- **只管骨架页**：手动写的 SVG 不在 `page_plan.json` 里，编辑器不会读也不会写。
- **浏览器依赖**：直接写目录用的是 File System Access API（Chrome / Edge）。Firefox 用「下载 JSON」+ `scaffold force=true` 兜底。
- **会话内 schema**：当前 DSH 会话的 `deck` 工具在启动时加载，`edit` 要重启 DSH 才出现在工具里；本次验收用临时 runner 直跑源码完成。

## 下一步

阶段 4 混合导出（截图底图 + 文字层，验收：文字可选中、误差 <2px、体积增幅 <30%），顺带补图片槽位。
