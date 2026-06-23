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

- **做了啥**：完成 P1 ui-styling 第二步——把 `src/components/DayDetail/DayDetailSheet.tsx` 里 6 个原生 `<button>` 全部迁到 shadcn `<Button>`，全部 `variant="ghost" size="icon"`，三类尺寸覆盖手法：(1) photo-preview 删除按钮 `h-5 w-5` + `[&_svg]:size-3` 同时盖掉 cva `h-10/w-10` 与 `[&_svg]:size-4` 并写 `hover:bg-foreground/90 hover:text-background` 保住反色语义；(2) chip 内联清除按钮 `h-auto w-auto p-0` + `hover:bg-transparent` 贴合 lucide 12px；(3) 4 个 p-2 圆形 toggle/trigger `h-auto w-auto p-2 rounded-full`，emoji & location 两处给自己的 `bg-primary/10 + hover:bg-primary/15` 高亮态。两个 PopoverTrigger asChild 保留（Button 是 forwardRef，Slot 透传 OK）。验收：`grep -c "<button" src/components/DayDetail/DayDetailSheet.tsx` = **0**，lint **215 errors / 67 warnings**（与 baseline 持平），vitest **51/51 pass**（3.09s），build ✓ **9.27s**。
- **卡在哪**：没卡。注意点：ghost 默认 hover 翻成 `accent` 色会破坏自定义反色按钮（如反色 fg/bg 删除按钮、primary/10 高亮 toggle），所以这类按钮必须自带显式 `hover:` 覆盖，不能裸用 ghost。
- **下一步**：tasks.md 队列下一条 `[P2][todo] ui-ux-pro-max: DueCard.tsx 视觉层级复审`——调用 `Skill(ui-ux-pro-max)` 对 `src/components/views/dues/DueCard.tsx` 做层级/间距/对比度审计，输出 diff 落到代码（diff ≤ 80 行，超出拆），跑 lint ≤ baseline + vitest pass；这条主观，做完按规则自标 `[in_progress: 等人工 review]` 等人工 review 才进 `[done]`。
