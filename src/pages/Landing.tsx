import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  PlayCircle,
  Sparkles,
  CalendarClock,
  Timer,
  NotebookPen,
  MapPin,
  CalendarDays,
  Images,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { BrandLogo } from '@/components/BrandLogo';

const steps = [
  {
    number: '01',
    id: 'plan',
    label: 'Plan',
    title: 'Plan the day',
    body: 'Type a task, drag it into the timeline, and surface upcoming deadlines in one flow.',
  },
  {
    number: '02',
    id: 'focus',
    label: 'Focus',
    title: 'Start a real focus session',
    body: 'Tap the pomodoro timer so actual time accumulates inside the same day view.',
  },
  {
    number: '03',
    id: 'recap',
    label: 'Recap',
    title: 'Recap with notes, photos & places',
    body: 'End the session, add a quick note, drop a location or photo — and turn the task into memory.',
  },
  {
    number: '04',
    id: 'calendar',
    label: 'Calendar',
    title: 'See the week fill in',
    body: 'Planned and recorded moments settle into a fuller calendar view over time.',
  },
  {
    number: '05',
    id: 'map',
    label: 'Map',
    title: 'Replay where life happened',
    body: 'Locations from recap flow into the map, so your day becomes a place-based memory trail.',
  },
];

const features = [
  {
    icon: CalendarClock,
    title: 'One day view',
    body: 'Tasks, deadlines, focus sessions, notes and places all live in a single timeline — no app-switching.',
  },
  {
    icon: Timer,
    title: 'Real focus time',
    body: 'A built-in pomodoro logs the time you actually spent, not the time you planned to spend.',
  },
  {
    icon: NotebookPen,
    title: 'Recap in seconds',
    body: 'Close a session with a quick note, a photo, or a mood — turning a finished task into a kept memory.',
  },
  {
    icon: CalendarDays,
    title: 'Calendar that fills itself',
    body: 'Planned and recorded moments accumulate into a week and month you can actually look back on.',
  },
  {
    icon: MapPin,
    title: 'A map of your life',
    body: 'Every place you tag flows onto a map, so days come back as a route you can re-walk.',
  },
  {
    icon: Images,
    title: 'Memory, not metrics',
    body: 'No streaks to guilt you. Just an honest record of the days you actually lived.',
  },
];

const framePresets: Record<string, { scale: number; x: number; y: number; width: string; height: string }> = {
  plan: { scale: 0.84, x: -12, y: -6, width: '118%', height: '118%' },
  focus: { scale: 0.84, x: -12, y: -6, width: '118%', height: '118%' },
  recap: { scale: 0.92, x: -22, y: -74, width: '132%', height: '138%' },
  calendar: { scale: 0.9, x: -8, y: -10, width: '114%', height: '114%' },
  map: { scale: 0.9, x: -8, y: -10, width: '114%', height: '114%' },
};

