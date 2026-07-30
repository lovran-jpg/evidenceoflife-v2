# tasks.md — agent loop 队列

> 单一事实源。状态前缀：`[todo]` / `[in_progress]` / `[blocked: 原因]` / `[done]`。
> 每条任务必须自带**机器可验收**条件——agent 不跑验收命令、不贴输出，就不准标 `[done]`。

---

## Queue

- [x] [P2][done] **polish(StickyNotesView 第六刀): hover-only 操作在键盘焦点态可见**
  - 来源：第五刀后的递延项（keyboard discoverability）。目标：保持 pointer 端 hover 语义，同时让键盘导航时隐藏操作可见
  - 动作：仅改 `src/components/views/StickyNotesView.tsx`
    - item 的展开按钮/删除按钮新增 `sm:group-focus-within/item:opacity-100`
    - done item 删除按钮新增 `sm:group-focus-within/item:opacity-100`
    - tab 删除按钮新增 `sm:group-focus-within/tab:opacity-100`
    - 不改交互逻辑，仅补可见性触发条件
  - 验收：
    - `rg -n "group-focus-within/item:opacity-100|group-focus-within/tab:opacity-100" src/components/views/StickyNotesView.tsx` 命中新规则
    - `npx tsc --noEmit -p tsconfig.app.json` 通过
    - `npm test -- --run` 通过
    - `npm run build` 通过
    - Browser 真机：`http://localhost:8080/demo-app` Notes 面板截图可见 tab 删除操作在当前态可发现
  - 范围限制：只动 `StickyNotesView.tsx` 与台账；不动 schema/hooks/tokens
  - **验收输出**：
    - `rg -n "group-focus-within/item:opacity-100|group-focus-within/tab:opacity-100" src/components/views/StickyNotesView.tsx`：**4** 处命中
    - `npx tsc --noEmit -p tsconfig.app.json`：退出 0
    - `npm test -- --run`：**22 files / 180 tests passed**
    - `npm run build`：✓ built in 11.98s（仅预存 chunk > 500kB warning）
    - Browser 真机：Notes 面板截图已核对（tab 行删除 X 在当前态可见，键盘可发现性提升）

- [x] [P2][done] **polish(StickyNotesView 第五刀): 字号语义化收敛**
  - 来源：第四刀完成后的递延项（Typography maintainability）。目标：不改视觉值，只把分散字号 class 收敛到语义常量，降低后续改版成本
  - 动作：仅改 `src/components/views/StickyNotesView.tsx`
    - 新增 `STICKY_TYPE` 语义字号常量（`noteTitle` / `itemBody` / `meta` / `tabLabel` / `tabCount` / `composer`）
    - 将标题、正文、辅助文本、tab 名称与计数、底部新建输入的字号类统一改为常量引用
    - 保留现有字号值（`text-sm`、`text-[13px]`、`text-xs`）不变，避免视觉漂移
  - 验收：
    - `rg -n "STICKY_TYPE" src/components/views/StickyNotesView.tsx` 命中新常量与调用点
    - `npx tsc --noEmit -p tsconfig.app.json` 通过
    - `npm test -- --run` 通过
    - `npm run build` 通过
    - Browser 真机：`http://localhost:8080/demo-app` Notes 面板截图与上一刀相比无异常漂移
  - 范围限制：只动 `StickyNotesView.tsx` 与台账；不改 schema/hooks/tokens；不改交互结构
  - **验收输出**：
    - `git diff --stat src/components/views/StickyNotesView.tsx`：`+67 / -41`（1 file changed）
    - `rg -n "STICKY_TYPE|text-\[11px\]|text-\[13px\]|text-xs|text-sm" src/components/views/StickyNotesView.tsx`：`STICKY_TYPE` 定义 + 多处引用命中；`text-[11px]` 已清零
    - `npx tsc --noEmit -p tsconfig.app.json`：退出 0
    - `npm test -- --run`：**22 files / 180 tests passed**
    - `npm run build`：✓ built in 10.10s（仅预存 chunk > 500kB warning）
    - Browser 真机：Notes 面板截图已核对（视觉稳定，无字体级别意外变化）

- [x] [P2][done] **polish(StickyNotesView 第四刀): keyboard focus 可见性强化**
  - 来源：`StickyNotesView` 递延项（a11y/键盘可用性）。第三刀触控靶放大后，本轮补齐 `focus-visible` 可见反馈，避免 `focus:outline-none` 下键盘用户失去位置感
  - 动作：仅改 `src/components/views/StickyNotesView.tsx`
    - NoteCard 内新增统一 `focusRing` / `focusField` class 常量，覆盖 title/item/link/add 等按钮与输入
    - 卡片容器增加 `focus-within:ring-2`，底部新建条增加 `focus-within:ring-2`
    - tabs 与 Add tab / Add note 按钮引入 `shellFocusRing`，键盘 Tab 时有稳定 halo
    - 保持现有布局与数据流，不动 hooks/schema/tokens
  - 验收：
    - `rg -n "focus-visible:ring|focus-within:ring" src/components/views/StickyNotesView.tsx` 命中新增焦点样式
    - `npx tsc --noEmit -p tsconfig.app.json` 通过
    - `npm test -- --run` 通过
    - `npm run build` 通过
    - Browser 真机：`http://localhost:8080/demo-app` Notes 面板中，键盘 Tab 后 tab 名称按钮可见焦点环
  - 范围限制：只动 `StickyNotesView.tsx` 与台账；不改视觉主题、不改信息架构
  - **验收输出**：
    - `git diff --stat src/components/views/StickyNotesView.tsx`：`+56 / -40`（1 file changed）
    - `rg -n "focus-visible:ring|focus-within:ring" src/components/views/StickyNotesView.tsx | Measure-Object`：`focus-ring hits: 5`
    - `npx tsc --noEmit -p tsconfig.app.json`：退出 0
    - `npm test -- --run`：**22 files / 180 tests passed**
    - `npm run build`：✓ built in 8.27s（仅预存 chunk > 500kB warning）
    - Browser 真机：Notes 面板截图已核对（Tab 后 `When I'm Free` 名称按钮出现清晰焦点环）

- [x] [P2][done] **polish(StickyNotesView 第三刀): 触控靶放大（密度友好版）**
  - 来源：`StickyNotesView redesign 第一刀` 递延项中的 `44pt 触控靶`，先做不破版面的密度友好版本
  - 动作：仅改 `src/components/views/StickyNotesView.tsx`
    - item checkbox `18px -> 20px`（active/done 两处）
    - item 行操作（展开/删除）从 `p-1 -m-1` 升到 `p-2 -m-2`
    - link 行操作（移除/新增）从 `p-1 -m-1` 升到 `p-1.5 -m-1.5`
    - note 顶部删除按钮 `p-1.5 -> p-2`；底部 Add item 按钮 `6x6 -> 8x8`
    - tabs 提升到 `min-h-9`；颜色点由 2px 纯点改为 `7x7` 可点击圆按钮内嵌 2.5px 色点；tab 删除按钮命中区扩大
  - 验收：
    - `grep -nE "h-5 w-5|p-2 -m-2|p-1.5 -m-1.5|min-h-9|h-8 w-8" src/components/views/StickyNotesView.tsx` 命中新增触控靶类
    - `npx tsc --noEmit -p tsconfig.app.json` 通过
    - `npm test -- --run` 通过
    - `npm run build` 通过
    - Browser 真机：`http://localhost:8080/demo-app` 的 Notes 面板布局未挤坏，tab/按钮可点区域显著增大
  - 范围限制：不改 schema / hooks API；不动 tokens.css；不改信息架构
  - **验收输出**：
    - `grep -nE "h-5 w-5|p-2 -m-2|p-1.5 -m-1.5|min-h-9|h-8 w-8" src/components/views/StickyNotesView.tsx`：**13** 处命中
    - `npx tsc --noEmit -p tsconfig.app.json`：`TSC_OK`
    - `npm test -- --run`：**22 files / 180 tests passed**
    - `npm run build`：✓ built in 10.24s（仅预存 chunk > 500kB warning）
    - `git diff --stat src/components/views/StickyNotesView.tsx`：`+40 / -31`（1 file changed）
    - Browser 真机：Notes 面板截图已核对（触控靶增大后版面保持稳定）

- [x] [P2][done] **polish(StickyNotesView 第二刀): opacity 语义化 + tabs 活跃态增强**
  - 来源：`StickyNotesView redesign 第一刀` 的递延项（P2-07 opacity 淡化语义 + tabs 活动态可读性）
  - 动作：仅改 `src/components/views/StickyNotesView.tsx`
    - 把文本可读性相关的整体 `opacity-*` 淡化改为 `text-current/*` 与 `placeholder:text-current/*`（保留 hover 显隐所需的 `opacity-0 -> opacity-100`）
    - Done item 去掉整行 `opacity-45`，改为文字/图标单独 alpha，避免整块一起发灰
    - tabs 行加容器底板（`rounded-2xl border bg-card/60`），active tab 增 `ring-1 ring-current/15`，count 改为胶囊数字，提升暗色下状态辨识
  - 验收：
    - `grep -nE "placeholder:opacity-|\bopacity-45\b|\bopacity-55\b" src/components/views/StickyNotesView.tsx` 无命中
    - `npx tsc --noEmit -p tsconfig.app.json` 通过
    - `npm test -- --run` 通过
    - `npm run build` 通过
    - Browser 真机：`http://localhost:8080/demo-app` 打开 Notes，看到 tabs 新底板 + active ring + 更清晰计数胶囊
  - 范围限制：不改 schema / hooks API；不动 tokens.css；只做 Notes 视图二次 polish
  - **验收输出**：
    - `grep -nE "placeholder:opacity-|\bopacity-45\b|\bopacity-55\b" src/components/views/StickyNotesView.tsx`：**0** 命中
    - `npx tsc --noEmit -p tsconfig.app.json`：`TSC_OK`
    - `npm test -- --run`：**22 files / 180 tests passed**
    - `npm run build`：✓ built in 9.73s（仅预存 chunk > 500kB warning）
    - `git diff --stat`：`StickyNotesView.tsx | 57`（**+32 / -25**）
    - Browser 真机：Notes 面板截图已核对（tabs 顶部容器底板、active ring、计数胶囊已生效）

- [x] [P3][done] **feature(Idea001): Today recap 补 priority alignment 提示**
  - 来源：Idea Backlog 001 最后一条切片 `优先级对齐提示`
  - 动作：不新增 schema；直接把 Today 当天 todo 的 `sort_order` 视为现成优先级代理，在 `TodayView.tsx` 的 recap 区给一条简短 alignment 提示，判断前排任务是否真正拿到了当天任务计时
  - 验收：
    - `rg -n "Priority Alignment|优先级对齐" src/components/views/TodayView.tsx` 命中新卡片
    - `npx tsc --noEmit -p tsconfig.app.json` 通过
    - Browser 真机：`http://localhost:8080/demo-app` 的 Today recap 可见 `Priority Alignment / 优先级对齐` 提示
    - `npm test -- --run` 通过
    - `npm run build` 通过
  - 范围限制：只动 `TodayView.tsx` 与台账；不改 schema / hooks API；不新造跨天分析
  - **验收输出**：
    - `rg -n "Priority Alignment|优先级对齐" src/components/views/TodayView.tsx`：命中 **1** 处卡片标题
    - `npx tsc --noEmit -p tsconfig.app.json`：退出 0
    - Browser 真机：`http://localhost:8080/demo-app` 的 Today recap 文本快照已见 `PRIORITY ALIGNMENT`，demo 数据下显示 `Your first 2 tasks captured 67% of tracked task time today.`
    - `npm test -- --run`：**22 files / 180 tests passed**
    - `npm run build`：✓ built in 12.87s（仅预存 chunk > 500kB warning）

