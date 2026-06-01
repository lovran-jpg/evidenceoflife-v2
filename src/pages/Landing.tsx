import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Brain,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Images,
  Link2,
  Layers,
  MapPin,
  NotebookPen,
  Pin,
  PlayCircle,
  Repeat,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Timer,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { BrandLogo } from '@/components/BrandLogo';

const steps = [
  {
    number: '01',
    id: 'plan',
    label: 'Plan',
    title: 'Plan the day before it runs away',
    body: 'Put tasks, routines, calendar imports and deadlines onto one living timeline.',
  },
  {
    number: '02',
    id: 'focus',
    label: 'Live',
    title: 'Turn intent into recorded time',
    body: 'Start a focus session from the timeline so the hours you actually live stay attached to the task.',
  },
  {
    number: '03',
    id: 'recap',
    label: 'Capture',
    title: 'Capture the evidence it happened',
    body: 'Add the note, photo, mood, place or link while the memory is still fresh.',
  },
  {
    number: '04',
    id: 'calendar',
    label: 'Revisit',
    title: 'Reopen life by time and place',
    body: 'Plans and moments settle into a day, week, month, year and map you can revisit anytime.',
  },
];

const featurePillars = [
  {
    icon: CalendarClock,
    title: 'Daily command center',
    body: 'Plan, capture, focus and review in one timeline instead of spreading your day across notes, calendar, timers and photos.',
  },
  {
    icon: Brain,
    title: 'Memory-first capture',
    body: 'Moments keep context: notes, photos, mood, place, tags and links, so future-you sees more than a task title.',
  },
  {
    icon: Route,
    title: 'Calendar and map recall',
    body: 'Your life becomes browsable by time and place, with month, year and map views that make recall effortless.',
  },
];

// Modules grouped into three layers so the landing page mirrors the in-app
// mental model: the core loop users must understand first, the evidence types
// that prove a day happened, and the obligations that keep life moving.
const moduleGroups = [
  {
    label: 'Core loop',
    caption: 'The main loop everyone learns first.',
    items: [
      {
        icon: Clock3,
        title: 'Today timeline',
        body: 'A single surface for plans, imported events, todos and recorded moments across your waking hours.',
      },
      {
        icon: Timer,
        title: 'Focus sessions',
        body: 'Log real work time from a pomodoro-style session and attach it to the day it happened.',
      },
      {
        icon: NotebookPen,
        title: 'Fast recaps',
        body: 'Close the loop with short notes, photos, moods and tags without turning journaling into homework.',
      },
      {
        icon: CalendarDays,
        title: 'Calendar and map recall',
        body: 'Revisit your days by time and place, with week, month, year and map views that make recall effortless.',
      },
    ],
  },
  {
    label: 'Evidence types',
    caption: 'The material that proves life happened.',
    items: [
      {
        icon: Images,
        title: 'Photo evidence',
        body: 'Attach visual proof to moments so ordinary days regain texture when you look back.',
      },
      {
        icon: MapPin,
        title: 'Place memory',
        body: 'Tag restaurants, cafes, parks, museums and trips, then rediscover them on a personal map.',
      },
      {
        icon: Link2,
        title: 'Links and references',
        body: 'Save useful links with previews so the references around a day stay connected to the day itself.',
      },
    ],
  },
  {
    label: 'Life obligations',
    caption: 'The things that keep life moving.',
    items: [
      {
        icon: Pin,
        title: 'Deadlines and dues',
        body: 'Track urgent work, multi-step obligations, reminders, photos and links without losing them in notes.',
      },
      {
        icon: Repeat,
        title: 'Habits without guilt',
        body: 'Keep repeatable routines visible as part of life, not as a streak machine designed to shame you.',
      },
    ],
  },
];

const useCases = [
  'People who end the week asking, "What did I actually do?"',
  'Builders, students and freelancers who want proof of progress without a rigid productivity system.',
  'Travelers, parents and reflective people who want memories organized by day and place.',
  'Anyone juggling deadlines, routines, notes and links but wanting one calm daily record.',
];

const outcomes = [
  ['Less reconstruction', 'Stop piecing together your day from calendar events, screenshots and chat history.'],
  ['More honest progress', 'See planned time, focused time and lived moments side by side.'],
  ['A richer archive', 'Turn ordinary days into searchable evidence instead of letting them disappear.'],
];

