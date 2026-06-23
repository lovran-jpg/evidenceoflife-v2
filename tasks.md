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

- [x] [P1][done] **ui-styling: MapView.tsx 的 6 个 `<button>` 迁到 shadcn Button**
  - 动作：`src/components/views/MapView.tsx` 里所有 `<button>` 替换为 `@/components/ui/button` 的 `<Button>`；保留原有 className 行为；用 `variant`/`size` props 表达样式
  - 验收：
    - `grep -c "<button" src/components/views/MapView.tsx` == 0
    - lint 错误数 ≤ baseline（由 loop.sh 自动比较）
    - vitest 仍 pass
  - 范围限制：只动这一个文件，不要顺手改其他视图
  - **验收输出**：
    - `grep -c "<button" src/components/views/MapView.tsx`：**0**（== 0 ✓）
    - `npm run lint`：**215 errors / 67 warnings**（与上一轮 baseline 持平；MapView.tsx 的所有报错均是预存的 `any` / `no-empty` / hook-deps，未触碰到本次改动行）
    - `npx vitest run`：**9 files / 51 tests passed**（2.11s）
    - `npm run build`：✓ built in 7.64s（vite 5.4.21，无报错）
  - **实现备注**：6 处替换全部用 `variant="ghost"`。其中 5 处用 `size="icon"`（详情头部返回 / city 头部返回 / 关闭搜索 / 搜索触发器 / 地点详情返回），并在 className 里给出 `h-7..h-8 w-7..w-8 rounded-xl/rounded-full` 等精确尺寸覆盖原本的 `p-1`/`p-1.5` 内边距方案，hover 走 ghost 自带的 `accent` 高亮。第 6 处（category chip pill）保留全部自定义 pill 样式，靠 `variant="ghost"` + `h-auto` + twMerge 让 cva base 的 `gap-2`/`rounded-md`/`h-10` 被 className 里的 `gap-1.5`/`rounded-full`/`h-auto` 覆盖，原 `aria-pressed` / inline style 全部保留。

- [x] [P1][done] **ui-styling: DayDetailSheet.tsx 的 6 个 `<button>` 迁到 shadcn Button**
  - 同上规则，文件换成 `src/components/DayDetail/DayDetailSheet.tsx`
  - 验收：
    - `grep -c "<button" src/components/DayDetail/DayDetailSheet.tsx` == 0
    - lint 错误数 ≤ baseline
    - vitest 仍 pass
  - **验收输出**：
    - `grep -c "<button" src/components/DayDetail/DayDetailSheet.tsx`：**0**（== 0 ✓）
    - `npm run lint`：**215 errors / 67 warnings**（与 baseline 持平 ✓；本文件未触碰预存 any/empty 等问题）
    - `npx vitest run`：**9 files / 51 tests passed**（3.09s）
    - `npm run build`：✓ built in 9.27s（vite 5.4.21，无报错）
  - **实现备注**：6 处全部 `variant="ghost"` + `size="icon"`。3 类尺寸覆盖手法：
    1. photo-preview 删除按钮（绝对定位 5×5px、bg-foreground/text-background）：用 `h-5 w-5` + `[&_svg]:size-3` 把 cva 的 `h-10 w-10` 与默认 `[&_svg]:size-4` 同时盖掉，并写 `hover:bg-foreground/90 hover:text-background` 保留原本"非 hover 配色"语义（ghost 默认 hover 翻成 accent 色会破坏 fg/bg 反色）。
    2. 内联文本链按钮（location 清除）：`h-auto w-auto p-0` + `hover:bg-transparent`，让按钮完全贴合 lucide 12px 图标自身尺寸不撑大父级 chip。
    3. 4 个 p-2 圆形 toggle/trigger（emoji popover trigger / 图片上传 / 位置 popover trigger / 关闭表单）：`h-auto w-auto p-2 rounded-full` 走 cva ghost 的 hover-accent，但 emoji & location 两处保留 `selectedEmoji` / `selectedLocation` 的高亮态（自己提供 bg-primary/10 + hover:bg-primary/15，避免被 ghost 默认 hover 覆盖）。两个 PopoverTrigger asChild 都保留——shadcn Button 内部就是 forwardRef，Slot 透传 OK。

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
