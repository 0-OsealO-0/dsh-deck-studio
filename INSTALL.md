# 安装与配置 / Install & Configuration

Deck Studio 是一个 **Host-only** 的 DeepSeek Harness 插件，只支持 **Windows 10/11**（PDF/PNG 导出走 PowerPoint COM，动画脚本走 PowerShell）。

Deck Studio is a **host-only** DeepSeek Harness plugin for **Windows 10/11**. PDF/PNG export uses PowerPoint COM; the animation helper uses PowerShell.

---

## 中文

### 1. 系统要求

| 项目 | 要求 | 是否必需 |
| --- | --- | --- |
| DeepSeek Harness | 桌面版，已能正常加载第三方 bundle | 必需 |
| Python | 3.10+，且 `python -c "import pptx"` 能通过 | 必需 |
| 字体 | 微软雅黑 / 宋体；正式交付建议装思源黑体、思源宋体 TTF | 必需（否则回退字体） |
| PowerPoint | Microsoft 365 / 2016+ 桌面版 | 可选，仅 PDF/PNG |
| Playwright + Chromium | `pip install playwright && playwright install chromium` | 可选，仅视觉回渲 |

插件自带 `vendor/ppt-master`（官方 MIT 发行版子集），**不需要**对方另外安装 ppt-master 技能。

### 2. 安装

**方式 A：zip 包（推荐给同学）**

1. 解压到一个固定目录，例如 `D:\plugins\dsh-deck-studio`（路径不要含中文和空格）。
2. 打开 DSH，在新会话里执行：

```text
plugin_manager(action="install_bundle", target="D:\\plugins\\dsh-deck-studio")
```

3. 安装完成后**新开一个会话**，确认工具列表里出现 `deck`，技能列表里出现 `deck-studio`。

**方式 B：从 Git 仓库**

```text
plugin_manager(action="install_bundle", target="git+https://github.com/0-OsealO-0/dsh-deck-studio.git#v0.1.1")
```

**方式 C：开发模式（本机路径）**

```text
plugin_manager(action="install_bundle", target="D:\\path\\to\\dsh-deck-studio")
```

### 3. 验证

```text
deck(action="status", project="D:\\work\\demo")
```

`status` 会在 `data.runtime` 里返回探测结果：

```json
{
  "python": "C:\\...\\python.exe",
  "pythonFound": true,
  "pythonHasPptxDeps": true,
  "skillRoot": "C:\\...\\vendor\\ppt-master",
  "bundledSkill": true,
  "bundledSkillFound": true
}
```

`pythonHasPptxDeps` 为 `false` 时先装依赖（见第 5 节）。

### 4. 配置项

在 DSH 的插件配置里可覆盖，全部有默认值：

| 字段 | 默认 | 说明 |
| --- | --- | --- |
| `python` | 自动探测 | 依次尝试 `DSH_DECK_PYTHON` → `DSH_PYTHON` → `PYTHON` → DSH 运行时 → 常规 Python 安装 → PATH，并优先选择能 `import pptx` 的解释器 |
| `skillRoot` | 插件内 `vendor/ppt-master` | 想复用本机已装技能时可指向 `%USERPROFILE%\.skills-manager\skills\ppt-master` |
| `defaultProfile` | `formal` | `formal` / `campaign` / `literary` |
| `timeoutMs` | `180000` | 单次子进程超时 |

也可用环境变量指定解释器：

```powershell
$env:DSH_DECK_PYTHON = "C:\Python312\python.exe"
```

### 5. 安装 Python 依赖

```powershell
<你的 python> -m pip install python-pptx
# 可选：合并形状等高级导出
<你的 python> -m pip install skia-pathops uharfbuzz
# 可选：视觉回渲
<你的 python> -m pip install playwright
<你的 python> -m playwright install chromium
```

### 6. 常见问题

**`找不到 Python：...`**
在 Config 的 `python` 字段填入绝对路径，或设置 `DSH_DECK_PYTHON`。