const marketAngles = [
  ['Against todo apps', 'Todos stop at intention. Evidence of Life keeps intention and outcome together.'],
  ['Against journals', 'Blank pages are high friction. Here, memory grows from the work you already planned and finished.'],
  ['Against habit trackers', 'Streaks optimize compliance. This product preserves context, progress and lived texture.'],
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
      <header className="sticky top-0 z-30 border-b border-[rgba(124,82,56,0.08)] bg-[rgba(248,241,232,0.86)] backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3.5 lg:px-8">
          <button
            type="button"
            className="flex items-center gap-3 text-left"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          >
            <BrandLogo alt="Evidence of Life" className="h-10 w-10" />
            <div className="leading-tight">
              <div className="font-brand text-[22px] text-[#6f5646]">Evidence of life</div>
              <div className="text-xs text-[#9a8473]">Private memory system</div>
            </div>
          </button>

          <nav className="hidden items-center gap-6 text-sm font-medium text-[#7b675a] md:flex">
            <a className="transition-colors hover:text-[#c9784e]" href="#product">Product</a>
            <a className="transition-colors hover:text-[#c9784e]" href="#positioning">Positioning</a>
            <a className="transition-colors hover:text-[#c9784e]" href="#how-it-works">How it works</a>
          </nav>

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

      <main>
        <section className="relative mx-auto max-w-6xl px-6 pb-20 pt-16 text-center lg:px-8 lg:pt-24">
          <div className="pointer-events-none absolute left-1/2 top-[-10%] -z-0 h-[480px] w-[680px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(212,135,95,0.18),transparent)] blur-2xl" />

          <div className="relative mx-auto flex max-w-3xl flex-col items-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,135,95,0.22)] bg-[rgba(255,250,244,0.9)] px-3.5 py-1.5 text-sm font-medium text-[#c9784e] shadow-sm">
              <Sparkles size={14} />
              Don't let your days disappear
            </div>

            <h1 className="mt-7 text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.04em] text-[#2d221d] sm:text-6xl">
              Plan your day.
              <br />
              <span className="text-[#c9784e]">Keep what actually happened.</span>
            </h1>

            <p className="mt-6 max-w-2xl text-pretty text-lg leading-8 text-[#6d594d]">
              Evidence of Life turns your daily plans, work sessions, photos, places, notes, links,
              deadlines and habits into one private record of what actually happened — through a single
              loop: plan the day, live it, capture the evidence, and revisit it later.
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
                Explore live demo
              </Button>
            </div>

            <p className="mt-4 text-sm text-[#9a8473]">
              Free to start. No social feed. Live demo with sample data.
            </p>
          </div>

          <div className="relative mx-auto mt-14 max-w-4xl">
            <div className="overflow-hidden rounded-2xl border border-[rgba(49,36,31,0.12)] bg-[#1b1512] shadow-[0_40px_80px_-32px_rgba(45,34,29,0.55)]">
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
                  Public demo. Sample data.
                </div>
              </div>
            </div>

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

        <section className="border-y border-[rgba(124,82,56,0.08)] bg-[rgba(255,250,244,0.62)]">
          <div className="mx-auto grid max-w-5xl grid-cols-2 gap-6 px-6 py-10 text-center sm:grid-cols-4 lg:px-8">
            {[
              ['Plan', 'tasks, dues and routines on one timeline'],
              ['Live', 'focus sessions record real time'],
              ['Capture', 'notes, photos, places and links'],
              ['Revisit', 'browse by day, year and map'],
            ].map(([stat, label]) => (
              <div key={label}>
                <div className="text-xl font-semibold tracking-tight text-[#c9784e]">{stat}</div>
                <div className="mt-1 text-sm leading-6 text-[#786457]">{label}</div>
              </div>
            ))}
          </div>
        </section>

        <section id="product" className="mx-auto max-w-6xl px-6 py-24 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[rgba(212,135,95,0.12)] px-3 py-1 text-sm font-semibold text-[#c9784e]">
                <Target size={14} />
                Product positioning
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-[#2d221d] sm:text-4xl">
                The personal CRM for your own life
              </h2>
              <p className="mt-4 text-lg leading-8 text-[#6d594d]">
                Most tools ask you to choose: plan in one app, focus in another,
                journal somewhere else, track deadlines in a notes app, save links in a browser,
                then search photos later. Evidence of Life connects those fragments into one
                private product loop: plan, live, remember.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {featurePillars.map((feature) => (
                <div
                  key={feature.title}
                  className="rounded-2xl border border-[rgba(124,82,56,0.1)] bg-[rgba(255,250,244,0.78)] p-5 shadow-[0_18px_48px_-34px_rgba(45,34,29,0.45)]"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgba(212,135,95,0.14)] text-[#c9784e]">
                    <feature.icon size={19} />
                  </div>
                  <h3 className="mt-4 text-base font-semibold text-[#342821]">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[#786457]">{feature.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-14 space-y-12">
            {moduleGroups.map((group) => (
              <div key={group.label}>
                <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-[#c9784e]">
                    {group.label}
                  </h3>
                  <span className="text-sm text-[#9a8473]">{group.caption}</span>
                </div>
                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {group.items.map((feature) => (
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
              </div>
            ))}

            <div className="flex items-center gap-4 rounded-2xl border border-[rgba(124,82,56,0.1)] bg-[rgba(255,250,244,0.78)] p-6">
              <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-[rgba(212,135,95,0.14)] text-[#c9784e]">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-[#342821]">Private by default</h3>
                <p className="mt-1 text-[15px] leading-7 text-[#786457]">
                  Built as a personal memory system, not a social feed and not another public performance layer.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section id="positioning" className="border-t border-[rgba(124,82,56,0.08)] bg-[rgba(255,250,244,0.55)]">
          <div className="mx-auto grid max-w-6xl gap-10 px-6 py-24 lg:grid-cols-[1fr_0.9fr] lg:px-8">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1 text-sm font-semibold text-[#c9784e]">
                <Layers size={14} />
                Marketing angle
              </div>
              <h2 className="mt-5 text-3xl font-semibold tracking-[-0.03em] text-[#2d221d] sm:text-4xl">
                A new category between productivity and memory
              </h2>
              <p className="mt-4 text-lg leading-8 text-[#6d594d]">
                The product is not trying to be therapy, enterprise project management,
                or a public habit leaderboard. It is a calm place to keep receipts for
                what your time became.
              </p>

              <div className="mt-8 grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {marketAngles.map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-[rgba(124,82,56,0.1)] bg-white/70 p-4">
                    <h3 className="font-semibold text-[#342821]">{title}</h3>
                    <p className="mt-2 text-sm leading-6 text-[#786457]">{body}</p>
                  </div>
                ))}
              </div>

              <h3 className="mt-10 text-lg font-semibold text-[#342821]">Best-fit users</h3>
              <div className="mt-4 grid gap-3">
                {useCases.map((useCase) => (
                  <div key={useCase} className="flex gap-3 rounded-2xl border border-[rgba(124,82,56,0.1)] bg-white/70 p-4">
                    <CheckCircle2 className="mt-0.5 h-5 w-5 flex-shrink-0 text-[#c9784e]" />
                    <p className="text-[15px] leading-7 text-[#5d493d]">{useCase}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-3xl border border-[rgba(124,82,56,0.1)] bg-[#2d221d] p-7 text-[#f8f1e8] shadow-[0_34px_70px_-38px_rgba(45,34,29,0.7)]">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-[#d4875f]">Product promise</p>
              <h3 className="mt-4 text-2xl font-semibold tracking-[-0.02em]">
                A daily system that respects ordinary life
              </h3>
              <div className="mt-7 space-y-5">
                {outcomes.map(([title, body]) => (
                  <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5">
                    <h4 className="font-semibold text-white">{title}</h4>
                    <p className="mt-2 text-sm leading-6 text-[#d8c6b8]">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" className="mx-auto max-w-6xl px-6 py-24 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#2d221d] sm:text-4xl">
              One loop: plan, live, remember
            </h2>
            <p className="mt-4 text-lg leading-8 text-[#6d594d]">
              The same day flows forward. You do not leave productivity mode to enter memory mode.
            </p>
          </div>

          <ol className="mt-14 grid gap-3 lg:grid-cols-5">
            {steps.map((step) => (
              <li
                key={step.id}
                className="rounded-2xl border border-[rgba(124,82,56,0.1)] bg-white/70 p-5"
              >
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-[#d4875f] text-base font-semibold text-white">
                  {step.number}
                </div>
                <h3 className="mt-5 text-lg font-semibold text-[#342821]">{step.label}</h3>
                <p className="mt-2 text-sm leading-6 text-[#786457]">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="border-y border-[rgba(124,82,56,0.08)] bg-[rgba(255,250,244,0.58)]">
          <div className="mx-auto max-w-4xl px-6 py-20 text-center lg:px-8">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[rgba(212,135,95,0.14)] text-[#c9784e]">
              <Sparkles size={22} />
            </div>
            <blockquote className="mt-6 text-2xl font-semibold leading-10 tracking-[-0.02em] text-[#342821] sm:text-3xl">
              "Not another productivity app. A way to prove to yourself that the days are adding up."
            </blockquote>
            <p className="mt-4 text-sm font-medium text-[#8d7564]">Core marketing narrative</p>
          </div>
        </section>

        <section className="mx-auto max-w-6xl px-6 py-24 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-[#2d221d] px-8 py-16 text-center shadow-[0_40px_80px_-40px_rgba(45,34,29,0.7)] sm:px-16">
            <div className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(212,135,95,0.35),transparent)] blur-2xl" />
            <div className="relative mx-auto max-w-2xl">
              <h2 className="text-3xl font-semibold tracking-[-0.03em] text-[#f8f1e8] sm:text-4xl">
                Start keeping receipts for your real life
              </h2>
              <p className="mt-4 text-lg leading-8 text-[#d8c6b8]">
                Plan today, capture what actually happened, and let your calendar and map
                quietly become a private archive worth coming back to.
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
                  Try the demo first
                </Button>
              </div>
            </div>
          </div>
        </section>
      </main>

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