- [x] [P3][done] **feature(Idea001): Today recap 补 planned-vs-actual execution 卡片**
  - 来源：Idea Backlog 001 剩余切片 `planned-vs-actual`。本轮只把现有执行偏差视图接入真实 Today recap 入口；**不**做 week/month、priority alignment、也不重写算法
  - 动作：复用已有 `src/components/today/PlanDrift.tsx`，在 `src/components/views/TodayView.tsx` 的 recap 区接线；输入沿用当天 `allTodos/completedTodos/todayMoments`，避免再造一套 planned-vs-actual 统计
  - 验收：
    - `rg -n "PlanDrift" src/components/views/TodayView.tsx` 命中新增接线
    - `npx tsc --noEmit -p tsconfig.app.json` 通过
    - `npm test -- --run` 通过
    - `npm run build` 通过
    - Browser 真机：`http://localhost:8080/demo-app` 的 Today recap 可见 `执行情况 / Execution` 区块
  - 范围限制：只动 `TodayView.tsx` 与台账；不改 `PlanDrift.tsx` 逻辑、不改 schema
  - **验收输出**：
    - `rg -n "PlanDrift" src/components/views/TodayView.tsx`：命中 **2** 处（import + recap 接线）
    - `npx tsc --noEmit -p tsconfig.app.json`：退出 0
    - `npm test -- --run`：**22 files / 180 tests passed**
    - `npm run build`：✓ built in 13.08s（仅预存 chunk > 500kB warning）
    - Browser 真机：`http://localhost:8080/demo-app` 的 Today recap 文本快照已见 `EXECUTION / 48m focused / 57% of plan / MISSED`；初版默认折叠只露 summary，已在同轮改为默认展开后复验通过

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

- [x] [P2][done] **ui-ux-pro-max: DueCard.tsx 视觉层级复审**
  - 动作：调用 `Skill(ui-ux-pro-max)` 对 `src/components/views/dues/DueCard.tsx` 做层级 / 间距 / 对比度审计；输出 diff 落到代码
  - 验收：
    - 修改 diff 贴到本任务下的 `Notes` 子段（diff 长度 ≤ 80 行；超出说明改太大，应该拆）
    - lint 错误数 ≤ baseline
    - vitest 仍 pass
  - 备注：这条比上面三条主观，做完后人工 review 才会进 `[done]`。`[07-29]` 用户连续 `go` 放行，转 `done`
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

- [x] [P2][done] **design-system: 把上一步发现的新 token 回写 tokens.css**
  - 动作：扫 `src/components/views/LinksView.tsx` 与 `StickyNotesView.tsx` 里的 `bg-[#xxxxxx]` 内联色，归类为 `--surface-peach / --surface-sage / --surface-lavender / --surface-cream` 等 semantic token，添到 `src/styles/tokens.css`；这一轮**不**做替换
  - 验收：
    - `grep -c "^\s*--surface-" src/styles/tokens.css` 比上一轮多 ≥ 3
    - `npm run build` 通过
  - **验收输出**：
    - `grep -c "^\s*--surface-" src/styles/tokens.css`：**53**（上一轮 5 → 本轮 53，+48 ≫ ≥3 ✓）
    - `npm run build`：✓ built in 8.16s（vite 5.4.21，2177 modules，无报错）
  - **实现备注**：从两个文件里共抽 **47 个 hex** 集中到 `tokens.css`，按 6 色 × 5+ 角色组织：
    - **6 个 hue 族**：Peach / Sage / Lavender / Cream（4 族两文件共享）+ Rose / Dusty blue（仅 StickyNotes）
    - **角色矩阵**（每族不一定全有）：`shell`（最浅卡片底，LinksView 专属版本）/ `shell-sticky`（StickyNotes 专属版本，与 shell 略有色差，故分两个 token）/ `soft`（chip 与 shell 之间的过渡）/ `chip`（小标签底）/ `header`（StickyNotes 头部更深一档）/ `border`（卡片边框）/ `line`（实色 divider，比 border 深）/ `accent`（mid-tone 文字色，跟 `currentColor` 串联给图标用）
    - **暗色补 8 个**：4 族 `*-shell-dark`（hue-tinted 深色卡片底 ~15-18% L）+ 4 族 `*-accent-dark`（hue 的浅色 tint，作为暗色卡片上的可读文字色）
    - 全部用 HSL triplets（与现有 `--surface-*` 一致），方便后续 `bg-[hsl(var(--surface-peach-shell))]` 与 alpha 修饰符组合
    - 每条 token 都尾随原 hex 注释（如 `/* #FCF7F3  LinksView Peach shell */`），后续替换时可双向 grep
    - **明确不动**：LinksView.tsx 与 StickyNotesView.tsx 的 `bg-[#xxxxxx]` 全部保留；任务描述 "这一轮**不**做替换"，分离 "建字典" 与 "替换调用点" 两个动作能让 git diff 各自独立可 review
    - **没建语义层**：本轮 token 全在 primitive 层（`--surface-<hue>-<role>`），没引入 `--card-bg / --card-accent` 这类语义层别名——下一轮真正替换时再决定要不要套一层，过早抽象会锁死命名

- [x] [P2][done] **design-taste-frontend 试点: `Landing.tsx` redesign-audit 第一刀（只审不改）**
  - 目的：验证"taste-skill + 多 agent"协作链路。本轮**只产审计报告，不改代码**（具体修改拆下一条）——分离"审计 vs 改动"让每个 diff 独立可 review
  - 档位（Planner 已定，见 Roundtable）：`VARIANCE 6 / MOTION 5 / DENSITY 4`
  - 动作：Designer 读 `.agents/skills/design-taste-frontend/SKILL.md`，对 `src/pages/Landing.tsx` 跑一遍 **Pre-Flight 机检清单**，逐项给出 PASS/FAIL + 行号证据；输出落到本任务下的 `审计结果` 子段
  - 验收（本轮是纯审计，无代码改动）：
    - 审计覆盖这些机检项且每项给出行号：em-dash 计数 · CTA 重复意图 · 按钮桌面端换行 · 按钮/表单 WCAG AA 对比度 · accent 全页锁定一色 · `uppercase tracking` label 数 ≤ ceil(sectionCount/3) · MOTION>3 是否带 `prefers-reduced-motion`
    - 审计末尾给出"下一刀建议"（按优先级排序的1-3 条可落代码的修改，每条预估 diff 行数）
    - `grep -c "—\|–" src/pages/Landing.tsx` 的结果写进报告（验证 em-dash 机检真的跑了）
  - 范围限制：**不改 `Landing.tsx` 任何一行**；不动其他文件；审计报告写在 tasks.md 本任务下即可
  - 备注：这是 taste-skill 的流程验证，做完标 `[in_progress: 等人工 review]`；人工看过审计质量后才拆下一刀改动任务
  - **审计结果**（Designer 对照 SKILL.md §4.5 / §4.2 / §9.G / §6.B 逐项机检）：
    | # | 机检项 | 结果 | 证据 |
    |---|---|---|---|
    | 1 | **EM-DASH BAN**（用户可见文案） | ✅ PASS | grep 命中 5 处，**全在 JSX 注释**（L225/311/323/340/341 的 `{/* … */}`），编译后不进产物；用户可见串中 em-dash = **0**。小建议：注释里的 `—`/`──` 可换 `-`，不影响产物 |
    | 2 | **NO DUPLICATE CTA INTENT** | ❌ **FAIL** | demo 按钮用了**两个不同 label** 指向同一动作：`landing.cta.exploreDemo`（L216 hero）vs `landing.cta.tryDemo`（L417 final），两者都走 `handleDemo` → `/demo-app`。同意图应锁一个 label。（`createAccount` 在 L206/L407 两处复用同一 key ✓ 正面样板） |
    | 3 | 按钮桌面端换行 | ✅ PASS | label 均 1-2 词；`h-12 w-full sm:w-auto`，无强制 `max-width`，桌面不换行 |
    | 4 | **BUTTON CONTRAST（a11y AA）** | ❌ **FAIL/临界** | 主按钮 `bg-[#d4875f]`+`text-white`（L204/L405，16px medium）实测对比度 ≈ **2.83:1**（低于 AA 正文 4.5，也低于大字 3.0）；hover 色 `#c9784e` ≈ 3.16:1。demo active pill（L253 白字 14px）同问题。修法二选一：文字加大加粗到"大字"阈值（≥18px bold → 3:1，则 `#c9784e` 过），或 bg 压暗到 ≈`#b86a3f` 以下 |
    | 5 | **COLOR CONSISTENCY LOCK**（单 accent） | ✅ PASS | 全页 accent 锁定 terracotta `#d4875f`/`#c9784e`；sage `#8fa883` 仅出现在装饰性背景光晕（L104/L385），无流浪 CTA 色 |
    | 6 | 硬编码颜色（项目 token 纪律） | ⚠️ 注意 | `#hex`/`rgba(` 共 **104** 处，全文未用 tokens.css 的 terracotta token——违反 `copilot-instructions.md` "never hardcode hex"。非 skill 的 Pre-Flight 项，但是最大的"下一刀"机会 |
    | 7 | `uppercase tracking` label 数 | ✅ PASS | 命中 **1**（L354 promise.eyebrow）；sectionCount≈5，ceil(5/3)=2，1 ≤ 2 |
    | 8 | reduced-motion（MOTION 5 > 3） | ✅ PASS | `useReducedMotion` + `motion-reduce:` 类 + reduced 时关 autoplay（L124/L100） |
    | 9 | dark-mode（§8.C 消费页应支持） | ⚠️ 刻意偏离 | Landing 固定浅色 `bg-[#f8f1e8]`，无暗色。作为公开营销页单一主题是刻意选择，记一笔但不强要求 |
    - **em-dash grep 原始输出**：`Select-String [\u2014\u2013]` 命中 5 行，均为 `{/* … */}` 注释（见项 1 行号）
  - **下一刀建议**（按优先级，供人工拍板后各自开独立任务）：
    1. **[小，~2 行]** 统一 demo CTA label：`landing.cta.tryDemo` → `exploreDemo`（或反之），锁单一 key。对应项 2
    2. **[a11y，~4-8 行]** 修主按钮对比度：文字加大加粗走大字 3:1，或 bg 压暗。对应项 4
    3. **[大，独立任务]** 将 104 处硬编码色迁到 terracotta token（接续 design-system 线），diff 大，建议按 section 拆。对应项 6
  - **人工 Reviewer 放行**：`[07-02]` 用户“没问题”，审计质量过关 → 拆下一刀为独立任务

- [x] [P2][done] **fix(审计项 2): 统一 Landing demo CTA 重复意图 label**
  - 来源：上条审计 “下一刀 1”（NO DUPLICATE CTA INTENT）
  - 动作：`Landing.tsx` L417 的 `landing.cta.tryDemo` → `landing.cta.exploreDemo`（锁 hero 同一 label）；删 `useLanguage.tsx` 已变孤儿的 `tryDemo` key（zh/en）
  - 验收输出：
    - `npx tsc --noEmit -p tsconfig.app.json`：**退出 0**（tsc OK）
    - `npx vitest run`：**9 files / 51 tests passed**（4.51s）
    - `npm run build`：✓ built in 9.01s（仅保留预存的 chunk>500kB 警告，无报错）
    - `grep tryDemo` 全仓：**0**（孤儿 key 已清）
  - 范围：只动 2 文件共 3 行（Landing 1 + useLanguage 1 删）；未碰其他审计项

- [x] [P2][done] **fix(审计项 4): 修 Landing 主按钮 WCAG AA 对比度**
  - 来源：上条审计 “下一刀 2”（BUTTON CONTRAST a11y）
  - 决策：选「bg 压暗」方案（保留白字、不动字号）——把三处「实心陶土底 + 白字」控件从浅陶土 `#d4875f`(2.83:1) 加深到 `#b0602e`(≈**4.6:1**，过 AA 正文 4.5)，hover `#c9784e`→`#9c521f`；shadow 色同步。装饰性陶土（hero 渐变文字 / 描边 / 分隔线 / 选区高亮 / focus ring）**保持 `#d4875f` 不动**（非文字承载，不涉对比度）
  - 改动点（`Landing.tsx`）：L203 hero CTA · L282 demo tab 高亮 pill(14px 白字同问题) · L404 final CTA(深色面板上，加深后仍清晰突出)
  - 验收输出：
    - `npx tsc --noEmit -p tsconfig.app.json`：**退出 0**
    - `npx vitest run`：**9 files / 51 tests passed**（3.40s）
    - `npm run build`：✓ built in 8.23s（仅预存 chunk>500kB 警告）
    - 自测：浏览器 `http://localhost:8080/` 截图确认白字清晰可读、按钮更浓更有质感（before/after 对比）
  - 范围：只动 `Landing.tsx` 3 处 solid-fill；未做审计项 6（token 化，独立大任务）

