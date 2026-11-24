# 阶段 1 验收记录（v0.2.0 页面契约）

日期：2026-11-24　范围：页面契约原型、`deck(action="brief")`、`check` / `export` 的字数审计

## 验收口径（计划里定的三条）

| 口径 | 结果 | 证据 |
| --- | --- | --- |
| 旧稿能查出超限页 | 通过 | `dsh-deck-test` 的 `02_body.svg` 标题改成 32 字后，`brief` 返回 `ok=false`，`check` 的 `data.blockers` 出现 `字数契约：02_body.svg：标题 32 字，超了 14 字（上限 18）` |
| 0 误报 | 通过 | 同一册的合法 `page_plan.json`：`brief` 报 `契约 2 页，字数与条数都在预算内`，`check` `ok=true`、`blockers=[]`；步骤文案带 `01　` 序号前缀时不再误判超限（序号不计入） |
| 向后兼容 | 通过 | 删掉 `page_plan.json` 后 `check` 输出与 0.1.2 逐字一致（`ok=true`、6 条 warning、1 条字号自查），`data.plan.present=false` 且只多一条跳过提示 |

## 自动化

- `node scripts/smoke-deck.mjs` → **32/32 PASS**（0.1.2 是 20 项；新增 12 项覆盖 brief、契约违规、仅 warning 的软问题、导出前置拦截）。
- 冒烟里的坏 plan 夹具专门验证四件事：超限进 blocker、未知原型判 `archetype`、无数字指标判 `vague`、契约声明了不存在的页面只给 warning 不阻塞。

## 已知边界（不在本版）

- 只有 `formal` 有原型表；`campaign` / `literary` 的 `page_plan.json` 会给一条 profile 不匹配的 warning，不审计字数。
- 字数按字符数算，不折算字宽；极端中英混排、全大写的英文标题可能偏松。
- 契约查的是"文案放不放得下"，不判断内容值不值得讲——那仍是大纲红队（SKILL.md §2.4）的事。

## 下一步

阶段 2（v0.3.0）：骨架 + 视觉语言。10 个骨架 × `need=impact|density`，两套新语言（含 SEU 封面/致谢），验收标准是"同内容两份肉眼可辨"。
