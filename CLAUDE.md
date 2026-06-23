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

如果队列空了：检查 `tasks.md ## Notes` 段看有没有待整理的备忘；都没有就报"队列空、收工"，不要自己造任务。

## 工作流（每轮 agent 做什么）

1. 读本文件 → 读 `tasks.md` → 挑第一条 `[todo]`
2. 把它标成 `[in_progress]`
3. 推进它（一次只推一条；如果发现要拆，拆完追加到 `tasks.md` 末尾再继续）
4. 跑验收命令（每条任务自带验收条件）
5. 把它标成 `[done]`，更新本文件末尾的 **Last Handoff** 段（3 行：做了啥 / 卡在哪 / 下一步该干啥）
6. 退出（exit 0）。外层 `loop.sh` 会负责 commit 和决定要不要再起一轮

## 工具偏好

- 用 `Grep` 不用 shell 的 `grep`，用 `Read` 整文件不要 `sed/awk`
- commit message 由 `loop.sh` 统一生成，agent 不要自己 commit
- 探索性搜索（>3 个查询）用 `Agent(subagent_type=Explore)`
- 大改动前如果不确定方向，先 `EnterPlanMode` 跟用户对齐

## 深度背景

按需读，不强求每轮加载：
- `openclaw-design-philosophy-for-eol.md` — 设计哲学
- `openclaw-integration-strategy.md` — 集成策略
- `literature-review.md`、`market-hit-products-analysis.md` — 背景调研
- `.workbuddy/memory/` — 长期记忆
- `~/.claude/projects/.../memory/MEMORY.md` — 个人偏好与项目历史

---

## Last Handoff

<!-- 每轮 agent 在这里覆写。格式：3 行 markdown。 -->

- **做了啥**：完成 P2 design-system "把发现的新 token 回写 tokens.css"——扫 `LinksView.tsx` 的 ACCENT_STYLES (4 族 × 4 角色 × 2 模式) + `StickyNotesView.tsx` 的 COLOR_PALETTES (6 族 × 4 角色)，共 **47 个硬编码 hex** 集中到 `src/styles/tokens.css`，按 6 hue 族 × 5+ 角色 + dark-mode 补 8 个组织。`--surface-*` 从 5 → **53**（+48 ≫ ≥3 ✓）。建立的角色矩阵：`shell`（LinksView 浅）/ `shell-sticky`（StickyNotes 浅，与 shell 略色差）/ `soft`（shell 与 chip 之间过渡）/ `chip`（小标签）/ `header`（StickyNotes 头部更深）/ `border`（卡片边）/ `line`（实色 divider，比 border 深）/ `accent`（mid-tone 文字色，串 currentColor 给图标）/ `*-shell-dark` 4 个 + `*-accent-dark` 4 个。全部 HSL triplets（与现有 `--surface-*` 一致，方便 `bg-[hsl(var(--surface-peach-shell))]` 配 alpha 修饰符）+ 每条 token 末尾留原 hex 注释（双向 grep 友好）。验收：`grep -c "^\s*--surface-" src/styles/tokens.css` = **53**、`npm run build` ✓ 8.16s（vite 5.4.21，2177 modules）。
- **卡在哪**：没卡。两点值得记的决策：(a) **没建语义层别名**——本轮 token 全在 primitive 层（`--surface-<hue>-<role>`），没引入 `--card-bg / --card-accent` 这种语义层套壳，因为还没真正替换调用点，过早抽象会锁死命名；下一轮替换时再决定要不要加。(b) **LinksView 与 StickyNotes 的浅色卡片底略有色差**（如 Peach 是 `#FCF7F3` vs `#FCF3EC`），不强行合并为同一 token——分成 `*-shell` / `*-shell-sticky` 两个保留设计意图，未来设计师统一了再合并。
- **下一步**：tasks.md 队列里只剩 `[P2][in_progress: 等人工 review]` DueCard.tsx 一条（人工 review 通过后才进 `[done]`，下一轮 agent 不要自己改），其他 `[ ]` todo 已清空。下一轮 agent 启动按 CLAUDE.md 规则：检查 `## Notes` 段没有待整理备忘，即报"队列空、收工"。如果需要继续推进 design-system 线，自然延伸是用本轮新建的 surface token 真正去替换 LinksView/StickyNotes 的 `bg-[#xxxxxx]` 调用点，但那是个大动作，建议人工拍板拆任务粒度（按文件 / 按色族 / 按角色，三种拆法各有取舍）。