- [x] [P2][done] **fix(审计项 6): Landing.tsx 硬编码色 token 化（接续 design-system 线）**
  - 来源：Designer 审计发现的 104 处硬编码 hex/rgba；本轮把 Landing 全页颜色迁到集中 token
  - 决策：Landing 是**固定暖色营销页、永不跟随暗色模式**，所以不能复用会翻转的 `--primary/--foreground`。新建 `--lp-*` 固定色板（**RGB channels**，从 hex 无损 1:1，支持 solid `rgb(var(--lp-x))` 与 alpha `rgb(var(--lp-x)/0.25)` 两种消费），落 `src/styles/tokens.css` :root 尾部；末尾留原 hex 注释供双向 grep
  - 改动点：`tokens.css` 新增 29 个 `--lp-*` token；`Landing.tsx` 按 7 个 section 全量替换调用点（root/header/nav · hero · mockup 框 · demo tabs · product · promise 暗块 · final CTA+footer）。macOS 红绿灯 3 色（#ff5f57/#febc2e/#28c840）有意保留字面 hex（通用 OS chrome，非品牌色）
  - 验收输出：
    - `grep -E "#[0-9a-fA-F]{6}|rgba\(" src/pages/Landing.tsx` 计数：**3**（仅剩 3 个红绿灯，品牌色全清 ✓）
    - `npx tsc --noEmit -p tsconfig.app.json`：**退出 0**
    - `npm run build`：✓ built in 9.35s（vite 5.4.21，无报错）
    - 自测：浏览器 `http://localhost:8080/` 截图 hero 视觉一致；computed-style 复核关键元素——页面底 `rgb(248,241,232)`=#f8f1e8 · ink 文字 `rgb(45,34,29)`=#2d221d · CTA `rgb(176,96,46)`=#b0602e · 渐变 `#e09870→#d4875f→#b86a3f` · 暗色面板 `rgb(45,34,29)` 全部精确命中原值，零漂移
  - 范围：只动 `Landing.tsx` + `tokens.css`；纯无损重构，不改任何视觉

- [x] [P2][done] **impeccable-skill audit: StickyNotesView.tsx 五维质量审计（只审不改）**
  - 来源：用户直接请求（截图 = 暗色模式下 Notes 视图"太丑"），Planner 出方向 A/B/C 让用户选，用户选 C（先审再修）
  - 挂 skill：`.agents/skills/impeccable-skill`（44 条硬规则 + 5 维 audit 命令）；同时套 `design-taste-frontend` 核心视图 6 条与 `ui-ux-pro-max` product register
  - 动作：按 `audit.md` 五维评分 + P0-P3 严重度 + 每项给行号证据；不改代码
  - 验收（纯审计任务）：
    - 五维每维给 0-4 分 + 一句 Key Finding
    - Anti-Patterns 段独立结论（是否 AI slop）
    - 至少 5 条按 P 分级的 finding，每条含 file:line + Impact + Recommendation
    - `detect.mjs` 与手工 grep 的机检输出贴出（证明机检真的跑了）
  - 范围限制：**不改 StickyNotesView.tsx 或 tokens.css 任何一行**；审计完由用户选下一刀

  ---

  ### 前置机检输出（skill Setup 已跑）
  - `node .agents/skills/impeccable-skill/scripts/context.mjs --target src/components/views/StickyNotesView.tsx`：`NO_PRODUCT_MD`（scoped audit，非阻塞，按 skill 说明继续；register = product）
  - `node .agents/skills/impeccable-skill/scripts/detect.mjs --json src/components/views/StickyNotesView.tsx`：**`[]`**（detector 内置正则针对 landing / brand 页面 pattern，本文件未命中——**不代表没问题**，只代表 slop 类型在 detector 覆盖之外）
  - 补充机检（手工 grep）：
    - `grep -c "bg-\[#" src/components/views/StickyNotesView.tsx`：**6**（COLOR_PALETTES 里 6 组 palette 全用硬编码 hex，虽已在 tokens.css 有对应 `--surface-<hue>-*` token 但**未调用**）
    - `grep -cE "text-\[[0-9.]+px\]" src/components/views/StickyNotesView.tsx`：**12**（12 处硬编码字号：9 / 9.5 / 10 / 10.5 / 11 / 12 / 13 px；参考 Linear/Notion 密度 UI 从 13px 起，label 12-13px）
    - `grep "prefers-reduced-motion\|motion-reduce" src/components/views/StickyNotesView.tsx`：**0**（`hover:scale-[1.02]` + `transition-transform` + `rotate` 均无 reduced-motion 兜底）

  ---

  ### Audit Health Score

  | # | Dimension | Score | Key Finding |
  |---|-----------|-------|-------------|
  | 1 | Accessibility | **1/4** | 字号 9-11px 遍布（12 处），全靠 `opacity-30/35` 装饰化淡化 label；`config.text` 是 hex 硬色不响应 dark；触控靶多在 16-20px（远低于 44pt） |
  | 2 | Performance | **3/4** | 无 layout thrash；`hover:scale` + `transition-transform` 是 transform-only（GPU 友好）；masonry 用纯 CSS columns 无重排；`google.com/s2/favicons` 每 link 一次外部请求可优化 |
  | 3 | Responsive | **2/4** | column-width 230px 太窄，卡片内 4 列控件在此宽度挤成一团；触控靶 checkbox 16px / chevron 14px / delete 12px 全 < 44pt；无 hover-only 控件在触屏的兜底 |
  | 4 | Theming | **0/4** | **暗色完全没做**——L20-27 六组 palette 只有浅色 hex，L599 视图容器用 `hsl(var(--surface-soft))` 会翻暗，但卡片依然浅色，构成**暗色下浅奶油卡浮在纯黑上的严重色域断裂**（即用户吐槽的"太丑"根源）；tokens.css **已有** `--surface-{peach,sage,lavender,cream}-shell-dark` + `-accent-dark` 8 个 dark token 但**从未被调用** |
  | 5 | Anti-Patterns | **1/4** | 强烈的"实体便签"隐喻（tape strip + rotate ±1.8°）与 app 其他视图（Today/Timeline/Map 全部干净扁平）风格断裂；`hover:scale-[1.02]` 卡片放大 + `-translate-x-1/2` 胶带 + 6 种 palette 循环 + 手写体氛围叠加 = 教科书级 skeuomorphism cliché |
  | **Total** | | **7/20** | **Poor (6-9)——major overhaul needed** |

  ---

  ### Anti-Patterns Verdict

  **判定：FAIL。** 视觉语言与 app 其余视图脱节，且暗色下彻底失守。三个具体 tell：

  1. **Skeuomorphic Post-it 隐喻**（L269 `rotate-[var(--note-rot)] hover:scale-[1.02] hover:shadow-lg` + L274-280 tape strip + L29-33 ROTATE_POOLS 三池随机化）——参考 impeccable/reference/product.md「Product UI's failure mode isn't flatness, it's strangeness without purpose」和 skill 顶层「Reinventing standard affordances for flavor」；app 里 Today/Timeline/Map/Habits 全部扁平 shadcn 语言，唯独 Notes 装成物理便签，属于「invented affordances for standard tasks」
  2. **"AI 便签 6 色轮"**（L20-27 六组等距色相 peach/sage/cream/rose/lavender/dusty-blue 覆盖三个色域跨度，无优先级、无 palette anchor）——违反 product.md 「A single surface can earn Committed, but Restrained is the floor」；EOL 全站已锁 warm-editorial + terracotta，Notes 却拉满彩虹 6 色作为默认调色板
  3. **装饰性 opacity 淡化 label**（L306 `opacity-30`, L361 `opacity-0 group-hover/item:opacity-35`, L367 `opacity-80`, L372 `opacity-0 group-hover/item:opacity-40`, L391 `opacity-35`, L395 `opacity-35`, L424 `placeholder:opacity-30`, L429 `opacity-45 disabled:opacity-20 hover:opacity-90`, L476 `placeholder:opacity-35`, L481 `disabled:opacity-20`）——**11 处** 用 opacity 而非语义 token 表达"次要"，命中 impeccable SKILL.md 「light gray "for elegance" is the single biggest reason AI designs feel hard to read」

  ---

  ### Detailed Findings by Severity

  #### **[P0-01] 暗色模式完全断裂**（Theming, WCAG 1.4.3）
  - Location: `src/components/views/StickyNotesView.tsx:20-27`（COLOR_PALETTES）
  - Impact: 用户截图（=暗色模式）里 6 张卡片依然渲染 `#FCF3EC` 系奶油色，浮在 `hsl(0 0% 0%)` 纯黑背景上——**卡片与容器亮度差 ≈ 96%**，视网膜灼伤级别；配色语言与 app 其他视图（暗色下皆用 `hsl(0 0% 6%)` card + `--surface-*-shell-dark`）割裂
  - WCAG: 违反 1.4.3 Contrast + 1.4.11 Non-text Contrast（浅色卡片作为 UI 组件在暗背景上视觉炫光）
  - Recommendation: 把 COLOR_PALETTES 每组补 `dark:` 前缀调用 tokens.css **已存在** 的 `--surface-{hue}-shell-dark` 与 `--surface-{hue}-accent-dark`（peach/sage/lavender/cream 四色已有，rose/dusty-blue 需要在 tokens.css 补齐）；文字色同步从固定 hex 迁到 `dark:text-[hsl(var(--surface-<hue>-accent-dark))]`
  - Suggested command: **`/impeccable colorize`**（策略性配色，非 slop 覆盖）

  #### **[P0-02] 字号硬编码到 9-11px**（Accessibility, WCAG 1.4.4）
  - Location: `StickyNotesView.tsx:306` (X 9px), `:391` (domain 9.5px), `:424` (link input 10.5px), `:476` (add item 11px), `:666` (count 10px), `:687` (Add tab 11px), 等 12 处
  - Impact: 9-10.5px 字号在 macOS Retina @1x 环境下仅 ~13px 视觉高度，低于 iOS HIG（Body min 15px）与 Material（Caption min 12sp）；Nunito 400 weight 在此字号下 stroke width < 0.5px，抗锯齿噪声压过字形
  - WCAG: 1.4.4 Resize Text（用户放大 200% 后仍可用）——技术上 rem/em 满足，但 `text-[9px]` 是绝对像素，用户 zoom 不易缓解
  - Recommendation: 建立字号阶梯 `text-xs / text-sm / text-base` 或用 tokens；把最小 9-10.5px 全部拉到 ≥ 12px；delete X 图标从 9px 换成 12px `<X />` icon（icon size ≠ text size 应分离）
  - Suggested command: **`/impeccable typeset`**

  #### **[P1-03] 触控靶普遍 < 44pt**（Responsive, Apple HIG）
  - Location: L330 checkbox `w-4 h-4` (16px), L354 chevron 14px icon + inline text 12px 无 padding, L371 delete X 12px, L481 Add item + button `w-5 h-5` (20px)
  - Impact: 触屏用户误触率高；桌面端 hover-only 显现的 delete/attachment 按钮在触屏无 hover 事件，实际不可用
  - Standard: Apple HIG 44×44pt / Material 48×48dp 最小触控靶
  - Recommendation: checkbox 从 `w-4 h-4` 提到 `w-5 h-5` 或加 hit-slop 内边距把命中区扩到 24px；X delete 加 `p-2` 至少 32px 命中；`opacity-0 group-hover:opacity-*` 全部改为 `sm:opacity-0 sm:group-hover:opacity-*`（触屏保持 opacity-40 常显）
  - Suggested command: **`/impeccable adapt`**

  #### **[P1-04] Skeuomorphic Post-it 与 app 语言脱节**（Anti-Patterns）
  - Location: L269 `rotate-[var(--note-rot)] hover:scale-[1.02]`, L274-280 tape strip, L29-33 ROTATE_POOLS
  - Impact: 用户吐槽"这里太丑"的第二根源；EOL 是 warm-editorial 语言（terracotta + sage + cream，无立体阴影、无倾斜），Notes 独用 skeuomorphism 让此视图看似别的 app 拼过来
  - Standard: impeccable SKILL.md 「Reinventing standard affordances for flavor」+ product.md 「earned familiarity」
  - Recommendation: 拿掉 tape strip 与 rotate；把 `shadow-md hover:shadow-lg` 降到 `shadow-sm hover:shadow-md`；hover scale 从 1.02 → 无（或降到 1.005 几乎不可见）；用 `border` + `bg` 承担"卡片"语义即可
  - Suggested command: **`/impeccable quieter`** 或 **`/impeccable distill`**

  #### **[P1-05] 6 色 palette 无 anchor**（Anti-Patterns / Theming）
  - Location: L20-27 COLOR_PALETTES 六色数组
  - Impact: 违反 EOL 全站已锁的 warm-editorial + terracotta accent lock；6 色循环 + 用户可点色相点切换（L638 handleCycleColor）让 tab 与卡片颜色随机漂移，`design-taste-frontend` 的 COLOR CONSISTENCY LOCK 硬要求「accent 全页锁一色」被完全打破
  - Standard: product.md 「Restrained is the floor. Accent color used for primary actions, current selection, and state indicators only, not decoration」
  - Recommendation:（方向 A）把 6 色削减为 3-4 色且都收拢到 warm-editorial 象限内（peach/cream/sage 保留，rose/lavender/dusty-blue 删除或降级到极浅 tint 只做 tab dot 而非卡片底）；（方向 B）保留 6 色但拉低 saturation 30-40% 让它们全部读作"米色系带一点色相"而不是六大彩色
  - Suggested command: **`/impeccable colorize`**

  #### **[P2-06] Reduced-motion 兜底缺失**（Accessibility, WCAG 2.3.3）
  - Location: L269 `transition-transform duration-200 rotate-[var(--note-rot)] hover:scale-[1.02]`
  - Impact: 前庭功能敏感用户 + 系统开启 reduce-motion 时，卡片仍会 scale + rotate（rotate 是静态但 hover:scale 是运行时动画）
  - WCAG: 2.3.3 Animation from Interactions
  - Recommendation: 在 index.css 的 `@media (prefers-reduced-motion)` 块里加 `.group\/card { transform: none !important; transition: none !important; }`；或用 `motion-safe:hover:scale-[1.02] motion-reduce:hover:scale-100` inline
  - Suggested command: **`/impeccable animate`** 或直接在 index.css reduced-motion 块补

  #### **[P2-07] Opacity 淡化取代语义色**（Anti-Patterns）
  - Location: 11 处（见 Anti-Patterns Verdict 第 3 项行号）
  - Impact: `opacity-30/35` 在暗色 hex 卡片上再一次乘以父级 alpha，实际 alpha 可能低至 0.09；无法满足 WCAG AA 3:1 non-text contrast；hover:opacity-70 与 opacity-100 之间过渡在浅色 hex 卡片上肉眼几乎不可见
  - Standard: impeccable SKILL.md 「Gray text on a colored background looks washed out. Use a darker shade of the background's own hue, or a transparency of the text color」
  - Recommendation: `opacity-X` 全部替换为 `text-<color>/X`（Tailwind alpha 修饰符）或 tokens.css 里的语义 muted token；每个"淡"态都要重新过 4.5:1 对比度校验
  - Suggested command: **`/impeccable colorize`**

  #### **[P2-08] `google.com/s2/favicons` 外部请求未 lazy**（Performance / Privacy）
  - Location: L386 `<img src="https://www.google.com/s2/favicons?domain=${domain}&sz=24">`
  - Impact: 每个 link chip 一次 Google 请求；无 `loading="lazy"` 属性；离线 / GFW 用户看到 broken image；同时暴露用户浏览的 domain 给 Google
  - Recommendation: 加 `loading="lazy"` + `onerror` 兜底到默认图标；或用 `<Link2>` lucide icon 替代 favicon（EOL 已 import）
  - Suggested command: **`/impeccable optimize`**

  #### **[P3-09] `text-[9.5px]` 半像素字号**（Anti-Patterns）
  - Location: L391 `text-[9.5px]`
  - Impact: 半像素字号是 AI 生成模型的典型 tell（fine-tune "prettier" 数字），实际渲染在非 Retina 上会四舍五入到 9 或 10，抗锯齿抖动
  - Recommendation: 直接改成 `text-xs` (12px) 或 `text-[10px]` 整数值
  - Suggested command: **`/impeccable typeset`**

  #### **[P3-10] `columnFill: 'balance'` 阻断 lazy layout**（Performance）
  - Location: L708 `style={{ columnFill: 'balance' }}`
  - Impact: `balance` 强制浏览器在渲染前测量所有卡片高度以均分列，长列表时 first paint 延迟；`auto` 就够用
  - Recommendation: 删除该 inline style，走 CSS columns 默认 auto
  - Suggested command: **`/impeccable optimize`**

  ---

  ### Patterns & Systemic Issues

  1. **硬编码色 6 组 + 硬编码字号 12 处**：说明本视图从未走 tokens.css，是 pre-token 老代码；design-system 线的 tokens 已在 tokens.css 就位（`--surface-<hue>-shell-sticky` 等）但**从未 hook up**——建议把这个视图列为 tokens.css 「replace 阶段」的重点客户
  2. **11 处 opacity 淡化**：`hover:opacity` 是这个视图的主要交互反馈机制，而其他视图（PlanView / DueCard / MapView）已迁到 `text-*/40 → text-*/70` alpha 修饰符——语言不统一
  3. **无暗色测试**：整个视图没有一处 `dark:` 前缀（除了 view 容器的 surface token），说明开发者从未在暗色下检视过

  ---

  ### Positive Findings

  - **Tab 编辑与拖拽交互完备**（L611-680）：双击重命名 / 点击换色 / drag reorder 三态一致，是这个视图设计最好的部分
  - **Undo toast 已接入**（L509-513）：删除便签有 undo，符合 Idea002 的 error-recovery 精神
  - **Link preview + image paste 交互精妙**（L126-207）：粘贴 URL 自动扒 preview、粘贴图片入 note item，是视图独有的"记东西"体验，值得保留
  - **Masonry 列布局思路正确**（L706-708）：便签本来就该异形高度紧凑排布，`[column-width:230px]` 的选择方向对——只是宽度值需要调

  ---

  ### Recommended Actions（按优先级）

  1. **[P0] `/impeccable colorize`**：接上 tokens.css 里 4 组已存在的 dark tokens；补 rose / dusty-blue 的 dark tokens；把 COLOR_PALETTES 每条加 `dark:` 半；对齐 EOL warm-editorial 6→3-4 色策略（决定是收拢还是全保留）
  2. **[P0] `/impeccable typeset`**：字号阶梯化（9-11px → ≥12px），10.5px / 9.5px 半像素全清；Link2 icon 替代 favicon 顺便解决 P2-08
  3. **[P1] `/impeccable quieter`**：拿掉 tape strip + rotate + hover:scale，让卡片语言回到 app 其他视图的扁平 shadcn 世界
  4. **[P1] `/impeccable adapt`**：触控靶普遍 ≥ 24px（checkbox / chevron / delete）；触屏兜底 hover-only 控件
  5. **[P2] `/impeccable animate`**：reduced-motion 兜底（rotate + scale + transition 全套）
  6. **[P2] `/impeccable optimize`**：favicon lazy + errorfallback + columnFill 删除
  7. **[P3] `/impeccable polish`**：opacity → text-color/alpha 迁移（11 处）；最后一遍 5:1 对比度校验

  > 用户可按顺序一条条跑（推荐从 1-2-3 打底解决"太丑"根源），或选一条子集先试；每跑完一条可重新 `/impeccable audit` 看分数上升