**`No module named 'pptx'`**
当前解释器没装依赖。按第 5 节安装，或把 `python` 指向已装好的解释器（例如 DSH 自带运行时）。

**PDF/PNG 导出失败**
需要本机安装 PowerPoint 桌面版。没有的话用 `format="pptx"`，PDF 可在 PowerPoint 里另存。

**中文变成宋体 / 字体不对**
装思源黑体、思源宋体 **TTF** 版本（OTF 版 PowerPoint 不认），再重跑 `export`。

**`check(review=true)` 报渲染失败**
装 Playwright 与 Chromium；不装也不影响 `check` 的静态检查。

**完整性校验报错**
`vendor/ppt-master` 被删改。重新解压插件包，不要修改该目录里的文件。

### 7. 卸载

```text
plugin_manager(action="remove_bundle", target="dsh-deck-studio")
```

再删除解压目录即可；插件不会往系统目录写东西（项目产物都在你指定的 project 目录里）。

---

## English

### 1. Requirements

| Item | Requirement | Needed |
| --- | --- | --- |
| DeepSeek Harness | desktop build that can load third-party bundles | yes |
| Python | 3.10+, `python -c "import pptx"` must pass | yes |
| Fonts | Microsoft YaHei / SimSun; Source Han Sans/Serif **TTF** for delivery | yes (fallback otherwise) |
| PowerPoint | Microsoft 365 / 2016+ desktop | optional, PDF/PNG only |
| Playwright + Chromium | `pip install playwright && playwright install chromium` | optional, visual review only |

The plugin bundles `vendor/ppt-master` (official MIT distribution subset); recipients do **not** need a separate ppt-master skill.

### 2. Install

**A. Zip (recommended)**

1. Extract to a stable path such as `D:\plugins\dsh-deck-studio` (avoid non-ASCII and spaces).
2. In a new DSH session:

```text
plugin_manager(action="install_bundle", target="D:\\plugins\\dsh-deck-studio")
```

3. Open a **new session** and confirm the `deck` tool and `deck-studio` skill are present.

**B. Git**

```text
plugin_manager(action="install_bundle", target="git+https://github.com/0-OsealO-0/dsh-deck-studio.git#v0.1.1")
```

### 3. Verify

```text
deck(action="status", project="D:\\work\\demo")
```

Check `data.runtime.pythonFound` and `pythonHasPptxDeps`. If the latter is `false`, install dependencies:

```powershell
<python> -m pip install python-pptx
<python> -m pip install skia-pathops uharfbuzz   # optional
```

### 4. Configuration

| Key | Default | Notes |
| --- | --- | --- |
| `python` | auto-detected | tries `DSH_DECK_PYTHON`, `DSH_PYTHON`, `PYTHON`, DSH runtimes, standard installs, PATH; prefers an interpreter that can `import pptx` |
| `skillRoot` | bundled `vendor/ppt-master` | point to `%USERPROFILE%\.skills-manager\skills\ppt-master` to reuse a local skill |
| `defaultProfile` | `formal` | `formal` / `campaign` / `literary` |
| `timeoutMs` | `180000` | per subprocess |

### 5. Troubleshooting

- **`找不到 Python` / Python not found** — set Config `python` to an absolute `python.exe`, or set `DSH_DECK_PYTHON`.
- **`No module named 'pptx'`** — install `python-pptx` (or point `python` at an interpreter that has it).
- **PDF/PNG export fails** — PowerPoint desktop is required; otherwise use `format="pptx"`.
- **Wrong CJK font** — install Source Han **TTF** builds and re-run `export`.
- **Visual review fails** — install Playwright + Chromium; static checks still work without it.
- **Integrity check error** — `vendor/ppt-master` was modified. Re-extract the package; never edit that folder.

### 6. Uninstall

```text
plugin_manager(action="remove_bundle", target="dsh-deck-studio")
```

Then delete the extracted folder. The plugin writes nothing outside the `project` directories you choose.
