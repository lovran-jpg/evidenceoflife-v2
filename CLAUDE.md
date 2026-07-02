# CLAUDE.md — 交接班说明书

> 这是 agent 每轮启动必读的当前工作面板。**任务队列是 `tasks.md`**——本文件不重复任务，只讲项目骨架、硬约束、当前焦点与上轮交接。

---

## 项目一句话

Vite + React 18 + TypeScript + shadcn/ui + Tailwind + Supabase 的个人生活记录 SPA（Today / Recap / Dues / Map / Calendar / Year / Notes / Links）。单人开发，远端 `origin = github.com/Cyriellewu/evidenceoflife-v2`（private），本地优先。

## 目录地图

```
src/
  components/views/   顶层视图（Today, Map, Calendar, Dues, Habits, LifeCalendar, Links, StickyNotes, PlanTimeline, Plan, Profile）
  components/ui/      shadcn/ui 基件（Button, Dialog, Sheet ...）
  components/         功能组件（AddMoment, AppearanceEditor, SideNav, SmartChatbot ...）
  hooks/              数据 hooks（TanStack Query 包装 Supabase 调用）
  integrations/       Supabase client + 生成的类型
  lib/                纯工具
  pages/              路由入口
supabase/
  functions/          Deno edge functions（geo, smart-input, link-preview ...）
  migrations/         SQL + RLS policy
```

## 硬约束（违反即停）

- **`git push` 只能推到 `origin/main`**，由 `loop.sh` 自动负责；**绝不**用 `--force` / `--force-with-lease`
- **不准修改 `.env*`**（除 `.env.example`），不准把任何 `key|secret|token` 类内容写进 commit
- **不准 `rm -rf`**、不准动 `node_modules/`、不准动 `dist/`
- **不准操作仓库外文件**——所有 `Bash` 调用必须 `cd` 在 `C:\Users\t-youwu\repo\evidenceoflife-006dea11-main` 或其子目录
- **不准把 `.workbuddy/` 入库**（已 gitignore，是 inbox/草稿区）
- **不准在标记 `[done]` 前跳过验收**——验收命令的输出必须贴到 Last Handoff

## 当前焦点

>> 见 `tasks.md` 第一个未完成项（`[ ]` 且状态不是 `[blocked]` 的最上面那条）。
>> 产品想法的原始记录见 `tasks.md ## Notes` 的 **Idea Backlog**——已转成 P3 任务，不要再往本文件里堆想法。

如果队列空了：检查 `tasks.md ## Notes` 段看有没有待整理的备忘；都没有就报"队列空、收工"，不要自己造任务。

## 多 agent 协作模型

> 这个仓库不是"一个 agent 单打独斗"，而是**一组分工角色轮流上场、靠文件互相喊话**。
> `loop.sh` 每轮仍只起一个 Claude 进程——但这个进程要按任务性质**戴不同的帽子 / 派子 agent**，让各自的长处叠加，而不是一个角色硬扛全部。

### 角色（每个都有明确长处，别让一个角色干全部）

| 角色 | 长处 | 何时上场 | 怎么派 |
|------|------|----------|--------|
| **Planner 规划者** | 把"原始想法 / 过大任务"拆成机器可验收的小任务、定优先级 | 队列空、或捡到 idea / 任务过大时 | 主 agent 自己戴帽子，产出写进 `tasks.md ## Queue` |
| **Builder 实现者** | 写最小可用代码、跑验收 | 捡到非视觉类 `[todo]` | 主 agent 主线 |
| **Designer 设计者** | 视觉层级 / 间距 / token / 暗色把控 | 捡到 UI/UX 类 `[todo]` | `Skill(ui-ux-pro-max)` + `src/styles/tokens.css` |
| **Reviewer 评审者** | 对着验收条件 + 硬约束挑刺、拦回归、决定能否 `[done]` | Builder/Designer 标 `[done]` **之前** | 派 `Agent(subagent_type=Explore)` 只读复查 diff，或主 agent 自评一遍 |
| **Explorer 探路者** | 快速只读摸代码、回答"在哪 / 怎么连" | 探索性搜索（>3 个查询） | `Agent(subagent_type=Explore)` |