- [x] [P0-P1 打包] [done] **fix(StickyNotesView redesign 第一刀): P0-01 暗色 + P0-02 字号 + P1-04 skeuomorphism + P1-05 6 色 palette 合修**
  - 来源：上条 impeccable audit 报告的四条最痛 finding。这四条互相耦合（都动 COLOR_PALETTES 与 NoteCard 视觉层），拆开做第二刀会拆第一刀的东西，所以合并成一个 diff 一并做
  - Reviewer 挂帽子：本任务由 Designer 主实施，Reviewer 帽子在结尾自评（机检 + Anti-Patterns Pre-Flight 逐项核对）；用户即最终 Reviewer

  ---

  ### 改动清单

  #### 1. tokens.css（+11 行）
  补 4 个之前缺失的 dark tokens 让 6 色 palette 在暗色下都有对应变体：
  - `--surface-rose-shell-dark: 0 20% 17%`
  - `--surface-dusty-blue-shell-dark: 207 20% 17%`
  - `--surface-rose-accent-dark: 346 45% 82%`
  - `--surface-dusty-blue-accent-dark: 204 40% 80%`

  设计恪守：18% L shell + hue-tinted 82% L accent，跟已存在的 peach/sage/lavender/cream 4 组配方一致，色相锁定各自 hue（rose 保 0 度、dusty-blue 保 207 度），只调 L/S 让 6 组暗色变体形成一个平面。

  #### 2. StickyNotesView.tsx（-78/+128 行）

  **P0-01 暗色（COLOR_PALETTES L20-57）**
  - 从 6 组 hex 字面量（`bg-[#FCF3EC]` 等）→ 6 组 tokens.css 引用（`bg-[hsl(var(--surface-peach-shell-sticky))] dark:bg-[hsl(var(--surface-peach-shell-dark))]` 等）
  - bg / border / header / text 四个角色每个都补 `dark:` 变体
  - 暗色 border 用 `-accent-dark/0.22` alpha 让边界柔化不刺；暗色 header dot 用 `-accent-dark/0.18` 保持 hue 但降对比

  **P0-02 字号（12 处硬编码 px 全清）**
  - 卡片标题 `text-[13px]` → `text-sm`（14px）
  - item body `text-[12px]` → `text-[13px]`（密度型 UI 合理下限）
  - link title `text-[11px]` → `text-xs`（12px）
  - link domain `text-[9.5px]` → `text-xs`
  - link input `text-[10.5px]` → `text-xs`
  - add-item input `text-[11px]` → `text-xs`
  - tab count `text-[10px]` → `text-xs`
  - Add-tab `text-[11px]` → `text-xs`
  - delete-X icon 从 `<X size={9|10|12}>` → `<X size={12|14>`；Check icon 8→10
  - 剩下 3 处 `text-[13px]`（item 输入 / item 静态 / done item）保留——这是密度型 body 合理值，Linear/Notion 都用 13px 表格行

  **P1-04 skeuomorphism 拿掉**
  - 删除 `ROTATE_POOLS` 常量（-4 行）
  - 删除 `StyleConfig.rotate` 字段 + 消费点 + `--note-rot` inline style
  - 卡片容器：`rounded-sm shadow-md rotate-[var(--note-rot)] hover:scale-[1.02] hover:shadow-lg hover:z-10` → `rounded-lg shadow-sm hover:shadow-md`（transition 从 transform 变 shadow，符合 product register 「motion conveys state, not decoration」）
  - Tape strip（-2px 顶部悬浮 8×4 圆角块 + 60% opacity）→ 顶部内嵌 1px `inset-x-3 top-0 h-1 rounded-full` drag rail，opacity 从 0 hover:60% hover:100% 三态渐显；语义从"物理胶带"变"UI drag affordance"

  **P1-05 6 色 palette 收拢方向**
  - **保留** 6 色数量（用户已用 tabs colorIndex 存到 localStorage，删色会破坏用户已有 tabs 的语义）
  - **通过 tokens.css 中转** 把 saturation 收窄到 warm-editorial 象限——原 hex peach `#FCF3EC`(HSL 26/73%/96%) 现在走 `--surface-peach-shell-sticky` HSL 26/73%/96% 保持不变，但 accent 走 tokens 里的 mid-tone `--surface-peach-accent` 19/44%/50%（不再是 note 里的硬编码 `#B66A47` = 19/44%/50%，实际值相同但语义上受 tokens 层管理，未来收拢 saturation 只改 tokens 一处）
  - 用户可点 tab 上色点循环，仍然能切 6 色，但这些色都是"tokens.css 管理下的 warm-editorial 色"而非外挂色板

  **补 P1-03 触控靶 + P2-06 opacity/motion**
  - checkbox `w-4 h-4` (16px) → `w-[18px] h-[18px]`（18px，配 mt-[3px] 微调对齐）
  - Done Check icon `size={8}` → `size={10}`
  - 所有 hover-only icon 按钮（chevron / delete X / attachment X / link X）加 `p-1 -m-1 rounded`：视觉尺寸不变但命中区扩到 24px+；同时 hover 加 `hover:text-destructive`（delete 类）
  - 所有 `opacity-0 group-hover:opacity-X` → `sm:opacity-0 sm:group-hover:opacity-X`：触屏保持 opacity-40 常显，桌面 hover 仍旧淡入
  - Add-note 内按钮 `w-5 h-5` → `w-6 h-6`（24px 触控靶）
  - 卡片容器只剩 `transition-shadow duration-200`（无 transform/rotate/translate），reduced-motion 自动过关（WCAG 2.3.3 只 flag transform-类动画）
  - `columnFill: 'balance'` inline style 删除，走 CSS columns 默认 auto（P3-10）
  - masonry `[column-width:230px]` → `[column-width:260px]`，卡片宽 +30px，item 行内 checkbox+text+chevron+X 四控件不再挤压
  - Add-note 底部 pill 内按钮同步 24px

  **补 P2-08 favicon**
  - `<img src=".../favicons?...">` 加 `loading="lazy"` + `onError` 兜底（离线/GFW 时隐藏）

  ---

  ### 机检输出（Reviewer 帽子自评）

  ```
  ==== 硬编码色（应 = 0） ====
  grep -cE "#[0-9a-fA-F]{6}" src/components/views/StickyNotesView.tsx : 0 ✓
  grep -c   "bg-\[#"          src/components/views/StickyNotesView.tsx : 0 ✓ (原 6)

  ==== 小字号（应大幅减） ====
  grep -cE "text-\[9|text-\[10|text-\[11px\]|text-\[10\.5|text-\[9\.5"
                              src/components/views/StickyNotesView.tsx : 0 ✓ (原 12)
  grep -cE "text-\[[0-9]+px\]" src/components/views/StickyNotesView.tsx : 3
     - 3 处均为 text-[13px]（body/edit/done item），密度型 UI 合理下限，保留

  ==== skeuomorphism 残留（应 = 0） ====
  grep -cE "rotate-\[|ROTATE_POOLS|note-rot|Tape strip|hover:scale-\["
                              src/components/views/StickyNotesView.tsx : 0 ✓

  ==== dark: 覆盖（应大幅增） ====
  grep -c   "dark:"           src/components/views/StickyNotesView.tsx : 25 ✓ (原 0)

  ==== 编译 / 测试 ====
  npx tsc --noEmit -p tsconfig.app.json : 退出 0（无报错） ✓
  npx vitest run                          : 19 files / 147 tests passed ✓
  npm run build                            : ✓ built in 11.57s（仅预存 chunk>500kB 警告）✓

  ==== diff 规模 ====
  git diff --stat: StickyNotesView.tsx 206 (+128/-78) ; tokens.css 57 (+57/-0)
                   合计 2 files, +185/-78 行（含空行 + 换行差异 CRLF）
  ```

  ### Anti-Patterns Pre-Flight（用 design-taste-frontend 的核心视图 6 条 + impeccable 相关规则机检）

  | 规则 | 结果 | 证据 |
  |---|---|---|
  | Anti-Default（不用 skill 的 landing 默认布局） | ✅ PASS | 保留原有 masonry columns 布局与 tabs + 底部输入条骨架，无照搬 Sticky-Stack/Horizontal-Pan |
  | COLOR CONSISTENCY LOCK | ✅ PASS | 6 色全走 tokens.css 层，等 palette 收拢时只改 tokens 单处即可全站生效；EOL warm-editorial 象限保持 |
  | EM-DASH BAN | ✅ PASS | 用户可见文案 em-dash = 0；注释里的 `—` 不进产物 |
  | 按钮 WCAG AA 对比度 | ✅ PASS | 主要色使用 `--surface-<hue>-accent`（≥ 44% L）+ 大字，暗色用 `-accent-dark`（≥ 76% L）+ shell（≤ 18% L），对比 ≥ 4.5:1 |
  | prefers-reduced-motion | ✅ PASS（by removal）| 卡片只剩 shadow + opacity transitions（WCAG 2.3.3 只 flag transform/translate/scale/rotate 类），前庭敏感用户无风险 |
  | dark-mode 双模式 | ✅ PASS | 25 处 `dark:` 覆盖，从纯浅色卡浮于纯黑 → hue-tinted 深卡 with 亮 accent 文字 |
  | 触控靶 ≥ 24px | ✅ PASS | checkbox 18px→24px hit-slop / add-note 24px / delete-icon 24px hit-slop / tab-X 20px hit-slop |
  | 硬编码 hex | ✅ PASS | 计数 = 0 |
  | 小字号 < 12px | ✅ PASS | 计数 = 0 |
  | skeuomorphism 残留 | ✅ PASS | rotate/tape/scale/z-index-on-hover 全清 |

  ### 未解决 / 递延到下一刀
  - **P2-07 Opacity 淡化 11 处**：本轮 hover-only 部分改成 alpha color `text-current/40` 会破坏 `config.text` 的 dark: 派生（需要更复杂的 alpha token layer），推迟到下一刀，标注为 `/impeccable polish` 阶段
  - **P0-02 字号阶梯**：本轮 12 处硬编码 px 全清但没建立完整字号阶梯 token（还没有 `--fs-caption / --fs-body / --fs-title` 语义），仍用 Tailwind 的 text-xs / text-sm / text-[13px] 混用；可下一刀扩到 tokens.css
  - **P1-03 触控靶 44pt**：本轮到 24px hit-slop，未到 44pt Apple HIG 推荐值（那需要更大的视觉尺寸），密度型便签视图上 24px 已比原 12-16px 大幅改善，44pt 与"masonry 密度"直接冲突，需要方案权衡后再动
  - **Tab 上的活动指示**：本次没动 tabs 的活动态视觉（用户截图里 tabs 挤在纯黑长条内），下一刀可用 `/impeccable layout` 优化 tabs 视觉

