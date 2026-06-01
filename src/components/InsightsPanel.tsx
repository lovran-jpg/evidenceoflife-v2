import { useState, useEffect, useMemo, useCallback } from 'react';
import { Moment } from '@/types';
import { Todo } from '@/hooks/useTodos';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/hooks/useLanguage';
import { autoClassifyTag, TAG_CATEGORY_COLORS, TAG_CATEGORY_ICONS } from '@/lib/autoTag';
import { format, subDays, differenceInMinutes, startOfDay, parseISO, isAfter, isBefore } from 'date-fns';
import { Brain, Zap, Clock, TrendingUp, BarChart3, Sparkles } from 'lucide-react';
import { useWorkTypes } from '@/hooks/useWorkTypes';
import { WORK_TYPE_META, WorkType } from '@/lib/workType';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

// ── Helpers ──

function fmtDur(min: number): string {
  if (min < 60) return `${Math.round(min)}m`;
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}h ${m}m` : `${h}h`;
}

function getTag(item: { tags?: string[]; title?: string; text?: string }): string {
  if (item.tags?.length) return item.tags[0];
  return autoClassifyTag(item.title || item.text || '') || 'life';
}

function getDurationMin(item: { timer_started_at?: string | null; timer_ended_at?: string | null; timer_seconds?: number | null }): number {
  if (item.timer_seconds && item.timer_seconds > 0) return item.timer_seconds / 60;
  if (item.timer_started_at && item.timer_ended_at) {
    return Math.max(0, differenceInMinutes(new Date(item.timer_ended_at), new Date(item.timer_started_at)));
  }
  // Still-running timer (started, not yet ended): count the live session so far.
  // Insights is always "today", so elapsed = now - started.
  if (item.timer_started_at && !item.timer_ended_at) {
    const startedMs = new Date(item.timer_started_at).getTime();
    if (Number.isFinite(startedMs) && startedMs <= Date.now()) {
      return Math.max(0, (Date.now() - startedMs) / 60000);
    }
  }
  return 0;
}

// ── Types ──

interface InsightData {
  focusScore: number;
  peakHourLabel: string;
  peakHourMinutes: number;
  totalActiveMin: number;
  longestStretchMin: number;
  taskSwitches: number;
  fragmentMin: number;
  leakageMin: number;
  longestGapMin: number;
  categoryBreakdown: { tag: string; min: number; pct: number }[];
  weeklyData: { day: string; min: number }[];
  streak: number;
  compareYesterday: { tag: string; diff: number }[];
  workTypeBreakdown: { type: WorkType; min: number; pct: number }[];
}

// ── Main Component ──

export function InsightsPanel({ moments, allMoments }: { moments: Moment[]; allMoments: Moment[] }) {
  const { user } = useAuth();
  const { lang } = useLanguage();
  const { getWorkType } = useWorkTypes();
  const [recentTodos, setRecentTodos] = useState<any[]>([]);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Fetch last 7 days of todos
  useEffect(() => {
    if (!user) return;
    const from = format(subDays(new Date(), 7), 'yyyy-MM-dd');
    supabase
      .from('todos')
      .select('*')
      .gte('date', from)
      .order('date', { ascending: true })
      .then(({ data }) => {
        if (data) setRecentTodos(data);
      });
  }, [user]);

  const todayTodos = useMemo(() => recentTodos.filter(t => t.date === todayStr), [recentTodos, todayStr]);
  const todayMoments = useMemo(() => moments.filter(m => m.date === todayStr), [moments, todayStr]);

  // All timed items for today
  const timedItems = useMemo(() => {
    const items: { startMin: number; durationMin: number; tag: string; workType: WorkType; title: string }[] = [];
    const addItem = (
      startAt: string | null | undefined,
      dur: number,
      tag: string,
      workType: WorkType,
      title: string,
    ) => {
      if (!startAt || dur <= 0) return;
      const d = new Date(startAt);
      const min = d.getHours() * 60 + d.getMinutes();
      items.push({ startMin: min, durationMin: dur, tag, workType, title });
    };
    todayTodos.forEach(t => addItem(
      t.timer_started_at,
      getDurationMin(t),
      getTag(t),
      getWorkType({ entity: 'todo', id: t.id, title: t.title, tags: t.tags }),
      t.title || '',
    ));
    todayMoments.forEach(m => addItem(
      m.timer_started_at,
      getDurationMin(m),
      getTag(m),
      getWorkType({ entity: 'moment', id: m.id, title: m.text, text: m.text, tags: m.tags }),
      m.text || m.tags?.[0] || m.emoji || '',
    ));
    return items.sort((a, b) => a.startMin - b.startMin);
  }, [todayTodos, todayMoments, getWorkType]);

  const insights: InsightData = useMemo(() => {
    // ── Total active time ──
    const totalActiveMin = timedItems.reduce((s, i) => s + i.durationMin, 0);

    // ── Longest stretch ──
    let longestStretch = 0;
    let currentStretch = 0;
    for (let i = 0; i < timedItems.length; i++) {
      const item = timedItems[i];
      if (i === 0) {
        currentStretch = item.durationMin;
      } else {
        const prevEnd = timedItems[i - 1].startMin + timedItems[i - 1].durationMin;
        const gap = item.startMin - prevEnd;
        if (gap <= 10) {
          currentStretch += item.durationMin;
        } else {
          longestStretch = Math.max(longestStretch, currentStretch);
          currentStretch = item.durationMin;
        }
      }
      longestStretch = Math.max(longestStretch, currentStretch);
    }

    // ── Task switches ──
    let switches = 0;
    for (let i = 1; i < timedItems.length; i++) {
      if (timedItems[i].tag !== timedItems[i - 1].tag) switches++;
    }

    // ── Fragment time (<10min items) ──
    const fragmentMin = timedItems.filter(i => i.durationMin < 10).reduce((s, i) => s + i.durationMin, 0);

    // ── Leakage / gaps ──
    let leakageMin = 0;
    let longestGapMin = 0;
    for (let i = 1; i < timedItems.length; i++) {
      const prevEnd = timedItems[i - 1].startMin + timedItems[i - 1].durationMin;
      const gap = timedItems[i].startMin - prevEnd;
      if (gap > 12) {
        leakageMin += gap;
        longestGapMin = Math.max(longestGapMin, gap);
      }
    }

    // ── Focus Score ──
    let focusScore = 50;
    if (totalActiveMin > 0) {
      const stretchBonus = Math.min(30, (longestStretch / 60) * 20);
      const switchPenalty = Math.min(20, switches * 4);
      const fragPenalty = Math.min(15, (fragmentMin / totalActiveMin) * 30);
      const leakPenalty = Math.min(14, leakageMin / 18);
      const volumeBonus = Math.min(25, (totalActiveMin / 120) * 25);
      focusScore = Math.round(Math.max(0, Math.min(100, 40 + stretchBonus + volumeBonus - switchPenalty - fragPenalty - leakPenalty)));
    } else {
      focusScore = 0;
    }

    // ── Peak hour ──
    const hourBuckets = new Array(24).fill(0);
    timedItems.forEach(item => {
      const startH = Math.floor(item.startMin / 60);
      const endH = Math.floor((item.startMin + item.durationMin) / 60);
      for (let h = startH; h <= Math.min(endH, 23); h++) {
        hourBuckets[h] += Math.min(item.durationMin, 60);
      }
    });
    const peakHour = hourBuckets.indexOf(Math.max(...hourBuckets));
    const peakHourLabel = peakHour >= 12 ? `${peakHour === 12 ? 12 : peakHour - 12}:00 PM` : `${peakHour || 12}:00 AM`;

    // ── Category breakdown ──
    const catMap: Record<string, number> = {};
    timedItems.forEach(i => { catMap[i.tag] = (catMap[i.tag] || 0) + i.durationMin; });
    const categoryBreakdown = Object.entries(catMap)
      .map(([tag, min]) => ({ tag, min, pct: totalActiveMin > 0 ? Math.round((min / totalActiveMin) * 100) : 0 }))
      .sort((a, b) => b.min - a.min);

    const typeMap: Record<WorkType, number> = {
      deep: 0,
      shallow: 0,
      admin: 0,
      errand: 0,
      recovery: 0,
    };
    timedItems.forEach(i => { typeMap[i.workType] += i.durationMin; });
    const workTypeBreakdown = (Object.entries(typeMap) as Array<[WorkType, number]>)
      .filter(([, min]) => min > 0)
      .map(([type, min]) => ({ type, min, pct: totalActiveMin > 0 ? Math.round((min / totalActiveMin) * 100) : 0 }))
      .sort((a, b) => b.min - a.min);

    // ── Weekly data ──
    const weeklyData: { day: string; min: number }[] = [];
    for (let d = 6; d >= 0; d--) {
      const dayDate = format(subDays(new Date(), d), 'yyyy-MM-dd');
      const dayLabel = format(subDays(new Date(), d), 'EEE');
      const dayTodos = recentTodos.filter(t => t.date === dayDate);
      const dayMoments = allMoments.filter(m => m.date === dayDate);
      let dayMin = 0;
      [...dayTodos, ...dayMoments].forEach(item => { dayMin += getDurationMin(item); });
      weeklyData.push({ day: dayLabel, min: dayMin });
    }

    // ── Streak ──
    let streak = 0;
    const today = startOfDay(new Date());
    for (let d = 0; d < 365; d++) {
      const checkDate = format(subDays(today, d), 'yyyy-MM-dd');
      const hasMoment = allMoments.some(m => m.date === checkDate);
      const hasTodo = recentTodos.some(t => t.date === checkDate);
      if (hasMoment || hasTodo) {
        streak++;
      } else if (d > 0) {
        break;
      }
    }

    // ── Compare with yesterday ──
    const yesterdayStr = format(subDays(new Date(), 1), 'yyyy-MM-dd');
    const yTodos = recentTodos.filter(t => t.date === yesterdayStr);
    const yMoments = allMoments.filter(m => m.date === yesterdayStr);
    const yCatMap: Record<string, number> = {};
    [...yTodos, ...yMoments].forEach(item => {
      const tag = getTag(item);
      yCatMap[tag] = (yCatMap[tag] || 0) + getDurationMin(item);
    });
    const allTags = new Set([...Object.keys(catMap), ...Object.keys(yCatMap)]);
    const compareYesterday = Array.from(allTags).map(tag => ({
      tag,
      diff: (catMap[tag] || 0) - (yCatMap[tag] || 0),
    })).filter(c => Math.abs(c.diff) >= 5).sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

    return {
      focusScore,
      peakHourLabel,
      peakHourMinutes: hourBuckets[peakHour],
      totalActiveMin,
      longestStretchMin: longestStretch,
      taskSwitches: switches,
      fragmentMin,
      leakageMin,
      longestGapMin,
      categoryBreakdown,
      workTypeBreakdown,
      weeklyData,
      streak,
      compareYesterday,
    };
  }, [timedItems, recentTodos, allMoments]);

  // ── AI Insight ──
  const fetchAiInsight = useCallback(async () => {
    if (timedItems.length < 2) return;
    setAiLoading(true);
    try {
      const events = timedItems.map(i => {
        const h = Math.floor(i.startMin / 60);
        const m = i.startMin % 60;
        return {
          time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`,
          title: i.tag,
          duration: fmtDur(i.durationMin),
        };
      });
      const { data, error } = await supabase.functions.invoke('life-replay', {
        body: { events, lang },
      });
      if (data?.story) setAiInsight(data.story);
    } catch { /* ignore */ }
    setAiLoading(false);
  }, [timedItems, lang]);

  useEffect(() => {
    if (timedItems.length >= 2 && !aiInsight) fetchAiInsight();
  }, [timedItems.length]);

  const maxWeekMin = Math.max(...insights.weeklyData.map(d => d.min), 1);

  const scoreColor = insights.focusScore >= 70 ? 'text-green-500' : insights.focusScore >= 40 ? 'text-yellow-500' : 'text-red-400';
  const scoreLabel = insights.focusScore >= 80
    ? (lang === 'zh' ? '深度专注' : 'Deep Focus')
    : insights.focusScore >= 60
    ? (lang === 'zh' ? '稳定工作' : 'Steady Work')
    : insights.focusScore >= 30
    ? (lang === 'zh' ? '碎片化' : 'Fragmented')
    : (lang === 'zh' ? '无活动' : 'No Activity');

  return (
    <div className="mb-8 space-y-4">
      <Tabs defaultValue="overview" className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.24em] text-muted-foreground/75">
            <Sparkles size={14} className="text-primary/75" />
            {lang === 'zh' ? '今日洞察' : "Today's Insights"}
          </h2>
          <TabsList className="h-10 rounded-full bg-secondary/55 p-1">
            <TabsTrigger value="overview" className="rounded-full px-4 text-[13px]">{lang === 'zh' ? '概览' : 'Overview'}</TabsTrigger>
            <TabsTrigger value="ledger" className="rounded-full px-4 text-[13px]">{lang === 'zh' ? '时间账' : 'Ledger'}</TabsTrigger>
            <TabsTrigger value="patterns" className="rounded-full px-4 text-[13px]">{lang === 'zh' ? '规律' : 'Patterns'}</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="overview" className="space-y-4">
          {(aiInsight || aiLoading) && (
            <div className="rounded-[24px] border border-primary/10 bg-[#fffaf6] p-5 shadow-[0_16px_48px_-40px_rgba(190,120,82,0.24)]">
              <div className="mb-2 flex items-center gap-2">
                <Brain size={16} className="text-primary/85" />
                <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-primary/75">
                  {lang === 'zh' ? 'AI 总结' : 'AI Summary'}
                </span>
              </div>
              {aiLoading ? (
                <div className="flex h-10 items-center">
                  <span className="animate-pulse text-[15px] text-muted-foreground">
                    {lang === 'zh' ? '思考中...' : 'Thinking...'}
                  </span>
                </div>
              ) : (
                <p className="text-[1rem] leading-[1.8] text-foreground/86">{aiInsight}</p>
              )}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[28px] border border-border/70 bg-white px-5 py-5 shadow-[0_18px_54px_-42px_rgba(190,120,82,0.24)]">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-1.5">
                    <Zap size={15} className="text-primary/85" />
                    <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                      {lang === 'zh' ? '专注得分' : 'Focus Score'}
                    </span>
                  </div>
                  <div className="flex items-end gap-2">
                    <span className={`text-[3.5rem] font-semibold leading-none tabular-nums ${scoreColor}`}>{insights.focusScore}</span>
                    <span className="pb-2 text-lg text-muted-foreground">/100</span>
                  </div>
                  <p className="mt-2 text-[1.02rem] font-medium text-foreground/76">{scoreLabel}</p>
                </div>

                <div className="rounded-[22px] border border-border/70 bg-secondary/45 px-4 py-3 text-right">
                  <div className="mb-1 flex items-center justify-end gap-1.5 text-muted-foreground">
                    <Clock size={14} className="text-primary/75" />
                    <span className="text-[12px] font-semibold uppercase tracking-[0.16em]">
                      {lang === 'zh' ? '峰值时段' : 'Peak Time'}
                    </span>
                  </div>
                  <div className="text-[1.75rem] font-semibold leading-none">{insights.peakHourLabel}</div>
                  <div className="mt-2 text-[14px] text-muted-foreground">
                    {fmtDur(insights.peakHourMinutes)} {lang === 'zh' ? '活跃' : 'active'}
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: lang === 'zh' ? '最长连续' : 'Longest stretch', value: fmtDur(insights.longestStretchMin) },
                  { label: lang === 'zh' ? '任务切换' : 'Task switches', value: String(insights.taskSwitches) },
                  { label: lang === 'zh' ? '碎片时间' : 'Fragment time', value: fmtDur(insights.fragmentMin) },
                ].map((item) => (
                  <div key={item.label} className="rounded-[22px] border border-border/65 bg-[#fffaf7] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">{item.label}</div>
                    <div className="mt-2 text-[1.45rem] font-semibold leading-none text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-[28px] border border-border/70 bg-white px-5 py-5 shadow-[0_18px_54px_-42px_rgba(190,120,82,0.22)]">
                <div className="mb-3 flex items-center gap-1.5">
                  <BarChart3 size={15} className="text-primary/85" />
                  <span className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                    {lang === 'zh' ? '今日产出' : 'Today at a glance'}
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
                      {lang === 'zh' ? '总活跃时间' : 'Total active'}
                    </div>
                    <div className="mt-2 text-[2.4rem] font-semibold leading-none">{fmtDur(insights.totalActiveMin)}</div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-[20px] bg-secondary/45 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
                        {lang === 'zh' ? '记录连续' : 'Streak'}
                      </div>
                      <div className="mt-2 flex items-end gap-1">
                        <span className="text-[1.8rem] font-semibold leading-none">{insights.streak}</span>
                        <span className="pb-0.5 text-[13px] text-muted-foreground">{lang === 'zh' ? '天' : 'days'}</span>
                      </div>
                    </div>
                    <div className="rounded-[20px] bg-secondary/45 px-4 py-3">
                      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/65">
                        {lang === 'zh' ? '深度工作' : 'Deep work'}
                      </div>
                      <div className="mt-2 text-[1.8rem] font-semibold leading-none tabular-nums">
                        {fmtDur(insights.workTypeBreakdown.find(w => w.type === 'deep')?.min || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        </TabsContent>

        <TabsContent value="ledger" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.02fr_0.98fr]">
            <div className="rounded-[28px] border border-border/70 bg-white px-5 py-5 shadow-[0_18px_54px_-42px_rgba(190,120,82,0.22)]">
              <div className="mb-4 flex items-center gap-1.5">
                <Clock size={15} className="text-primary/85" />
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                    {lang === 'zh' ? '时间账本' : 'Time Ledger'}
                  </div>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    {lang === 'zh' ? '今天真实发生过的时间流水。' : 'A ledger of where today actually went.'}
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                {timedItems.length > 0 ? timedItems.slice(0, 6).map((item, index) => (
                  <div key={`${item.title}-${item.startMin}-${index}`} className="flex items-center justify-between rounded-[18px] border border-border/55 bg-[#fffdfa] px-4 py-3 text-sm">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: WORK_TYPE_META[item.workType].color }} />
                        <div className="truncate font-semibold text-foreground">{item.title || item.tag}</div>
                      </div>
                      <div className="mt-1 flex items-center gap-2 text-[13px] text-muted-foreground">
                        <span>{`${String(Math.floor(item.startMin / 60)).padStart(2, '0')}:${String(item.startMin % 60).padStart(2, '0')}`}</span>
                        <span>·</span>
                        <span className="capitalize">{item.tag}</span>
                        <span>·</span>
                        <span>{WORK_TYPE_META[item.workType].label}</span>
                      </div>
                    </div>
                    <div className="ml-4 shrink-0 font-semibold tabular-nums">{fmtDur(item.durationMin)}</div>
                  </div>
                )) : (
                  <div className="rounded-[20px] border border-dashed border-border/80 bg-[#fffdfa] px-4 py-5 text-[14px] text-muted-foreground">
                    {lang === 'zh' ? '今天还没有足够的时间记录。' : 'Not enough recorded time yet today.'}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[28px] border border-border/70 bg-white px-5 py-5 shadow-[0_18px_54px_-42px_rgba(190,120,82,0.22)]">
              <div className="mb-4 flex items-center gap-1.5">
                <Brain size={15} className="text-primary/85" />
                <div>
                  <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                    {lang === 'zh' ? '时间黑洞' : 'Time Leak'}
                  </div>
                  <p className="mt-1 text-[14px] text-muted-foreground">
                    {lang === 'zh' ? '碎片化和中断最容易偷走专注。' : 'Fragmentation and long gaps are where attention leaks out.'}
                  </p>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {[
                  { label: lang === 'zh' ? '碎片时间' : 'Fragmented', value: fmtDur(insights.fragmentMin) },
                  { label: lang === 'zh' ? '切换损耗' : 'Switching', value: String(insights.taskSwitches) },
                  { label: lang === 'zh' ? '最长空档' : 'Longest gap', value: fmtDur(insights.longestGapMin) },
                ].map((item) => (
                  <div key={item.label} className="rounded-[20px] border border-border/60 bg-[#fffaf7] px-4 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">{item.label}</div>
                    <div className="mt-2 text-[1.4rem] font-semibold leading-none text-foreground">{item.value}</div>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-[20px] border border-border/60 bg-secondary/35 px-4 py-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground/70">
                      {lang === 'zh' ? '总泄漏时间' : 'Total leakage'}
                    </div>
                    <div className="mt-2 text-[1.8rem] font-semibold leading-none">{fmtDur(insights.leakageMin)}</div>
                  </div>
                  <div className="max-w-[220px] text-right text-[13px] leading-relaxed text-muted-foreground">
                    {lang === 'zh'
                      ? '大于 12 分钟的空档会被当成注意力泄漏。'
                      : 'Gaps longer than 12 minutes are counted as attention leakage.'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="patterns" className="space-y-4">
          <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
            {insights.categoryBreakdown.length > 0 && (
              <div className="rounded-[28px] border border-border/70 bg-white px-5 py-5 shadow-[0_18px_54px_-42px_rgba(190,120,82,0.22)]">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                      {lang === 'zh' ? '时间分布' : 'Time Balance'}
                    </div>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      {lang === 'zh' ? '今天的时间主要花在哪些类别上。' : 'Where today actually went.'}
                    </p>
                  </div>
                  {insights.compareYesterday.length > 0 && (
                    <span className="rounded-full bg-secondary/55 px-3 py-1 text-[11px] font-medium text-muted-foreground">
                      vs {lang === 'zh' ? '昨天' : 'yesterday'}
                    </span>
                  )}
                </div>

                <div className="mb-5 flex h-4 overflow-hidden rounded-full bg-secondary/55">
                  {insights.categoryBreakdown.map(cat => (
                    <div
                      key={cat.tag}
                      style={{
                        width: `${cat.pct}%`,
                        backgroundColor: TAG_CATEGORY_COLORS[cat.tag] || 'hsl(var(--muted))',
                      }}
                      className="transition-all"
                    />
                  ))}
                </div>

                <div className="space-y-2.5">
                  {insights.categoryBreakdown.map(cat => {
                    const diff = insights.compareYesterday.find(c => c.tag === cat.tag);
                    return (
                      <div key={cat.tag} className="flex items-center justify-between rounded-[18px] border border-border/55 bg-[#fffdfa] px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-secondary/45 text-base">
                            {TAG_CATEGORY_ICONS[cat.tag] || '📌'}
                          </span>
                          <div>
                            <div className="capitalize font-semibold text-foreground">{cat.tag}</div>
                            <div className="text-[13px] text-muted-foreground">{cat.pct}%</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold tabular-nums">{fmtDur(cat.min)}</div>
                          {diff && Math.abs(diff.diff) >= 5 && (
                            <div className={`text-[12px] font-medium ${diff.diff > 0 ? 'text-green-500' : 'text-red-400'}`}>
                              {diff.diff > 0 ? '+' : ''}{fmtDur(Math.abs(diff.diff))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="grid gap-4">
              {insights.workTypeBreakdown.length > 0 && (
                <div className="rounded-[28px] border border-border/70 bg-white px-5 py-5 shadow-[0_18px_54px_-42px_rgba(190,120,82,0.22)]">
                  <div className="mb-4">
                    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                      {lang === 'zh' ? '工作模式' : 'Work Mode Mix'}
                    </div>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      {lang === 'zh' ? '今天的时间更多流向哪种任务模式。' : 'How today split across deep, shallow, admin, errand, and recovery.'}
                    </p>
                  </div>
                  <div className="mb-5 flex h-4 overflow-hidden rounded-full bg-secondary/55">
                    {insights.workTypeBreakdown.map((item) => (
                      <div
                        key={item.type}
                        style={{ width: `${item.pct}%`, backgroundColor: WORK_TYPE_META[item.type].color }}
                        className="transition-all"
                      />
                    ))}
                  </div>
                  <div className="space-y-2.5">
                    {insights.workTypeBreakdown.map((item) => (
                      <div key={item.type} className="flex items-center justify-between rounded-[18px] border border-border/55 bg-[#fffdfa] px-4 py-3 text-sm">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ backgroundColor: WORK_TYPE_META[item.type].color }} />
                          <div>
                            <div className="font-semibold text-foreground">{WORK_TYPE_META[item.type].label}</div>
                            <div className="text-[13px] text-muted-foreground">{item.pct}%</div>
                          </div>
                        </div>
                        <div className="font-semibold tabular-nums">{fmtDur(item.min)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[28px] border border-border/70 bg-white px-5 py-5 shadow-[0_18px_54px_-42px_rgba(190,120,82,0.22)]">
                <div className="mb-4 flex items-center gap-1.5">
                  <TrendingUp size={15} className="text-primary/85" />
                  <div>
                    <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/80">
                      {lang === 'zh' ? '本周趋势' : 'Weekly Trend'}
                    </div>
                    <p className="mt-1 text-[14px] text-muted-foreground">
                      {lang === 'zh' ? '过去七天的投入强度。' : 'How your recent rhythm has been moving.'}
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex h-56 items-end gap-3">
                  {insights.weeklyData.map((d, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-2">
                      <div className="flex w-full flex-1 items-end">
                        <div
                          className="w-full rounded-t-[18px] bg-gradient-to-t from-primary to-primary/55 px-2 pb-2 pt-4 shadow-[0_20px_36px_-24px_rgba(190,120,82,0.5)] transition-all"
                          style={{ height: `${Math.max(12, (d.min / maxWeekMin) * 100)}%` }}
                        >
                          <div className="text-center text-[11px] font-semibold text-primary-foreground/90">
                            {d.min > 0 ? fmtDur(d.min) : '0m'}
                          </div>
                        </div>
                      </div>
                      <span className="text-[12px] font-medium text-muted-foreground">{d.day}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