### 他们怎么互相喊话（通信协议）

三条**文件信道**，单进程轮流写，天然无竞态：

1. **`tasks.md ## Queue`** — 唯一队列。要做什么、什么状态。
2. **`tasks.md ## Roundtable`** — 角色之间的短消息板。格式 `[日期] 角色→角色: 一句话`。例：
   - `[07-01] Planner→Builder: Idea001 先只做今日维度，week/month 后续切`
   - `[07-01] Builder→Reviewer: DueCard diff 20 行，请核对触控间距`
   - `[07-01] Reviewer→Builder: 退回——hover:bg-destructive/8 非法值，改 /10`
3. **`CLAUDE.md ## Last Handoff`** — 跨轮接力棒（每轮一个写者，3 行：做了啥 / 卡在哪 / 下一步）。

> 铁律：**谁要标 `[done]`，谁先在 Roundtable 留一条 Reviewer 行**（自评或派子 agent 评）。没有 Reviewer 放行，不准 `[done]`。

### 一轮的编排（主 agent 心法）

1. 读 `CLAUDE.md` → `tasks.md`（Queue + Roundtable + Notes）。
2. 先看 Roundtable 有没有"退回 / 待回应"的消息——有就优先处理。
3. 捡第一条 `[todo]`，标 `[in_progress]`，按性质决定戴哪顶帽子（Builder / Designer）；方向不清就先当 Planner 拆。
4. 需要摸代码 → 派 Explorer；需要把关 → 派 Reviewer。
5. 跑验收 → Reviewer 放行 → 标 `[done]` → 更新 Last Handoff → 退出（exit 0）。`loop.sh` 负责 commit 与是否再起一轮。

### 怎样"叠加长处"而不是"互相踩"

- **一次一条任务、一个写者**：别让两个角色同时改同一文件。
- **拆 vs 做分离**：Planner 只产任务不写业务代码；Builder 不顺手扩大范围。
- **建字典 vs 替换调用点分两轮**（design-system 已验证的节奏），让每个 diff 单独可 review。
- **Reviewer 永远对着"硬约束 + 该任务验收条件"挑刺**，不凭感觉拍板。

### design-taste-frontend skill 的用法约定（试点中）

> skill 自声明只适用 landing / portfolio / redesign，**不适用** dashboard / 数据密集产品 UI。EOL 核心视图（Today/Timeline/Map/Calendar）属后者，**只取局部规则**，别照搬 landing 专属布局。

- **适用面分档**：
  - `Landing.tsx` / `PublicDemo.tsx` → 全套可用
  - `Profile` / 空状态 / 引导页 → 取排版+间距+anti-slop，降 VARIANCE
  - 核心视图 → **只取**：Anti-Default、COLOR CONSISTENCY LOCK、EM-DASH BAN、按钮/表单 WCAG AA 对比度、`prefers-reduced-motion`、dark-mode 双模式；忽略 Sticky-Stack / Horizontal-Pan / Hero 布局那些。
- **Planner 派 Designer 前必须在 Roundtable 定三档位**（不要用 skill 的 landing 默认值 8/6/4）：
  - Landing/公开页：`VARIANCE 6 / MOTION 5 / DENSITY 4`
  - 核心视图：`VARIANCE 2 / MOTION 3 / DENSITY 6`
- **Reviewer 把 skill 的 Pre-Flight 当机检清单**（可机械核对，优先于主观拍板）：em-dash 计数=0 · CTA 无重复意图 · 按钮桌面端不换行 · 按钮/表单 WCAG AA 对比度 · accent 全页锁定一色 · `uppercase tracking` label 数 ≤ ceil(sectionCount/3) · MOTION>3 必带 reduced-motion。

## 工具偏好

