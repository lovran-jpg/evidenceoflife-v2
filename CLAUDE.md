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

- **做了啥**：完成 P2 ui-ux-pro-max DueCard.tsx 视觉层级复审。基于 ui-ux-pro-max SKILL.md 的 §1 a11y / §5 layout / §6 typography 规则集，对 `src/components/views/dues/DueCard.tsx`（1036 行巨型卡片）做了 3 处外科手术式 className-only 修改，**总 diff 20 行**（远低于 80 行预算）：(1) **deadline / time-left chip 主次分层**——time-left chip 砍掉 `rounded-full border bg-secondary/25 px-2.5` 降级为 `px-1 py-1` 纯文本附注，配合透明度阶梯 `/80 → /55` + 前缀 `·` 分隔符，让眼睛一眼分清"截止日 anchor (可编辑) vs 已用时间 (只读元数据)"；(2) **steps 行右侧密度松绑**——主容器 `gap-2 → 2.5`，铃铛 `p-1 → 1.5`（命中 26px）、删除 `p-0.5 → 1`（命中 24px），都向 ≥24px 触控下限靠拢同时保持 hover-only ghost 语义，ghost 色 `/25 → /30` 微提升可辨识度；(3) **utility cluster 间距 + delete hover 色修对**——3 个 h-8 w-8 圆按钮 `gap-0.5 (2px) → gap-1 (4px)`（圆形按钮自带气垫，4px 已可视觉切分），同时把 `hover:bg-destructive/8`（不是 Tailwind 合法 opacity 值，被静默丢弃）改成 `/10`，让 delete hover 真正可见。验收：lint **215 errors / 67 warnings**（baseline 持平 ✓）、vitest **51/51 pass**（2.82s ✓）、build ✓ **9.02s**。tasks.md 里完整 diff + 审计依据已贴在任务下。
- **卡在哪**：没卡。两个值得记的注意点：(a) Tailwind 任意透明度只认 5/10/15/20...，写 `/8` 会被静默丢弃——这种 bug 不会引发 lint/build 错但 hover 失效；以后 review 代码看到非标 opacity 立刻怀疑。(b) DueCard 这种 1000+ 行的复杂组件改动必须克制——p-4 / mt-2.5 节奏和 inline accent style 都不是孤立可改的，动一处会引发连锁，本轮三条改动都严格控制在"单 className 调一组数字"的粒度。
- **下一步**：tasks.md 队列下一条 `[P2][todo] design-system: 把上一步发现的新 token 回写 tokens.css`——扫 `LinksView.tsx` + `StickyNotesView.tsx` 里的 `bg-[#xxxxxx]` 内联色，归类为 `--surface-peach / --surface-sage / --surface-lavender / --surface-cream` 等 semantic token 添到 `src/styles/tokens.css`（这一轮只加 token 不做替换）。验收：`grep -c "^\s*--surface-" src/styles/tokens.css` 比上一轮多 ≥ 3 + build 通过。注意：当前 DueCard 任务自标 `[in_progress: 等人工 review]`，人工 review 通过后才进 `[done]`，下一轮 agent 不要自己改成 `[done]`。
