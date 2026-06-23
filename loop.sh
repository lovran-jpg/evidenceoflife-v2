#!/usr/bin/env bash
# loop.sh — 自驱式 agent 推进器
#
# 用法:  bash loop.sh [max_rounds] [--dry-run]
#   max_rounds  默认 5
#   --dry-run   不真调 claude，只验证脚本逻辑、队列检查、commit 守门
#
# 退出条件（任一）:
#   1. tasks.md 没有 [todo] 项
#   2. claude 退出码非 0
#   3. lint 或 vitest 失败（改动会 stash）
#   4. 守门拦截到敏感物
#   5. 达到 max_rounds

set -uo pipefail

REPO="/c/Users/t-youwu/repo/evidenceoflife-006dea11-main"
LOG="$REPO/.workbuddy/loop.log"
MAX_ROUNDS="${1:-5}"
DRY_RUN="no"
for arg in "$@"; do
  [ "$arg" = "--dry-run" ] && DRY_RUN="yes"
done

cd "$REPO" || { echo "FATAL: cannot cd to $REPO"; exit 1; }
mkdir -p "$(dirname "$LOG")"

log() { echo "[$(date '+%F %T')] $*" | tee -a "$LOG"; }

log "=== loop start (max=$MAX_ROUNDS, dry_run=$DRY_RUN) ==="

# 安全检查 1: 必须在仓库内
[ -f "tasks.md" ] || { log "FATAL: tasks.md not found in $REPO"; exit 1; }
[ -f "CLAUDE.md" ] || { log "FATAL: CLAUDE.md not found"; exit 1; }

# 安全检查 2: 起跑前若工作树脏，先快照
if [ -n "$(git status --porcelain)" ]; then
  log "working tree dirty; snapshotting before loop"
  git add -A
  git commit -m "chore(loop): pre-loop snapshot" >> "$LOG" 2>&1 || log "  (nothing to commit)"
fi

for round in $(seq 1 "$MAX_ROUNDS"); do
  log ""
  log "=== round $round / $MAX_ROUNDS ==="

  # 队列检查
  remaining=$(grep -cE '^- \[ \] \[P[0-9]+\]\[todo\]' tasks.md 2>/dev/null || echo 0)
  log "remaining [todo] items: $remaining"
  if [ "$remaining" -eq 0 ]; then
    log "queue empty, done"
    break
  fi

  # 调 agent
  if [ "$DRY_RUN" = "yes" ]; then
    log "DRY-RUN: would call claude -p; skipping"
    agent_code=0
  else
    log "calling claude -p ..."
    # 注意: --dangerously-skip-permissions 让 agent 不卡权限确认
    # prompt 故意短: agent 读 CLAUDE.md 与 tasks.md 自己决定
    timeout 1200 claude --dangerously-skip-permissions -p \
      "读 CLAUDE.md 与 tasks.md，挑第一条 [todo] 推进；完成后把它标 [done]，跑验收命令并把输出贴到该任务下；最后更新 CLAUDE.md 末尾的 Last Handoff 段" \
      >> "$LOG" 2>&1
    agent_code=$?
    log "agent exit code: $agent_code"
  fi

  if [ "$agent_code" -ne 0 ]; then
    log "agent failed (exit=$agent_code), stopping loop"
    break
  fi

  # 守门 1: 拦敏感物
  if git diff --cached --name-only 2>/dev/null | grep -qE '\.env($|\.)|secret|service[_-]?key|private[_-]?key'; then
    log "SECURITY: staged files match sensitive pattern, aborting"
    git reset >> "$LOG" 2>&1
    break
  fi
  if git status --porcelain | awk '{print $2}' | grep -qE '\.env($|\.)|secret|service[_-]?key|private[_-]?key'; then
    log "SECURITY: working tree contains sensitive file changes, aborting"
    break
  fi

  # 守门 2: lint + vitest 都必须过
  log "running lint..."
  if ! npm run lint --silent >> "$LOG" 2>&1; then
    log "lint FAILED; stashing changes and stopping"
    git stash push -u -m "loop-round-$round-lint-failed" >> "$LOG" 2>&1
    break
  fi

  log "running vitest..."
  if ! npx vitest run --silent >> "$LOG" 2>&1; then
    log "vitest FAILED; stashing changes and stopping"
    git stash push -u -m "loop-round-$round-test-failed" >> "$LOG" 2>&1
    break
  fi

  # commit 本轮成果
  if [ -n "$(git status --porcelain)" ]; then
    git add -A
    if git commit -m "loop(round $round): $(date '+%F-%H%M')" >> "$LOG" 2>&1; then
      log "committed round $round"
    else
      log "commit failed or nothing to commit"
    fi
  else
    log "no changes to commit"
  fi

  # 每 5 轮做一次本地 bundle 备份（仓库无 remote 的兜底）
  if [ $((round % 5)) -eq 0 ]; then
    bundle=".workbuddy/backup-$(date +%s).bundle"
    git bundle create "$bundle" --all >> "$LOG" 2>&1 && log "bundle backup: $bundle"
  fi
done

log "=== loop end ==="