export default function Landing() {
  const navigate = useNavigate();
  const [activeStepIndex, setActiveStepIndex] = useState(0);
  const activeStep = steps[activeStepIndex];
  const activeFrame = framePresets[activeStep.id] ?? framePresets.plan;

  useEffect(() => {
    trackEvent('landing_page_view', { page: '/' });
  }, []);

  const handleStart = () => {
    trackEvent('landing_cta_clicked', { cta: 'start_free', page: '/' });
    navigate('/auth');
  };

  const handleDemo = () => {
    trackEvent('landing_cta_clicked', { cta: 'open_demo', page: '/' });
    navigate('/demo-app');
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8f1e8] text-[#2d221d] antialiased">
      {/* ── Navbar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-[rgba(124,82,56,0.08)] bg-[rgba(248,241,232,0.82)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo alt="Evidence of Life" className="h-10 w-10" />
            <div className="leading-tight">
              <div className="font-brand text-[22px] text-[#6f5646]">Evidence of life</div>
              <div className="text-xs text-[#9a8473]">Memory-first daily tracker</div>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              className="hidden rounded-full px-4 text-[#8d7564] hover:bg-[rgba(124,82,56,0.06)] hover:text-[#5d493d] sm:inline-flex"
              onClick={() => navigate('/auth')}
            >
              Sign in
            </Button>
            <Button
              className="rounded-full bg-[#d4875f] px-5 text-white shadow-[0_8px_20px_-10px_rgba(212,135,95,0.9)] hover:bg-[#c9784e]"
              onClick={handleStart}
            >
              Start free
            </Button>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────── */}
      <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 text-center lg:px-8 lg:pt-24">
        <div className="pointer-events-none absolute left-1/2 top-[-10%] -z-0 h-[480px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(212,135,95,0.16),transparent)] blur-2xl" />

        <div className="relative mx-auto flex max-w-3xl flex-col items-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,135,95,0.22)] bg-[rgba(255,250,244,0.9)] px-3.5 py-1.5 text-sm font-medium text-[#c9784e] shadow-sm">
            <Sparkles size={14} />
            Don&apos;t let your days disappear
          </div>

          <h1 className="mt-7 text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.04em] text-[#2d221d] sm:text-6xl">
            Plan your day.
            <br />
            <span className="text-[#c9784e]">Keep what actually happened.</span>
          </h1>

          <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-[#6d594d]">
            Evidence of Life is a memory-first daily tracker. Tasks, focus time, notes,
            photos and places live in one day view — so the life that usually scatters
            across a dozen apps comes back later as a single, honest record.
          </p>

          <div className="mt-9 flex w-full flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              size="lg"
              className="h-12 w-full rounded-full bg-[#d4875f] px-7 text-base text-white shadow-[0_14px_30px_-12px_rgba(212,135,95,0.95)] hover:bg-[#c9784e] sm:w-auto"
              onClick={handleStart}
            >
              Create free account
              <ArrowRight />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 w-full rounded-full border-[rgba(111,86,70,0.22)] bg-white/80 px-7 text-base text-[#5d493d] hover:bg-white sm:w-auto"
              onClick={handleDemo}
            >
              <PlayCircle />
              Open live demo
            </Button>
          </div>

          <p className="mt-4 text-sm text-[#9a8473]">No credit card · Free to start · Live demo with sample data</p>
        </div>

        {/* ── Product preview ──────────────────────────────────── */}
        <div className="relative mx-auto mt-14 max-w-4xl">
          <div className="overflow-hidden rounded-2xl border border-[rgba(49,36,31,0.12)] bg-[#1b1512] shadow-[0_40px_80px_-32px_rgba(45,34,29,0.55)]">
            {/* browser bar */}
            <div className="flex items-center gap-2 border-b border-white/5 bg-[#231b17] px-4 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
              <div className="ml-3 flex-1 truncate rounded-full bg-[#3a302a] px-4 py-1 text-center text-[11px] text-[#cdbcae]">
                evidenceoflife.app/demo
              </div>
            </div>

            <div className="relative aspect-[16/10] overflow-hidden bg-[#171210]">
              <div className="absolute left-4 top-4 z-10 rounded-full border border-[rgba(223,154,118,0.24)] bg-[rgba(23,18,16,0.82)] px-3 py-1.5 text-[11px] font-medium text-[#f4dfd1]">
                {activeStep.number}. {activeStep.label}
              </div>
              <iframe
                src={`/demo-app?embed=1&demoStep=${activeStep.id}`}
                title="Evidence of Life demo app"
                className="absolute left-0 top-0 origin-top-left border-0"
                loading="eager"
                style={{
                  width: activeFrame.width,
                  height: activeFrame.height,
                  transform: `translate(${activeFrame.x}px, ${activeFrame.y}px) scale(${activeFrame.scale})`,
                  transformOrigin: 'top left',
                }}
              />
              <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-full border border-[rgba(223,154,118,0.18)] bg-[rgba(23,18,16,0.82)] px-3 py-1 text-[10px] font-medium text-[#f4dfd1]">
                Public demo · Sample data
              </div>
            </div>
          </div>

          {/* step switcher */}
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {steps.map((step, index) => (
              <button
                key={step.id}
                type="button"
                onClick={() => setActiveStepIndex(index)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  step.id === activeStep.id
                    ? 'bg-[#d4875f] text-white shadow-[0_8px_18px_-10px_rgba(212,135,95,0.9)]'
                    : 'border border-[rgba(124,82,56,0.14)] bg-white/70 text-[#7b675a] hover:bg-white'
                }`}
              >
                {step.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-center text-[15px] text-[#786457]">
            <span className="font-semibold text-[#342821]">{activeStep.title}.</span> {activeStep.body}
          </p>
        </div>
      </section>

      {/* ── Trust strip ───────────────────────────────────────── */}
      <section className="border-y border-[rgba(124,82,56,0.08)] bg-[rgba(255,250,244,0.6)]">
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 py-10 text-center sm:grid-cols-4 lg:px-8">
          {[
            ['One', 'place for the whole day'],
            ['Plan → Recap', 'without switching modes'],
            ['Map + Calendar', 'memory you can revisit'],
            ['No streaks', 'no guilt, just a record'],
          ].map(([stat, label]) => (
            <div key={label}>
              <div className="text-xl font-semibold tracking-tight text-[#c9784e]">{stat}</div>
              <div className="mt-1 text-sm leading-6 text-[#786457]">{label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ──────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#2d221d] sm:text-4xl">
            Everything from one day, in one place
          </h2>
          <p className="mt-4 text-lg leading-8 text-[#6d594d]">
            Most tools capture either the plan or the memory. Evidence of Life holds both,
            so nothing about your day has to be retold from scratch.
          </p>
        </div>

        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border border-[rgba(124,82,56,0.1)] bg-[rgba(255,250,244,0.78)] p-6 transition-shadow hover:shadow-[0_24px_48px_-28px_rgba(45,34,29,0.4)]"
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[rgba(212,135,95,0.14)] text-[#c9784e]">
                <feature.icon size={20} />
              </div>
              <h3 className="mt-5 text-lg font-semibold text-[#342821]">{feature.title}</h3>
              <p className="mt-2 text-[15px] leading-7 text-[#786457]">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section className="border-t border-[rgba(124,82,56,0.08)] bg-[rgba(255,250,244,0.55)]">
        <div className="mx-auto max-w-5xl px-6 py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#2d221d] sm:text-4xl">
              From plan to memory in five steps
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#6d594d]">
              The same day flows forward — you never leave one mode to enter another.
            </p>
          </div>

          <ol className="mt-14 space-y-3">
            {steps.map((step) => (
              <li
                key={step.id}
                className="flex items-start gap-5 rounded-2xl border border-[rgba(124,82,56,0.1)] bg-white/70 p-6"
              >
                <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-[#d4875f] text-base font-semibold text-white">
                  {step.number}
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#342821]">{step.title}</h3>
                  <p className="mt-1 text-[15px] leading-7 text-[#786457]">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 py-24 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-[#2d221d] px-8 py-16 text-center shadow-[0_40px_80px_-40px_rgba(45,34,29,0.7)] sm:px-16">
          <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(212,135,95,0.35),transparent)] blur-2xl" />
          <div className="relative mx-auto max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#f8f1e8] sm:text-4xl">
              Start keeping the days you live
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#d8c6b8]">
              Plan today, capture what actually happened, and watch the calendar and map
              quietly become a record worth coming back to.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 w-full rounded-full bg-[#d4875f] px-7 text-base text-white hover:bg-[#c9784e] sm:w-auto"
                onClick={handleStart}
              >
                Create free account
                <ArrowRight />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 w-full rounded-full border-white/25 bg-transparent px-7 text-base text-[#f3e7db] hover:bg-white/10 hover:text-white sm:w-auto"
                onClick={handleDemo}
              >
                <PlayCircle />
                Open live demo
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ────────────────────────────────────────────── */}
      <footer className="border-t border-[rgba(124,82,56,0.1)]">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row lg:px-8">
          <div className="flex items-center gap-3">
            <BrandLogo alt="Evidence of Life" className="h-8 w-8" />
            <span className="font-brand text-lg text-[#6f5646]">Evidence of life</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-[#8d7564]">
            <button type="button" className="transition-colors hover:text-[#5d493d]" onClick={() => navigate('/auth')}>
              Sign in
            </button>
            <button type="button" className="transition-colors hover:text-[#5d493d]" onClick={handleDemo}>
              Live demo
            </button>
            <button type="button" className="transition-colors hover:text-[#5d493d]" onClick={handleStart}>
              Start free
            </button>
          </div>
          <p className="text-sm text-[#9a8473]">© {new Date().getFullYear()} Evidence of Life</p>
        </div>
      </footer>
    </div>
  );
}