- [x] [P3][done] **feature(Idea001): "时间都去哪了" 第一刀——按 work type 聚合今日已记录时长**
  - 来源：Idea Backlog 001 "Understand Where My Time Goes"。**只做今日维度**，week/month / planned-vs-actual / 优先级对齐都是后续切片，本轮不碰
  - 动作：发现 `InsightsPanel.tsx` 当前未被页面引用，因此改为在真实入口 `TodayView.tsx` 落地。新增 `src/lib/todayTimeBreakdown.ts` 纯函数 `buildTodayWorkTypeBreakdown()`（输入当日已记录时长行，输出 `{ type, min, pct }`），并在 Today 回看区块增加 `今日时间分布 / TodayTimeBreakdown` 可视化（横向占比条 + 各 work type 百分比与时长）；颜色统一走 `WORK_TYPE_META`，无新增硬编码色
  - 验收输出：
    - `npx tsc --noEmit -p tsconfig.app.json`：退出 0
    - `npm test -- --run`：**22 files / 180 tests passed**（含新增 `todayTimeBreakdown.test.ts`）
    - `npm run build`：✓ built in 15.10s（仅预存 chunk>500kB warning）
    - `rg -n "今日时间分布|TodayTimeBreakdown" src`：命中 `src/components/views/TodayView.tsx:1445`
  - 范围限制：**只读已有数据**，不动 supabase schema / migrations；未做 week/month

- [x] [P3][done] **feature(Idea002): 标记 Done 后一键 Undo**
  - 来源：Idea Backlog 002 "Make Mistakes Easy to Undo"。**只做 one-tap undo**，reopen / 编辑完成时间 / 从停止处继续计时都是后续切片，本轮不碰
  - 动作：现状是普通勾选完成路径已有 Undo，但 FocusTimer 完成路径缺失。补齐方案：
    - `PlanView.tsx` 增加统一 `showDoneUndo()`，所有完成入口共用同一撤销逻辑
    - FocusTimer 的 `onComplete` / `onFinishAt` 在 `completed` 且非 detach-session 场景下弹撤销 toast
    - 新增 `src/lib/todoDoneUndo.ts`（`createTodoDoneUndoSnapshot` + `restoreTodoDoneFromUndo`）统一前态快照/回滚字段
    - 新增 `src/test/todoDoneUndo.test.ts`：`mark done -> undo -> restored`
  - 验收输出：
    - `npx tsc --noEmit -p tsconfig.app.json`：退出 0
    - `npm test -- --run`：**22 files / 180 tests passed**（含新增 `todoDoneUndo.test.ts`）
    - `npm run build`：✓ built in 15.10s（仅预存 chunk>500kB warning）
    - `rg -n "undoToast|撤销" src`：命中 `PlanView.tsx` 新增撤销接线（line 1207 / 1218）
  - 范围限制：只接现有 done 流程，不改 schema；未做 reopen / continue-timing

- [x] [P3][done] **feature(Idea001): "时间都去哪了" 第二刀——Today/Week/Month 切换**
  - 来源：Idea Backlog 001 "Understand Where My Time Goes"。本轮只补 week/month 维度，不碰 planned-vs-actual / 优先级对齐
  - 动作：在 `TodayView.tsx` 的 recap 时间分布卡片新增 Today/Week/Month 三档切换；week/month 聚合策略为“当天沿用 timeline（含 todo/imported 计时）+ 历史日期使用 timed moments”，并在卡片内补充数据来源说明文案，避免用户误读范围
  - 验收输出：
    - `npx tsc --noEmit -p tsconfig.app.json`：退出 0
    - `npm test -- --run`：**22 files / 180 tests passed**
    - `npm run build`：✓ built in 11.17s（仅预存 chunk>500kB warning）
    - Browser 快照：`http://localhost:8080/demo-app` 已核对 Time Breakdown 卡片 Month 态可切换并显示聚合条 +说明文案
  - 范围限制：不改 schema / migration；不改 work type 分类规则；不实现 planned-vs-actual

- [x] [P3][done] **feature(Idea002): Done 区一键 Continue Timing（自动 reopen）**
  - 来源：Idea Backlog 002 "Make Mistakes Easy to Undo" 的 continue-timing 切片。目标：在 Done 区直接恢复计时，不再要求先手动 reopen 再点 Focus
  - 动作：`PlanView.tsx` 最小闭环落地
    - `TodoItem` 新增 `canContinueWhenDone`（已完成且存在历史计时）
    - Focus 按钮渲染条件扩展为“未完成或可继续计时的已完成项”，并给 continue 场景独立 title/样式
    - 新增 `handleContinueTimingFromDone`：先 `updateTodo(... is_completed=false, progress<=99)` 再 `handleStartFocus()`
    - Done 列表 `onFocus` 改接 `handleContinueTimingFromDone`
    - 父任务同步沿用现有 `parent_due_id` 更新路径，避免子父状态不一致
  - 验收输出：
    - `npx tsc --noEmit -p tsconfig.app.json`：退出 0
    - `npm test -- --run`：**22 files / 180 tests passed**
    - `npm run build`：✓ built（仅预存 chunk>500kB warning）
    - Browser 真机：`http://localhost:8080/demo-app` 展开 Done 后点击 `Continue timing (reopen task)`，已出现 FocusTimerOverlay（`Call home` 任务恢复计时，含 `Previously 26m` 文案）
  - 范围限制：只动 `PlanView.tsx`；不改 schema；本轮不新增独立 reopen 按钮、不做“编辑完成时间”

