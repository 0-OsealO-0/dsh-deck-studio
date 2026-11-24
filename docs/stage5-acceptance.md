# 阶段 5 验收：原生页拼接（v0.6.0）

日期 2026-11-24。样本项目 `C:\Users\30139\AppData\Local\Temp\deck-native`：4 页 deck（封面带背景图 → 图文页 → 观点页 → 结尾页），`native_plan.json` 把第 1 页换成学院模板的封面页、并在末尾追加模板的结尾页（模板 3 页：封面 `!!title` / `!!date`、目录 `!!item1..3`、结尾 `谢谢` / `!!contact` + 一段 2 秒 mp4 视频对象）。

## 一、三条验收口径

| 口径 | 要求 | 实测 | 结论 |
| --- | --- | --- | --- |
| 3D / 视频保留 | 模板里的原生对象跟着页面搬过来 | 拼接后 5 页；第 5 页读回 `has_media=true`，视频对象仍在（PowerPoint COM 渲染出喇叭占位图，见下方截图） | 通过 |
| 字段替换 | `!!字段名` 换成文案且保留格式 | `data.native.fields` = `slide 1 : !!title -> 这学期宣传怎么干`、`slide 1 : !!date -> 2026-11-24 · 东南大学`、`slide 5 : !!contact -> 联系人：班级宣传委员`，字体字号沿用模板首个 run | 通过 |
| 缺模板优雅降级 | 模板缺失时仍产出矢量 PPTX，并说明怎么修 | 把模板改名后 `export force=true`：矢量 PPTX 20,964 B 照常产出，`warnings` 为「原生页拼接失败：原生页模板不存在：…。改 native_plan.json 里的 template。」 | 通过 |

补充两条环境相关：

- **缺 PowerPoint**：`detectPowerPoint()` 找不到 `POWERPNT.EXE` 时跳过原生页、保留矢量产物；`deck status` 的 `data.powerPoint.nativeExport=false` 与 message 提前说明（可 `DECK_POWERPOINT` 指定路径）。本机装了 PowerPoint，这条只走了代码路径，没有在无 Office 的机器上实跑。
- **没有 `native_plan.json`**：行为与 0.5.1 一致，只在 `warnings` 里提示「本次只导出矢量页」。

## 二、产物

- `exports/活动照片这样拍.pptx`（纯矢量，20,964 B）
- `exports/活动照片这样拍-native.pptx`（94,143 B，5 页：第 1 页原生封面 + 第 2–4 页矢量页 + 第 5 页原生结尾页）

![拼接后的原生封面：模板版式与 3D 感封面保留，`!!title` / `!!date` 已替换](stage5-native-cover.png)

![追加的原生结尾页：视频对象原样保留（渲染为喇叭占位），`!!contact` 已替换](stage5-native-media.png)

## 三、`native_plan.json` 语义

```json
{
  "template": "templates/学院模板.pptx",
  "slides": {
    "01_cover.svg": {
      "templateSlide": 1,
      "fields": { "!!title": "这学期宣传怎么干", "!!date": "2026-11-24 · 东南大学" }
    }
  },
  "append": [{ "templateSlide": 3, "fields": { "!!contact": "联系人：班级宣传委员" } }]
}
```

- `slides` 的值按 `svg_output/` 里的文件名对应导出的第 N 页；`templateSlide` 从 1 起。
- `append` 在末尾追加，不需要改字的页可以只写 `templateSlide`。
- 字段匹配用「整段等于 `!!key`」或「包含 `!!key`」，替换后保留首个 run 的字体字号；组合（`Group`）与表格单元格也会递归查找。

## 四、四个踩坑（实现里已固化，SKILL.md §2.3d 有同样说明）

1. **中文路径**：COM 的 `Open` / `SaveAs` 遇到中文路径报 `Filename cannot exceed 255 characters`（误导性错误）。做法是把 deck 与模板拷进 `validation/native/`（ASCII 名）再拼，最后 `copyFile` 到真实文件名。
2. **`InsertFromFile` 的 `Index`** 是"插在这一页**之后**"，不是"插成第 N 页"。替换第 N 页要传 `N-1`，再把被挤到 `N+1` 的原页删掉；否则会把刚插进来的原生页删掉、留下原矢量页（实测踩过一次）。
3. **PowerShell 变量大小写不敏感**：参数 `[string]$Spec` 与变量 `$spec` 是同一个东西，把 `ConvertFrom-Json` 的对象赋回去会被强制转回字符串，随后 `Open("")` 报上面那条 255 字符错误。参数名改 `$PlanFile`，变量名改 `$plan`。
4. **BOM 与残留进程**：`.ps1` 里有中文字面量必须存成 UTF-8 with BOM，否则报 `The string is missing the terminator: "`；脚本 `finally` 里必须 `Close()` + `Quit()` 并 `Stop-Process POWERPNT`，否则残留实例会让下一次 `Open` 拿到 0 页。

## 五、回归

- `deck check`：样本项目 `ok=true`（4 条 warning：3 条字体非 PPT-safe + 1 条图片未登记）。
- 冒烟 `node scripts/smoke-deck.mjs`：**55/55**（新增 5 项覆盖 `nativePlan.present`、`powerPoint.nativeExport` 类型、坏 plan 逐条报错、坏 plan 不替换任何页、message 点名 `native_plan.json`）。
- 未改动 `deck` 工具的参数表？改了 `data` 字段与 `status` 输出，但 action 集合与参数没变——**本阶段不需要重启 DSH**。
