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

- [ ] [P2][in_progress: 等人工 review] **ui-ux-pro-max: DueCard.tsx 视觉层级复审**
  - 动作：调用 `Skill(ui-ux-pro-max)` 对 `src/components/views/dues/DueCard.tsx` 做层级 / 间距 / 对比度审计；输出 diff 落到代码
  - 验收：
    - 修改 diff 贴到本任务下的 `Notes` 子段（diff 长度 ≤ 80 行；超出说明改太大，应该拆）
    - lint 错误数 ≤ baseline
    - vitest 仍 pass
  - 备注：这条比上面三条主观，做完后人工 review 才会进 `[done]`，agent 自标 `[in_progress: 等人工 review]`
  - **验收输出**：
    - `git diff --stat`：**1 file changed, 10 insertions(+), 10 deletions(-)**（diff 20 行，远低于 80 行预算 ✓）
    - `npm run lint`：**215 errors / 67 warnings**（与 baseline 持平 ✓）
    - `npx vitest run`：**9 files / 51 tests passed**（2.82s ✓）
    - `npm run build`：✓ built in 9.02s（vite 5.4.21，无报错）
  - **审计依据 + 改动清单**（基于 ui-ux-pro-max SKILL.md 的 Quick Reference §1/§5/§6 规则）：
    1. **deadline / time-left chip 主次未分**（行 290-304，违反 `visual-hierarchy` "Establish hierarchy via size, spacing, contrast — not color alone"）：两个 chip 都是 `border-border/45 bg-secondary/25 rounded-full px-2.5 py-1`，同色同形，截止日 chip 是可点编辑的 anchor，time-left 只是只读附注，但视觉权重相同。改：time-left 容器砍掉 `rounded-full border bg-secondary/25`，只保留 `px-1 py-1` 微内边距让其降级为"附注文本"；timeLeft 文本透明度 `text-muted-foreground → text-muted-foreground/80`，timeStr 进一步 `/65 → /55`，并在前面加 `·` 分隔符把"tracked"显式归到附注从属位（前缀点是 macOS Finder / iOS 元数据列的标准做法）。
    2. **step 行右侧密度过载**（行 404 + 427 + 489，违反 `whitespace-balance` + `touch-target-size`）：step 文字与铃铛 `gap-2`，铃铛 `p-1`（命中 ~22px），删除 `p-0.5`（命中 ~18px）—— 两个 hover-only 控件都低于 44pt 推荐且彼此相邻挤压。改：右侧主容器 `gap-2 → gap-2.5` 给整组多 2px 呼吸；铃铛 `p-1 → p-1.5`（命中 26px）、删除 `p-0.5 → p-1`（命中 24px），命中区都向 ≥24px 靠拢同时保持 hover-only 的"安静"语义；同时把 hover-only ghost 色从 `text-muted-foreground/25 → /30` 微提升（25% 透明度在 light surface 上对比近临界，30% 仍读作"ghosted"但可辨识度更稳）。
    3. **utility cluster gap-0.5 过紧 + delete hover 色无效值**（行 914 + 1025，违反 `touch-spacing` Apple HIG ≥8px + Tailwind 任意透明度合法值）：3 个 h-8 w-8 圆按钮 `gap-0.5`（2px 间距），低于 Apple HIG 推荐的 8px 触控间距下限；同时 delete 按钮 `hover:bg-destructive/8` 不是 Tailwind 默认 opacity scale 合法值（合法的是 5/10/15/20...），实际渲染时被静默丢弃。改：`gap-0.5 → gap-1`（4px，圆形按钮自带视觉气垫，4px 已足够切分）；`hover:bg-destructive/8 → /10`（修对+略提升对比，让 delete hover 真正可见）。
  - **不动的（克制说明）**：
    - 卡片 p-4 / mt-2.5 节奏：已是精心调整的 5 处节奏（mt-2 / mt-2.5 / mt-3 按语义层级分层），改一处会引发连锁
    - Today CTA + Done outline checkbox 并列：实心 fill 与 outline 形状对比 + 颜色对比已足够，不构成语义冲突
    - accent color 内联 style：tokens.css 扩展是下一条 P2 任务的活
  - **完整 diff**：
    ```diff
    @@ -287,18 +287,18 @@ export function DueCard
    -              <div className="inline-flex items-center gap-1.5 rounded-full border border-border/45 bg-secondary/25 px-2.5 py-1 text-left">
    +              <div className="inline-flex items-center gap-1.5 px-1 py-1 text-left">
                     {timeLeft && (
                       <span className={cn(
                         "font-medium leading-none",
    -                    timeLeft.overdue ? "text-destructive" : "text-muted-foreground"
    +                    timeLeft.overdue ? "text-destructive" : "text-muted-foreground/80"
                       )}>
                         {timeLeft.text}
                       </span>
                     )}
                     {timeStr && (
    -                  <span className="leading-none text-muted-foreground/65">
    -                    {timeStr} tracked
    +                  <span className="leading-none text-muted-foreground/55">
    +                    · {timeStr} tracked
                       </span>
                     )}
                   </div>
    @@ -401,7 +401,7 @@
                     {/* Right: label */}
    -                <div className={cn("flex items-center gap-2 flex-1 min-w-0", !isLast && "pb-2")}>
    +                <div className={cn("flex items-center gap-2.5 flex-1 min-w-0", !isLast && "pb-2")}>
    @@ -424,10 +424,10 @@
                           className={cn(
    -                        "rounded-full p-1 transition-all flex-shrink-0",
    +                        "rounded-full p-1.5 transition-all flex-shrink-0",
                             hasStepReminder
                               ? "text-primary bg-primary/10"
    -                          : "text-muted-foreground/25 opacity-0 group-hover/step:opacity-100 hover:bg-secondary hover:text-primary"
    +                          : "text-muted-foreground/30 opacity-0 group-hover/step:opacity-100 hover:bg-secondary hover:text-primary"
                           )}
    @@ -486,7 +486,7 @@
                       onClick={() => onDeleteStep(step.id)}
    -                  className="opacity-0 group-hover/step:opacity-100 text-muted-foreground/25 hover:text-destructive transition-opacity p-0.5 flex-shrink-0"
    +                  className="opacity-0 group-hover/step:opacity-100 text-muted-foreground/30 hover:text-destructive transition-opacity p-1 flex-shrink-0"
    @@ -911,7 +911,7 @@
    -          <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
    +          <div className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
    @@ -1022,7 +1022,7 @@
                     aria-label="Delete"
    -                className="h-8 w-8 rounded-full text-muted-foreground/45 hover:text-destructive hover:bg-destructive/8 flex items-center justify-center transition-colors"
    +                className="h-8 w-8 rounded-full text-muted-foreground/45 hover:text-destructive hover:bg-destructive/10 flex items-center justify-center transition-colors"
    ```

- [ ] [P2][todo] **design-system: 把上一步发现的新 token 回写 tokens.css**
  - 动作：扫 `src/components/views/LinksView.tsx` 与 `StickyNotesView.tsx` 里的 `bg-[#xxxxxx]` 内联色，归类为 `--surface-peach / --surface-sage / --surface-lavender / --surface-cream` 等 semantic token，添到 `src/styles/tokens.css`；这一轮**不**做替换
  - 验收：
    - `grep -c "^\s*--surface-" src/styles/tokens.css` 比上一轮多 ≥ 3
    - `npm run build` 通过

## Notes

<!-- agent 可在此追加备忘、决策记录、新发现的任务草稿 -->