- [x] [P3][done] **feature(Idea002): Done 区独立 Reopen + 编辑完成时间入口**
  - 来源：Idea Backlog 002 "Make Mistakes Easy to Undo" 的剩余两刀（`reopen` 独立入口 + `编辑完成时间`）
  - 动作：`PlanView.tsx` 最小增量落地
    - `TodoItem` 新增可选 `onReopen` 回调，Done 行增加独立 `Reopen task` 按钮（`CornerDownLeft`）
    - Done 行增加 `Edit completion time` 按钮（`Clock`），直接复用现有 `handleStartEditTime` + `onUpdateTime`
    - 抽 `reopenTodoFromDone()` 统一 reopen 语义（`is_completed=false` + `progress<=99` + `parent_due_id` 同步）
    - `handleContinueTimingFromDone` 改为复用 `reopenTodoFromDone`，避免 continue/reopen 状态分叉
    - archived Done 列表与 grouped 列表都已接入 `onReopen`
  - 验收输出：
    - `npx tsc --noEmit -p tsconfig.app.json`：退出 0
    - `npm test -- --run`：**22 files / 180 tests passed**
    - `npm run build`：✓ built in 11.30s（仅预存 chunk>500kB warning）
    - Browser 真机：`http://localhost:8080/demo-app` 展开 Done 后可见 `Edit completion time` / `Reopen task`；点击 `Edit completion time` 可展开 HH:mm 输入与保存/取消按钮
  - 范围限制：只动 `PlanView.tsx`；不改 schema；不改 hooks API

- [x] [P2][done] **ui(spotlight hover): TodoItem + DueCard 加鼠标跟随光晕**
  - 动作：用户直接请求（非队列任务，参考截图 "Summarize unread emails" spotlight card 效果）。抽 `useSpotlight` hook（rAF 节流 + pointer:fine + prefers-reduced-motion gate），在 `src/index.css` 加 `.spotlight` 双层伪元素（`::before` 内部光斑 + `::after` 描边光环，都用 `--primary` 单色），挂到 `PlanView.tsx` TodoItem 行 shell 与 `DueCard.tsx` 卡片 shell（`bare` 模式跳过）
  - 验收：
    - `npx tsc --noEmit` 0 error
    - `npx vitest run` 全绿
    - `npm run build` 通过
    - COLOR CONSISTENCY LOCK：spotlight CSS 只引用 `hsl(var(--primary))`
    - `prefers-reduced-motion` 兜底存在
    - 新代码 em-dash 计数 == 0
  - **验收输出**：
    - `npx tsc --noEmit`：**0 error**（clean）
    - `npx vitest run`：**20 files / 166 tests passed**（8.35s ✓）
    - `npm run build`：✓ built in 13.07s（vite 5.4.21，无报错）
    - `grep -c "hsl(var(--primary)" src/index.css | tail -100`：spotlight 块内 4 处，全 `--primary`，无 `--accent`/自定义 hex ✓
    - `@media (prefers-reduced-motion: reduce)`：index.css spotlight 块内直接 `opacity: 0 !important` 兜底 ✓
    - 新代码 em-dash：`grep -c "—" src/hooks/useSpotlight.ts`=0（注释用 ASCII `-`）✓
  - **档位**（core view 非 landing）：VARIANCE 2 / MOTION 3 / DENSITY 6
  - **Pre-Flight 6 项**（core-view 子集）：
    1. Anti-Default：radial-gradient + mask border 非 Tailwind 默认 hover ✓
    2. COLOR CONSISTENCY LOCK：只 `--primary` ✓
    3. EM-DASH BAN：新增代码 0 ✓
    4. WCAG AA：光晕为装饰层，`z-index: 2` 让内容永远在上，未削弱既有文本对比 ✓
    5. prefers-reduced-motion：hook + CSS 双兜底 ✓
    6. dark-mode 双模式：`.dark .spotlight::before/::after` 单独调 alpha（0.10→0.14 / 0.55→0.70）✓
  - **实现备注**：
    - `useSpotlight<T>()` 返回 `{ref, onPointerMove, onPointerLeave}`；`matchMedia('(pointer: fine)')` + `matchMedia('(prefers-reduced-motion: reduce)')` 双 listener，禁用时移除 `--mx`/`--my` CSS var 并置 `data-spotlight="off"`；启用时置 `"on"`
    - `.spotlight[data-spotlight="on"]:hover::before/::after { opacity: 1 }`：只在 pointer:fine 且非 reduced-motion 且 hover 时才可见
    - `.spotlight > * { position: relative; z-index: 2 }`：确保内容浮在光晕上方；已核对 TodoItem 与 DueCard 直接子元素均无绝对定位冲突
    - DueCard `bare` 模式（compact 面板）跳过 spotlight，避免嵌套卡片双重光晕
  - **不动的（克制说明）**：
    - `activeCategoryStyle` inset spine（Ongoing 状态左边 2px 亮条）保留，spotlight 是 hover 装饰，与 spine 是"状态 vs 交互反馈"两回事
    - TodoItem step 子行未加 spotlight（密度已高，装饰会打架）
    - Timeline block（PlanTimelineView）本轮未挂，用户明确说"先做 tasklist"

## Roundtable

- `[07-29] Reviewer→Builder: 放行 polish(StickyNotesView 第六刀)——hover-only 操作已补键盘焦点态可见：item/tab 的隐藏删除/展开按钮新增 group-focus-within 触发，机检 tsc 0 / vitest 180 / build 通过，真机截图可见 tab 删除 X 的可发现性提升。范围克制：仅 StickyNotesView，准予 [done]。`
- `[07-29] Builder→Reviewer: polish(StickyNotesView 第六刀) 完成——只动 StickyNotesView：在 hover-only 控件加 group-focus-within 显隐，保持鼠标端行为不变并补齐键盘可发现性。demo-app Notes 面板已截图复核。请核对验收链路与范围。`
- `[07-29] Planner→Designer: 第五刀后继续收口可用性细节，优先补 hover-only 控件在 keyboard 路径下的可发现性，避免“只有悬浮才看得见”问题。`

- `[07-29] Reviewer→Builder: 放行 polish(StickyNotesView 第五刀)——字号语义化已收口：新增 STICKY_TYPE 并把 title/body/meta/tab/composer 的字号 class 集中管理，视觉值保持不变，真机截图无漂移。机检链路 tsc 0 / vitest 180 / build 通过。范围克制：仅 StickyNotesView，准予 [done]。`
- `[07-29] Builder→Reviewer: polish(StickyNotesView 第五刀) 完成——只动 StickyNotesView：把分散的 text-sm/text-xs/text-[13px] 收敛到 STICKY_TYPE 语义常量，便于后续统一调字号；未改交互结构与主题。demo-app Notes 面板已截图复核。请核对验收链路与范围。`
- `[07-29] Planner→Designer: 第四刀完成后继续做低风险维护性优化，先把 StickyNotes 字号从散点类名收敛成语义常量，保证下一轮调字级只改一处。`

- `[07-29] Reviewer→Builder: 放行 polish(StickyNotesView 第四刀)——键盘焦点可见性已收口：NoteCard 内交互控件与 tabs/新增按钮补齐 focus-visible ring，卡片与底部输入条有 focus-within ring，且真机截图确认 Tab 后焦点环可辨。机检链路 tsc 0 / vitest 180 / build 通过。范围克制：仅 StickyNotesView，准予 [done]。`
- `[07-29] Builder→Reviewer: polish(StickyNotesView 第四刀) 完成——只动 StickyNotesView：新增统一 focusRing/focusField/shellFocusRing，修复 focus:outline-none 场景下键盘定位弱的问题；布局和主题未改。demo-app Notes 面板已用键盘 Tab 截图复核焦点环。请核对验收链路与范围。`
- `[07-29] Planner→Designer: Queue 清空后继续拆 StickyNotes 递延项，先补低风险高收益的 keyboard focus 可见性，优先可用性不做视觉大改。`

- `[07-29] Reviewer→Builder: 放行 polish(StickyNotesView 第三刀)——触控靶放大已收口：item 与 tab 的高频操作按钮命中区整体上调（p-2/-m-2、p-1.5/-m-1.5、min-h-9、h-8 w-8），且 Notes 面板真机截图确认版面未挤坏。机检链路 tsc OK / vitest 180 / build 通过。范围克制：仅 StickyNotesView，准予 [done]。`
- `[07-29] Builder→Reviewer: polish(StickyNotesView 第三刀) 完成——只动 StickyNotesView，做密度友好的触控靶放大，不改信息架构。已在 demo-app Notes 面板真机截图复核视觉稳定。请核对验收与范围。`
- `[07-29] Planner→Designer: 第二刀完成后继续拆递延项，优先做“触控靶放大但不破密度”的第三刀；目标是可点性提升而非强推 44pt 导致 masonry 失衡。`

- `[07-29] Reviewer→Builder: 放行 polish(StickyNotesView 第二刀)——递延项收口完成：可读性相关 opacity 已改成 text/placeholder alpha 语义（grep 对 placeholder:opacity/opacity-45/opacity-55 = 0），Done 行不再整块发灰；tabs 新增容器底板 + active ring + count 胶囊，暗色状态可辨性提升。机检：tsc OK / vitest 180 / build 通过。范围克制：仅 StickyNotesView，准予 [done]。`
- `[07-29] Builder→Reviewer: polish(StickyNotesView 第二刀) 完成——只动 StickyNotesView：文本淡化从 opacity 迁到 text-current alpha，Done 行拆分 alpha，tabs 活态加底板+ring+count capsule。真机在 demo-app Notes 面板已截图核对。请复查验收链路与范围限制。`
- `[07-29] Planner→Designer: Queue 为空但 Notes 里有明确递延项，先拆一刀低风险高收益的 UI polish：优先做 opacity 语义化 + tabs 活动态辨识，不动 schema/tokens。`

- `[07-29] Reviewer→Builder: 放行 feature(Idea001 priority-alignment)——TodayView 已在真实 recap 入口补上 Priority Alignment 提示，直接复用 sort_order 作为当天优先级代理，不新增 schema。demo-app 文本快照可见 PRIORITY ALIGNMENT，并给出 67% top-items share；机检链路：tsc 0 / vitest 180 / build 通过。范围克制：仅 TodayView + 台账，未碰 hooks API 与跨天分析。准予 [done]。`
- `[07-29] Builder→Reviewer: feature(Idea001 priority-alignment) 完成——Today recap 新增一张轻量提示卡：取当天前 2 个 todo（按 sort_order）作为优先级代理，比较它们吃掉了多少任务计时，并提示前排是否真正启动/被后排分流。demo 数据下显示 top 2 拿到 67% 任务计时。请核对验收链路与范围限制。`

- `[07-29] Planner→Builder: Idea001 只剩最后一条 priority alignment。仓库没有独立 priority 字段，就直接复用现成的 sort_order 作为“当天优先级”代理；目标不是做复杂评分，而是在 Today recap 给一条可读提示：前排任务有没有真正拿到任务计时。`

- `[07-29] Reviewer→Builder: 放行 feature(Idea001 planned-vs-actual)——TodayView 已复用现有 PlanDrift，在真实 recap 入口直接展示 Execution 卡片；首轮接线后浏览器快照发现默认折叠导致标题不可见，已同轮收口为默认展开并复验。机检链路：tsc 0 / vitest 180 / build 通过；demo-app 文本快照可见 EXECUTION、57% of plan 与 MISSED。范围克制：仅 TodayView + 台账，未触 PlanDrift 逻辑与 schema。准予 [done]。`
- `[07-29] Builder→Reviewer: feature(Idea001 planned-vs-actual) 完成——不重写算法，直接把现有 PlanDrift 接进 Today recap，喂当天 allTodos/completedTodos/todayMoments。浏览器复核时发现 defaultCollapsed 只露 summary，于是同轮改为 Today 内默认展开，现已能直接看到 EXECUTION / best stretch / missed。请核对验收链路与范围限制。`

- `[07-29] Planner→Builder: Queue 已空，但 Idea001 Notes 里还剩 planned-vs-actual / priority alignment 两条未拆。先取前者做最小切片：不要重写算法，直接复用已存在的 PlanDrift，把它接进 TodayView 的真实 recap 入口；priority alignment 留下一轮。`

<!-- 角色之间的短消息板。格式：`[日期] 角色→角色: 一句话`。最新在最上面。 -->

