# tasks.md — agent loop 队列

> 单一事实源。状态前缀：`[todo]` / `[in_progress]` / `[blocked: 原因]` / `[done]`。
> 每条任务必须自带**机器可验收**条件——agent 不跑验收命令、不贴输出，就不准标 `[done]`。

---

## Queue

- [x] [P1][done] **design-system: 建 tokens.css 抽 spacing/color 基础 token**
  - 动作：新建 `src/styles/tokens.css`；从 `tailwind.config.ts` 与 `src/index.css` 里抽出 spacing scale（4/8/12/16/24/32...）与已存在的 `--surface-*` 系列色 token，集中到一处；在 `src/main.tsx` 入口 import 一次
  - 验收：
    - `npm run build` 通过
    - `ls src/styles/tokens.css` 存在
    - `grep -c "^\s*--" src/styles/tokens.css` ≥ 10
  - 范围限制：**只新建文件 + 改 main.tsx 一行 import**。不准这一轮里去全仓搜索替换硬编码值（那是下一条的活）
  - **验收输出**：
    - `npm run build`：✓ built in 8.51s（vite 5.4.21，2177 modules transformed，无报错）
    - `ls src/styles/tokens.css`：`src/styles/tokens.css`（存在）
    - `grep -c "^\s*--" src/styles/tokens.css`：**18**（≥ 10 ✓）
  - **实现备注**：tokens.css 在 `main.tsx` 里 import 在 `index.css` **之前**，所以本轮不改变现有 surface 值的运行时行为（index.css 的 :root/.dark 块仍然胜出），只把 13 个 spacing token + 5 个 surface 镜像 token 集中到单一文件作为后续迁移的源。下一轮 tokens 扩展时按需替换 index.css 里同名声明。

- [ ] [P1][todo] **ui-styling: MapView.tsx 的 6 个 `<button>` 迁到 shadcn Button**
  - 动作：`src/components/views/MapView.tsx` 里所有 `<button>` 替换为 `@/components/ui/button` 的 `<Button>`；保留原有 className 行为；用 `variant`/`size` props 表达样式
  - 验收：
    - `grep -c "<button" src/components/views/MapView.tsx` == 0
    - lint 错误数 ≤ baseline（由 loop.sh 自动比较）
    - vitest 仍 pass
  - 范围限制：只动这一个文件，不要顺手改其他视图

- [ ] [P1][todo] **ui-styling: DayDetailSheet.tsx 的 6 个 `<button>` 迁到 shadcn Button**
  - 同上规则，文件换成 `src/components/DayDetail/DayDetailSheet.tsx`
  - 验收：
    - `grep -c "<button" src/components/DayDetail/DayDetailSheet.tsx` == 0
    - lint 错误数 ≤ baseline
    - vitest 仍 pass

- [ ] [P2][todo] **ui-ux-pro-max: DueCard.tsx 视觉层级复审**
  - 动作：调用 `Skill(ui-ux-pro-max)` 对 `src/components/views/dues/DueCard.tsx` 做层级 / 间距 / 对比度审计；输出 diff 落到代码
  - 验收：
    - 修改 diff 贴到本任务下的 `Notes` 子段（diff 长度 ≤ 80 行；超出说明改太大，应该拆）
    - lint 错误数 ≤ baseline
    - vitest 仍 pass
  - 备注：这条比上面三条主观，做完后人工 review 才会进 `[done]`，agent 自标 `[in_progress: 等人工 review]`

- [ ] [P2][todo] **design-system: 把上一步发现的新 token 回写 tokens.css**
  - 动作：扫 `src/components/views/LinksView.tsx` 与 `StickyNotesView.tsx` 里的 `bg-[#xxxxxx]` 内联色，归类为 `--surface-peach / --surface-sage / --surface-lavender / --surface-cream` 等 semantic token，添到 `src/styles/tokens.css`；这一轮**不**做替换
  - 验收：
    - `grep -c "^\s*--surface-" src/styles/tokens.css` 比上一轮多 ≥ 3
    - `npm run build` 通过

## Notes

<!-- agent 可在此追加备忘、决策记录、新发现的任务草稿 -->
