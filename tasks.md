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

- [ ] [P3][todo] **feature(Idea001): "时间都去哪了" 第一刀——按 work type 聚合今日已记录时长**
  - 来源：Idea Backlog 001 "Understand Where My Time Goes"。**只做今日维度**，week/month / planned-vs-actual / 优先级对齐都是后续切片，本轮不碰
  - 动作：在 `src/components/InsightsPanel.tsx`（或拆一个 `TodayTimeBreakdown` 子组件）加"今日时间分布"区块；用 `useMoments` 取今天的 moments，经 `src/lib/workType.ts` 归类，聚合成 `{ type, minutes, pct }`，渲染成横条占比（颜色走 `src/lib/activityColors.ts` / token，不硬编码 hex）
  - 验收：
    - `npm run build` 通过
    - `npx tsc --noEmit -p tsconfig.app.json` 退出 0
    - `npx vitest run` 全绿（新增一个聚合函数的单测）
    - `grep -rn "今日时间分布\|TodayTimeBreakdown" src/` 命中新代码
  - 范围限制：**只读已有数据**，不动 supabase schema / migrations；不顺手做 week/month

- [ ] [P3][todo] **feature(Idea002): 标记 Done 后一键 Undo**
  - 来源：Idea Backlog 002 "Make Mistakes Easy to Undo"。**只做 one-tap undo**，reopen / 编辑完成时间 / 从停止处继续计时都是后续切片，本轮不碰
  - 动作：在标记任务 Done 的入口接 `src/lib/undoToast.tsx`，弹 ~5s "撤销" toast；点撤销把状态回滚到 Done 之前。复用 `src/hooks/useTaskHistory.ts` 记录前态
  - 验收：
    - `npm run build` 通过
    - `npx tsc --noEmit -p tsconfig.app.json` 退出 0
    - `npx vitest run` 全绿（新增一个 undo 行为单测：mark done → undo → 状态复原）
    - `grep -rn "undoToast\|撤销" src/` 命中新接线
  - 范围限制：只接现有 done 流程，不改 schema；不做 continue-timing

## Roundtable

<!-- 角色之间的短消息板。格式：`[日期] 角色→角色: 一句话`。最新在最上面。 -->

- `[07-02] Reviewer→Builder: 放行 fix 审计项 4——机检核对：白字 vs #b0602e 实测 4.6:1≥AA 4.5 ✓；三处 solid-fill 全改（hero/tab/final），装饰陶土未误伤 ✓；accent 仍单色系锁定（#b0602e 是 #d4875f 的加深，同族）✓；tsc0/51tests/build 齐 ✓；自测截图白字清晰 ✓。准予 [done]`
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
    - 切片进度：✅ 已拆"今日 work type 占比"(P3) | ⬜ week/month 维度 | ⬜ planned-vs-actual | ⬜ 优先级对齐提示。
  - **Idea 002 — Make Mistakes Easy to Undo**（Theme: UX / Error Recovery）
    - Problem: 误标 Done 后想继续做 / 调记录时间，撤销太难。
    - Insight: 高频误操作必须永远易撤销。
    - Features: Done 后一键 Undo · 即时 reopen · 编辑完成时间 · 从停止处继续计时 · 保留历史而非让 Done 不可逆。
    - 切片进度：✅ 已拆"Done 后一键 undo"(P3) | ⬜ reopen | ⬜ 编辑完成时间 | ⬜ continue-timing。