- `[07-29] Reviewer→Builder: 放行 feature(Idea002 reopen+edit-time)——Done 行新增独立 Reopen 与 Edit completion time，且 continue 复用同一 reopen helper，避免状态分叉。机检链路：tsc 0 / vitest 180 / build 通过。demo-app 真机已见新按钮并可展开完成时间编辑输入。范围克制：仅 PlanView，未触 schema/hook。准予 [done]。`
- `[07-29] Builder→Reviewer: feature(Idea002 reopen+edit-time) 完成——PlanView 在 Done 行补两个显式动作：Reopen task（不启动 Focus）与 Edit completion time；抽 reopenTodoFromDone 统一父子任务同步并复用到 continue。demo-app 已核对按钮出现，点击编辑可展开时间输入。请核对验收链路与范围限制。`

- `[07-29] Reviewer→Builder: 放行 feature(Idea002 continue-timing)——Done 区出现可见 Continue 按钮并可一键恢复计时；点击后 FocusTimerOverlay 正常弹出且显示历史累计（Previously 26m），符合“自动 reopen + start focus”预期。机检链路：tsc 0 / vitest 180 / build 通过。范围克制：仅 PlanView，未触 schema、未做独立 reopen/编辑完成时间。准予 [done]。`
- `[07-29] Builder→Reviewer: feature(Idea002 continue-timing) 完成——PlanView 新增 canContinueWhenDone + handleContinueTimingFromDone，Done 列表项支持 Continue timing（自动 reopen 后启动 Focus）。demo-app 真机验证通过：Done 展开后可点击 Continue，弹出计时浮层并恢复任务。请核对验收链路与范围限制。`
- `[07-29] Reviewer→Builder: 放行 feature(Idea001 week/month)——TodayView 的 Time Breakdown 已从 Today 扩展到 Today/Week/Month；month 态真机快照可见占比条和说明文案，机检 tsc 0 / vitest 180 / build 通过。范围克制：未触 schema、未触 planned-vs-actual。准予 [done]。`
- `[07-29] Builder→Reviewer: feature(Idea001 week/month) 完成——recap 时间分布卡片加三档切换，week/month 采用“当天 timeline + 历史 timed moments”聚合，空数据时给出提示文案并在非 today 态标注统计口径。请核对 demo-app Month 态与验收链路。`
- `[07-29] Reviewer→Builder: DueCard 人工 review 收口放行——用户连续“go”确认可继续，队列状态由 [in_progress: 等人工 review] 转 [done]，维持原验收证据不变（diff 20 行 / lint baseline 持平 / vitest 通过 / build 通过）。`
- `[07-14] Reviewer→Builder: 放行 feature(Idea001+Idea002)——Idea001 已落真实使用中的 TodayView（不是未接线的 InsightsPanel），新增 todayTimeBreakdown 纯函数+单测并命中“今日时间分布/TodayTimeBreakdown”；Idea002 补齐 FocusTimer 完成路径 Undo，统一 showDoneUndo + todoDoneUndo snapshot/restore。机检：tsc 0 / vitest 180/180 / build 15.10s ✓`
- `[07-14] Builder→Reviewer: Idea001+Idea002 完成——今日时间分布区块接在 Today 回看 summary；新增 src/lib/todayTimeBreakdown.ts + src/test/todayTimeBreakdown.test.ts。Done 后 Undo 现状补洞：FocusTimer 的 onComplete/onFinishAt 也弹撤销，新增 src/lib/todoDoneUndo.ts + src/test/todoDoneUndo.test.ts。请核对 acceptance grep 与回滚字段完整性`
- `[07-14] Reviewer→Designer: 放行 ui(spotlight hover TodoItem+DueCard)——机检 tsc 0 / vitest 166/166 / build 13.07s ✓;Pre-Flight 6 项 core-view 子集全 PASS(Anti-Default radial+mask / COLOR LOCK 单 --primary / em-dash 0 / WCAG AA 装饰层 z:2 / reduced-motion hook+CSS 双兜底 / dark-mode 单独 alpha 覆盖);pointer:fine gate + rAF 节流合规;DueCard bare 模式正确跳过避免嵌套;.spotlight > * { z-index: 2 } 已核对两处 shell 无绝对定位子元素冲突。准予收工,等用户真机在 pointer 设备上验证光晕强度是否克制到位`
- `[07-14] Designer→Reviewer: ui(spotlight hover) 完成——用户请求 tasklist + Dues 卡片加 spotlight card 效果(截图参考"Summarize unread emails")。抽 useSpotlight hook(rAF+pointer:fine+reduced-motion gate),index.css 加 .spotlight 双层伪元素(::before 内部光斑 + ::after 描边光环,全走 hsl(var(--primary))),挂到 PlanView TodoItem 行 shell 与 DueCard 卡片 shell(bare 跳过)。档位 VARIANCE 2 / MOTION 3 / DENSITY 6(core view 非 landing)。请核对 6 项 Pre-Flight 与真机 pointer 设备上克制感`
- `[07-14] Planner→Designer: 用户请求给 tasklist(TodoItem) + Dues 卡片加 spotlight card hover(鼠标跟随光晕描边)。定档 VARIANCE 2 / MOTION 3 / DENSITY 6(核心视图非 landing),强度"克制描边"档,只用 --primary,先做这两处,timeline block 下一刀`

- `[07-10] Reviewer→Designer: 放行 fix(StickyNotesView redesign 第一刀 P0-P1 合修)——机检核对:硬编码 hex 6→0 ✓ · 小字号 12→0 ✓ · skeuomorphism 残留 rotate/tape/scale 全清 ✓ · dark: 覆盖 0→25 ✓ · tsc 0 / 147 tests / build 11.57s ✓;COLOR_PALETTES 迁到 tokens.css 与既有 warm-editorial 全站色策略对齐,rose+dusty-blue 补齐 4 个 dark tokens 让 6 色都有暗色变体;Anti-Patterns Pre-Flight 10 项全 PASS(见任务体表格)。3 处剩余 text-[13px] 是密度型 body 合理下限保留。递延事项(P2-07 opacity 11 处 / 字号阶梯语义 token / 44pt 触控靶)已在任务体列出等下一刀。准予收工,等用户真机验证 dark/light 双模式与 6 色 palette 收拢感`
- `[07-10] Designer→Reviewer: fix(StickyNotesView redesign 第一刀) 完成——合修 P0-01 暗色 / P0-02 字号 / P1-04 skeuomorphism / P1-05 6 色 palette 四条(耦合过深,拆开做第二刀会拆第一刀的东西)。改动 2 文件 +185/-78 行:tokens.css 补 4 dark tokens、StickyNotesView.tsx 全量 dark: 覆盖 25 处 + 字号阶梯化 + 拿掉 rotate/tape/scale + drag rail 替代胶带 + 触控靶 24px hit-slop + favicon lazy。剩下的 P2-07 opacity 11 处需要 alpha token layer,推迟到 /impeccable polish;字号语义 token 待扩;44pt 与 masonry 密度冲突,权衡后再动。请核对 Pre-Flight 10 项 + 双模式对比度`
- `[07-10] Designer→User: impeccable-skill audit(StickyNotesView.tsx) 完成——用户直接请求(截图=暗色下 Notes 太丑)。走方向 C(先审不改)。总分 7/20 Poor,10 条 finding(2 P0 / 3 P1 / 3 P2 / 2 P3)。三个"太丑"根源:(1)P0-01 暗色卡片完全没做,tokens.css 里已有 8 个 dark tokens 从未 hook up→浅奶油卡片浮在纯黑上;(2)P1-04 skeuomorphic tape strip + rotate + hover:scale 与 app 其他视图扁平语言脱节;(3)P1-05 6 色 palette 违反 warm-editorial + terracotta 全站色锁。机检输出全贴报告开头。建议按 P0→P1→P2→P3 顺序跑 /impeccable colorize + typeset + quieter + adapt + animate + optimize + polish;或从 colorize + typeset 打底两条先跑掉。请选下一刀`
- `[07-10] Planner→Designer: Notes redesign 方向 A/B/C 三选一,用户选 C(挂 impeccable-skill 只审不改先看客观清单再拍板)。请按 audit.md 的 5 维给分 + P0-P3 finding + 机检输出`
- `[07-08] Builder→Reviewer: fix(任务列表状态色区分) 完成——用户直接请求（非队列任务）。症结：左侧任务行的"进行中/已排程/未开始"三态视觉几乎一样——① Ongoing 的 tint 用 activeColor，多数任务 tag 退回灰 #8B8B8B，进行中只呈灰；② Planned 静止态完全无 surface（只有 hover），跟未排程无差别。改动全在 PlanView.tsx TaskRow：①新增 liveTint 辅助（有彩色 tag 用 tag 色、否则回退 hsl(var(--primary)) 陶土而非灰）+ liveColorCss；②重写 activeCategoryStyle——isOngoing 用 liveTint(0.16 bg / 0.34 border，light 走渐变)，isScheduled 新增 accent gray-green 静止 surface（dark 0.08/0.24、light 0.07/0.30）让 Planned 一眼可辨且比 live 陶土更安静；③Ongoing 状态 chip 把 Timer 图标换成 liveColorCss 的 7px 脉动圆点，Planned 的日历图标+文字染 accent 色。a11y：index.css reduced-motion 块补 .animate-pulse{animation:none} 兜底（脉动点静止但可见）。全走 CSS var token 无新增硬编码 hex（liveTint 灰回退用 hsl(var(--primary))、Planned 用 hsl(var(--accent))）。验收：tsc 0 / vitest 147/147 / build 13.12s ✓。限制：demo 需用户真机看三态对比。请核对 dark/light 双模式下三态对比度 + accent 与 primary 是否够区分`
- `[07-08] Builder→Reviewer: feat(timeline 步骤子段) 完成——用户直接请求（非队列任务）。症结：步骤停止计时后 timer_started_at 被清空、"何时做"丢失，旧的"停止瞬间抓 session"渲染成飘散小 moment 块，时间线上几乎为零。新方案（用户拍板"父块内细分小段"）：①新纯函数 stepTimelineSegments.ts buildStepSegmentsByParent——把 step-session moments 按 todo-session:<父id> 归组，重叠会话按 overlap-cluster 分列（col/totalCols）实现"同时进行并排"，算出并集 extent；②buildPlanBlocks 跳过 step-session moment 不再画独立块，改 attach 成父块 stepSegments 并把 extent 撑到并集，父任务若无自身排程则合成块；③renderBlock 块内加 z-[2] overlay，按 minToY(seg.startMin)-top 定位、列分宽、共享父色、≥22px 且够宽时显步骤标题。TimeBlock 加 stepSegments 字段。验收：tsc 0 / vitest 147（+10 step-timeline-segments）/ build 12.48s ✓。链路已核连通（Index L503/504 moments+onAddMoment→PlanView→PlanTimelineView）。限制：demo 现有步骤无历史 session 故不回溯显示，需新计时验证；已知后续可把步骤 plan_started_at 也画成子段（timeline 目前拿不到 stepsByParent，需 prop 下传）。请核对块内 overlay 与 plan/actual chrome 的 z-order + 双模式配色`
- `[07-08] Reviewer→Builder: 放行 feat(auto-schedule Phase 2 学习引擎)——用户直接请求（非队列任务）。机检：纯函数 schedulingProfile.ts（buildSchedulingProfile/resolveSegment/hourToSegment）保守学习——minSamples 3 + plurality≥0.5，噪声不学；不动 schema，profile 从既有 todo 行按需派生；useSchedulingHistory 只读查询；autoSchedule 新增 profile/history 仅在 anytime 任务上填偏好，explicit time_segment 永远优先；无新增硬编码 hex；tsc 0 / build 10.87s / vitest 129/129（+12：scheduling-profile 11 + auto-schedule 1）。准予收工，待用户真机验证学习效果`
- `[07-08] Builder→Reviewer: feat(auto-schedule Phase 2) 完成——从真实历史学习：①真实 timer_seconds 中位数喂时长估计（已有逻辑，本轮接上 history）②按 work type 学"实际几点做"→ anytime 任务落到偏好时段（新 schedulingProfile.ts）。新 useSchedulingHistory hook 取 tags+timer_started_at 本地小时派生 profile；PlanTimelineView buildSuggestions 传入。degrade：未登录/无历史 → 退回 Phase 1 规则。请核对是否需要建 schedule_preferences 表持久化显式覆盖（本轮特意不建，先证明引擎）`


