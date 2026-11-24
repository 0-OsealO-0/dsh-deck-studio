# 主题字体与授权登记

每个主题只用两种字体：标题/正文的 sans 位、serif 位，另加一个本机回退字体。
**这个文件是字体授权的唯一台账**：加主题、换字体都必须在这里登记来源与许可，
否则导出到别人机器上会出现"字变了、版也散了"的问题。

## 主题 × 字体

| 主题 id | 标题字体 | 正文字体 | 本机回退 | 字体许可 | 可随文件分发 |
| --- | --- | --- | --- | --- | --- |
| `paper-stamp` | Source Han Sans SC | Source Han Sans SC | Microsoft YaHei | SIL OFL 1.1 | 可（保留许可与版权声明） |
| `navy-brief` | Source Han Sans SC | Source Han Sans SC | Microsoft YaHei | SIL OFL 1.1 | 可（保留许可与版权声明） |
| `blueprint-seu` | Source Han Sans SC | Source Han Sans SC | Microsoft YaHei | SIL OFL 1.1 | 可（保留许可与版权声明） |
| `neon-cyan` | Source Han Sans SC | Source Han Sans SC | Microsoft YaHei | SIL OFL 1.1 | 可（保留许可与版权声明） |
| `warm-sand` | Source Han Sans SC | Source Han Sans SC | Microsoft YaHei | SIL OFL 1.1 | 可（保留许可与版权声明） |
| `print-mono` | Source Han Serif SC | Source Han Serif SC | SimSun | SIL OFL 1.1 / 回退字体为系统字体 | 思源可分发；SimSun 不可 |
| `ink-water` | Source Han Serif SC | Source Han Serif SC | SimSun | SIL OFL 1.1 / 回退字体为系统字体 | 思源可分发；SimSun 不可 |

## 使用规则

1. **不打包字体文件**：插件只说字体名，字体由本机提供。换机器前先用 `deck check` 的字体自查确认已安装。
2. **回退字体只做兜底**：`Microsoft YaHei` / `SimSun` 是 Windows 系统字体，不能随 PPTX 分发；正式对外交付时应在自己的机器上装思源。
3. **不要用未登记的字体**：质量门会对 `spec_lock.md` 未声明的 family 报警；新字体先进本表，再进主题。
4. **导出安全名单**：`Source Han Sans SC TTF` / `Source Han Serif SC TTF` 在 PowerPoint 里属于可嵌入字体；`SimSun`、`Microsoft YaHei` 只是本机可用，不算 PPT-safe，`check` 会给出 6 条 warning —— 这是已知且可解释的。

## 新增主题的检查清单

- [ ] 在本表加一行（标题字体 / 正文字体 / 回退 / 许可 / 可否分发）
- [ ] `lib/themes.mjs` 的 `THEME_IDS` 加 id，`THEMES` 加定义
- [ ] `deck scaffold theme=<新 id>` 跑一遍 7 个原型，肉眼过一遍
- [ ] `node scripts/smoke-deck.mjs` 全绿（含"每个主题都能画出所有原型"）
- [ ] `CHANGELOG.md` 记一条
