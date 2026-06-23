# CLAUDE.md — 交接班说明书

> 这是 agent 每轮启动必读的当前工作面板。**任务队列是 `tasks.md`**——本文件不重复任务，只讲项目骨架、硬约束、当前焦点与上轮交接。

---

## 项目一句话

Vite + React 18 + TypeScript + shadcn/ui + Tailwind + Supabase 的个人生活记录 SPA（Today / Recap / Dues / Map / Calendar / Year / Notes / Links）。单人开发，仓库无 git remote，本地优先。

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

- **不准 `git push`**——仓库无 remote，push 没意义且可能配错指向
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

- **做了啥**：完成 P1 design-system tokens.css 首步——新建 `src/styles/tokens.css`（13 个 spacing + 5 个 surface token，共 18 个 `--` 声明），`src/main.tsx` import 一行（放在 index.css 之前，本轮不改变运行时行为）。`npm run build` ✓ 8.51s 通过。
- **卡在哪**：没卡。本轮严格遵守"只新建文件 + 改 main.tsx 一行 import"的范围限制；index.css 里的 surface token 重复声明保留，等后续任务再做 thin-down。
- **下一步**：tasks.md 队列下一条是 `[P1][todo] ui-styling: MapView.tsx 的 6 个 <button> 迁到 shadcn Button`——动 `src/components/views/MapView.tsx` 一个文件，替换 6 处原生 `<button>` 为 `@/components/ui/button` 的 `<Button>`，保留 className 并用 variant/size 表达。