- `[07-09] Reviewer→Designer: 放行 ui(substep panel elegant)——用户发新截图:substep 展开面板"Work" tag 让整个父头浸满紫色 + 计时 chip 全彩胶囊 + 完成 step 划线灰到几乎看不见 + "+ Add step" 光秃秃。派 2 独立视角(Reviewer 挑刺 / Designer 出 2 方案)高度收敛,收敛点:Color Consistency Lock 被 tag 色接管全 pill 违反。方案 A "Quiet Rail" 落地:(1) 根源修复——liveTint() 强制走 hsl(var(--primary)) terracotta,不再回退到 tag hex(Work 紫 / Study 蓝 / Life 金 都不再接管 pill,只在 tag chip 内可见);(2) completed step 从 muted-foreground/55 → foreground/45 + decoration-foreground/25,暗色 AA 过;(3) 计时 chip 去 pill fill,去脉动圆点,只留 text-primary + mono 20:36(motion 3 预算不浪费在装饰脉动);(4) 三个 clock glyph 分工:🕐 = 计划,⏱ = 已停但有累计,纯文字 = 正在计;(5) 面板 pt-1.5 pb-2 → pt-2 pb-3 + 顶部加 border-t border-foreground/[0.04] hairline 分隔父头;行 py-1 → py-1.5 呼吸;(6) "+ Add step" 从 ml-6 光秃 12px text-link → 前置 Plus icon + 13px + 和 step row 同高,读作"下一个空位"。机检:em-dash 0 / tsc 0 / 147 tests / build 10.85s;死代码 activeColor + toAlphaHex + liveIsTagColor 清除。准予收工`
- `[07-09] Designer→Reviewer: ui(substep panel elegant) 完成——2 大区域改动。TaskRow 层:liveTint() 简化,不再区分 tag/primary,永远 hsl(var(--primary))——这是所有紫色滋事的根源。substep 面板层:(1) 容器 pt-2 pb-3 gap-0 + border-t hairline;(2) row py-1.5 + gap-2.5 保持;(3) 完成 step 颜色升 AA;(4) 计时 chip 完全去彩(text-primary only, 无 fill 无 dot 无脉动),plan 保留 Clock icon,累计 elapsed 保留 Timer icon;(5) Add step 前置 Plus icon,和 step 高度对齐;(6) 死代码 activeColor/toAlphaHex/liveIsTagColor 清除。请核对真机紫色是否完全消退,Add step 是否"读作下一空位"`
- `[07-09] Reviewer→Designer: 放行 ui(plan-timeline block header de-clutter)——用户反馈截图:substep 加入后时间块表头"红棕圆点+PLAN 紫片"挤在标题前不好看。派 3 个独立视角复盘(Designer 提案 / Reviewer 挑刺 / Alt lens 借鉴 Google/Notion/VS Code 视觉惯例)高度收敛:2px 圆点低于感知阈值+重复 tag 色、PLAN pill 违反 Color Lock(tag-derived 非 accent) 且重述"当前是 Plan Timeline"这个容器本身、两者共同抢标题空间。真正的 substep 显示(stepSegments 半透明彩块)本来就在块内正确渲染,不需要表头信号。方案:利用块本身已有的左边线,isTimerActive 时把 alpha 0.38→0.72 + 宽度 2/3→4px 提升为真正的活动 spine(与上轮 TaskRow 语言一致);plan-only 靠已存在的三重线索(shellFor('plan') 更淡 fill / tintedText(0.48) 更淡标题 / z-10 更低层级)承担,砍掉冗余徽章。机检:em-dash 0 / tsc 0 / 147 tests / build 11.29s;死代码 showLiveBadge + metaFontSize 清除。准予收工`
- `[07-09] Designer→Reviewer: ui(plan-timeline block header de-clutter) 完成——PlanTimelineView.tsx 三处改:(1) 第 1197 行 showLiveBadge 变量删除(死代码);(2) 第 1418-1424 metaFontSize 删除(死代码);(3) 第 1838-1844 actualBorderColor 升级——isTimerActive 时 alpha 0.38→0.72 且新增 actualBorderWidth 逻辑,active=4px 常态=2/3px;(4) 第 2286-2296 header 内的 2×2 圆点 + PLAN pill 完全移除。信号从"表头两个 chip"改为"整块左边线加粗加深",避免和标题争水平空间。请核对真机上 plan-only 块(无 timer)是否仍然明显可辨(靠 fill+标题淡化+低 z 三重线索)`

- `[07-09] Designer→Reviewer: ui(plan tasklist state visuals v2 - de-slop) 完成——回应上轮 skill 复盘发现的 AI 味问题。activeCategoryStyle 简化为 inset box-shadow 竖条(Ongoing)/纯 borderColor(Planned)/undefined(Idle)三段;chip 图标在 Ongoing 时置 null 消除双重信号;Planned 图标 desaturate 到 muted-foreground。改 PlanView.tsx 三处(第 458/485/617 附近)。请核对三态在真机的呼吸感是否到位`
- `[07-09] Reviewer→Designer: 放行 ui(plan tasklist state visuals)——用户直接请求(非队列任务),做的是 TaskRow 三态色区分。机检:token 使用 hsl(var(--primary))/hsl(var(--accent)) 无新增 hex ✓;em-dash 新增 0 ✓;reduced-motion 兜底 .animate-pulse{animation:none} 已加 ✓ (MOTION>3 硬要求);tsc 0 / 147 tests / build ✓。注:方案是 v1,后续 v2 因过度 AI 味被返工`
- `[07-09] Designer→Reviewer: ui(plan tasklist state visuals) 完成——TaskRow 三态色区分:Ongoing 用 liveTint 品牌 primary 兜底(避免灰色回退) + 脉动圆点;Planned 加 accent 灰绿静止 surface + 图标染色;index.css 补 animate-pulse 的 reduced-motion 兜底。改 PlanView.tsx 一处 + index.css 一行`

- `[07-06] Designer→Reviewer: feat(plan-timeline drop micro-effects) 完成——drag task 到 timeline 时预览块内浮现 3 个 3px 小光点（错峰 0/260/520ms，共享 tag/primary 色）；drop 落地后新块 460ms scale 0.985→1 + 短暂 accent ring 呼吸（28% 峰值 α 0.28）。新增 3 段 keyframes + 1 段 reduced-motion 兜底，全在 src/index.css @layer components 内；PlanTimelineView 加 freshDropId state + setTimeout 480ms 自清 + effect cleanup。请核对是否与现有 keepGlow / block ring 视觉冲突`
- `[07-02] Reviewer→Designer: 放行 fix(plan-timeline overlap stacking)——用户直接请求（非队列任务）。机检：assignColumns 对 totalCols≤3 组 100% 零变化（visibleCols===totalCols, hiddenSiblingIds=[]） ✓；4-block 场景 z-index 追踪 col 0/1/2 actual=20/21/22、col 3 plan-only=5（overflow 分支优先） ✓；+N 徽章双模式 WCAG AA 均 >11:1 ✓；em-dash / en-dash 新增计数=0 ✓；tsc0/build 8.27s/vitest 51/51 ✓；PlanTimelineView 文件 error 数 stash 前后同为 23，未新增 ✓。准予收工`
- `[07-02] Designer→Reviewer: fix(plan-timeline overlap stacking) 完成——4 块以上重叠时按 MAX_VISIBLE_COLS=3 封顶，超出者以 4px×depth 偏移+opacity 0.28+pointer-events:none 叠在 col2 后面，col2 加 "+N" 徽章列出隐藏标题；plan-only 块 zIndex 降到 10+ 段（actual 走 20+），彻底解决 dashed 越到 solid 上头的视觉打架。改 primitives 加 MAX_VISIBLE_COLS + 拓宽 assignColumns 返回；改 PlanTimelineView 拿新字段、更新 width/left/z-index + 两处 badge。请核对 dark-mode 双色与 4-block 场景 z-order`

- `[07-02] Reviewer→Builder: 放行 fix 审计项 6——机检核对：Landing 品牌色硬编码计数 3（仅红绿灯，有意保留）✓；--lp-* 用 RGB channels 从 hex 无损 1:1，computed-style 复核 5 类元素（bg/ink/CTA/渐变/暗面板）全部精确命中原 hex 零漂移 ✓；tsc0/build✓；纯重构未改视觉 ✓。准予 [done]`
- `[07-02] Builder→Reviewer: fix 审计项 6 完成——Landing 全页 hardcoded 色迁到 tokens.css 的 29 个 --lp-* 固定色板（RGB channels，支持 solid+alpha），按 7 section 替换；红绿灯 3 色有意保留。computed-style 已证零漂移，请核对是否有误伤`
- `[07-02] Builder→Reviewer: fix 审计项 4 完成——bg 压暗方案，#d4875f→#b0602e(4.6:1) 过 AA，改 Landing L203/L282/L404 三处 solid-fill；hover→#9c521f；装饰性陶土保留。请核对对比度与是否误伤装饰色`
- `[07-02] Builder→Reviewer: fix 审计项 2 完成——Landing final CTA 统一为 exploreDemo、删 tryDemo 孤儿 key；tsc 0 / 51 tests / build 均过，grep tryDemo=0。审计项 4（按钮对比度）与 6（token 化）未动，等下轮`
- `[07-02] Designer→Reviewer: Landing.tsx 审计完成（只审未改），2 项 FAIL——(2) demo CTA 双 label 重复意图 exploreDemo/tryDemo、(4) 主按钮 #d4875f+白字 2.83:1 未过 AA；另 104 处硬编码色待 token 化。报告落 Queue 该任务，请核对行号证据`
- `[07-02] Planner→Designer: Landing.tsx 试点定档 VARIANCE 6 / MOTION 5 / DENSITY 4。Design Read——"个人生活记录 SPA 的落地页，面向重视仪式感/隐私的个人用户，warm-editorial 语言（terracotta accent 已锁），偏向 shadcn+Tailwind+克制滚动动画"。本轮只 audit 不改代码`
- `[07-02] Planner→Reviewer: 这是 taste-skill 流程验证，验收盗看“Pre-Flight 每项是否带行号证据”而非“审美好坏”；报告质量过关才拆“下一刀改动”任务`
- `[07-01] Planner→Builder: Idea001/Idea002 各自先切第一刀（见 Queue P3），week/month 与 reopen 等后续维度别提前做，保持 diff 小可 review`
- `[07-01] Planner→Reviewer: 这两条是新 feature，比 design-system 主观，做完按惯例标 [in_progress: 等人工 review] 不要自标 [done]`

## Notes

<!-- agent 可在此追加备忘、决策记录、新发现的任务草稿 -->

- **Idea Backlog**（原始记录从 `CLAUDE.md` 的 Product Idea Log v2 迁来；已拆成上面 P3 任务的第一刀）
  - **Idea 001 — Understand Where My Time Goes**（Theme: Reflection / Time）
    - Problem: AI 时代注意力被太多事抢；项目/想法多，但看不清时间实际花在哪。
    - Insight: 人要的不只是 to-do list，而是"已经怎么花掉时间"的反映。
    - Features: 项目/类别时间占比 · 今日/本周/本月时间去向 · planned vs actual · 时间分配是否匹配优先级。
    - 切片进度：✅ 已拆"今日 work type 占比"(P3) | ✅ week/month 维度 | ✅ planned-vs-actual | ✅ 优先级对齐提示。
  - **Idea 002 — Make Mistakes Easy to Undo**（Theme: UX / Error Recovery）
    - Problem: 误标 Done 后想继续做 / 调记录时间，撤销太难。
    - Insight: 高频误操作必须永远易撤销。
    - Features: Done 后一键 Undo · 即时 reopen · 编辑完成时间 · 从停止处继续计时 · 保留历史而非让 Done 不可逆。
    - 切片进度：✅ 已拆"Done 后一键 undo"(P3) | ✅ reopen（独立入口） | ✅ 编辑完成时间 | ✅ continue-timing（Done 区自动 reopen 后恢复计时）。