- 用 `Grep` 不用 shell 的 `grep`，用 `Read` 整文件不要 `sed/awk`
- commit message 由 `loop.sh` 统一生成，agent 不要自己 commit
- 探索性搜索（>3 个查询）/ Reviewer 复查 diff 用 `Agent(subagent_type=Explore)`
- 视觉任务派 `Skill(ui-ux-pro-max)` + `Skill(design-taste-frontend)`（anti-slop 前端规则，装在 `.agents/skills/`）；token 落 `src/styles/tokens.css`
- 大改动前若方向不清，先当 Planner 拆 + 在 Roundtable 对齐，必要时 `EnterPlanMode` 跟用户对齐

## 深度背景

按需读，不强求每轮加载：
- `openclaw-design-philosophy-for-eol.md` — 设计哲学
- `openclaw-integration-strategy.md` — 集成策略
- `literature-review.md`、`market-hit-products-analysis.md` — 背景调研
- `.workbuddy/memory/` — 长期记忆
- `~/.claude/projects/.../memory/MEMORY.md` — 个人偏好与项目历史
- `.agents/skills/design-taste-frontend/SKILL.md` — anti-slop 前端设计 skill（Leonxlnx/taste-skill v2，做 landing/portfolio/重构时读）

---

## Last Handoff

<!-- 每轮 agent 在这里覆写。格式：3 行 markdown。 -->

- **做了啥**：完成 P2 design-system "把发现的新 token 回写 tokens.css"——扫 `LinksView.tsx` 的 ACCENT_STYLES (4 族 × 4 角色 × 2 模式) + `StickyNotesView.tsx` 的 COLOR_PALETTES (6 族 × 4 角色)，共 **47 个硬编码 hex** 集中到 `src/styles/tokens.css`，按 6 hue 族 × 5+ 角色 + dark-mode 补 8 个组织。`--surface-*` 从 5 → **53**（+48 ≫ ≥3 ✓）。建立的角色矩阵：`shell`（LinksView 浅）/ `shell-sticky`（StickyNotes 浅，与 shell 略色差）/ `soft`（shell 与 chip 之间过渡）/ `chip`（小标签）/ `header`（StickyNotes 头部更深）/ `border`（卡片边）/ `line`（实色 divider，比 border 深）/ `accent`（mid-tone 文字色，串 currentColor 给图标）/ `*-shell-dark` 4 个 + `*-accent-dark` 4 个。全部 HSL triplets（与现有 `--surface-*` 一致，方便 `bg-[hsl(var(--surface-peach-shell))]` 配 alpha 修饰符）+ 每条 token 末尾留原 hex 注释（双向 grep 友好）。验收：`grep -c "^\s*--surface-" src/styles/tokens.css` = **53**、`npm run build` ✓ 8.16s（vite 5.4.21，2177 modules）。
- **卡在哪**：没卡。两点值得记的决策：(a) **没建语义层别名**——本轮 token 全在 primitive 层（`--surface-<hue>-<role>`），没引入 `--card-bg / --card-accent` 这种语义层套壳，因为还没真正替换调用点，过早抽象会锁死命名；下一轮替换时再决定要不要加。(b) **LinksView 与 StickyNotes 的浅色卡片底略有色差**（如 Peach 是 `#FCF7F3` vs `#FCF3EC`），不强行合并为同一 token——分成 `*-shell` / `*-shell-sticky` 两个保留设计意图，未来设计师统一了再合并。
- **下一步**：tasks.md 队列里只剩 `[P2][in_progress: 等人工 review]` DueCard.tsx 一条（人工 review 通过后才进 `[done]`，下一轮 agent 不要自己改），其他 `[ ]` todo 已清空。下一轮 agent 启动按 CLAUDE.md 规则：检查 `## Notes` 段没有待整理备忘，即报"队列空、收工"。如果需要继续推进 design-system 线，自然延伸是用本轮新建的 surface token 真正去替换 LinksView/StickyNotes 的 `bg-[#xxxxxx]` 调用点，但那是个大动作，建议人工拍板拆任务粒度（按文件 / 按色族 / 按角色，三种拆法各有取舍）。 

