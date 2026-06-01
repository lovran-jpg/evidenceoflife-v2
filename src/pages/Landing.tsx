import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, PlayCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { trackEvent } from '@/lib/analytics';
import { BrandLogo } from '@/components/BrandLogo';

const supportingLines = [
  'Tasks, focus sessions, moments, and places live in one day view.',
  'You can move from plan to recap without switching mental modes.',
  'Calendar and map let the same day come back later as memory.',
];

const steps = [
  {
    number: '01',
    id: 'plan',
    label: 'Plan',
    title: 'Plan the day',
    body: 'Type a task, drag it into the timeline, and surface upcoming deadlines in the same flow.',
  },
  {
    number: '02',
    id: 'focus',
    label: 'Focus',
    title: 'Start a real focus session',
    body: 'Tap the pomodoro timer so actual time starts accumulating inside the same day view.',
  },
  {
    number: '03',
    id: 'recap',
    label: 'Recap',
    title: 'Recap with notes, photos, and places',
    body: 'End the session, add a quick note, drop in a location or photo, and turn the task into memory.',
  },
  {
    number: '04',
    id: 'calendar',
    label: 'Calendar',
    title: 'See the week fill in',
    body: 'Watch planned and recorded moments settle into a fuller calendar view.',
  },
  {
    number: '05',
    id: 'map',
    label: 'Map',
    title: 'Replay where life happened',
    body: 'Locations from recap flow into the map so the day becomes a place-based memory trail.',
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
    trackEvent('landing_page_view', {
      page: '/',
    });
  }, []);

  const handleStart = () => {
    trackEvent('landing_cta_clicked', {
      cta: 'start_free',
      page: '/',
    });
    navigate('/auth');
  };

  const handleDemo = () => {
    trackEvent('landing_cta_clicked', {
      cta: 'open_demo',
      page: '/',
    });
    navigate('/demo-app');
  };

  return (
    <div className="min-h-screen overflow-x-hidden bg-[#f8f1e8] text-[#2d221d]">
      <div className="mx-auto max-w-[1400px] px-6 pb-16 pt-6 sm:px-8 lg:px-10">
        <header className="mb-10 flex items-center justify-between border-b border-[rgba(124,82,56,0.10)] pb-5">
          <div className="flex items-center gap-3">
            <BrandLogo alt="Evidence of Life" className="h-12 w-12" />
            <div>
              <div className="font-brand text-[26px] leading-none text-[#6f5646]">Evidence of life</div>
              <div className="text-sm text-[#8d7564]">A memory-first daily life tracker</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="ghost" className="rounded-full px-4 text-[#8d7564]" onClick={() => navigate('/auth')}>
              Sign in
            </Button>
            <Button className="rounded-full bg-[#d4875f] px-5 text-white hover:bg-[#c9784e]" onClick={handleStart}>
              Start free
            </Button>
          </div>
        </header>

        <section className="grid items-start gap-14 lg:grid-cols-[0.74fr_1.26fr]">
          <div className="max-w-xl space-y-8 pt-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(212,135,95,0.18)] bg-[rgba(255,250,244,0.78)] px-3 py-1 text-sm text-[#d4875f]">
              <Sparkles size={14} />
              Don&apos;t let your days disappear
            </div>

            <div className="space-y-6">
              <h1 className="max-w-[10ch] text-5xl font-semibold leading-[0.96] tracking-[-0.055em] text-[#2d221d] sm:text-[5.25rem]">
                Plan your day.
                <br />
                Capture what actually happened.
              </h1>
              <p className="max-w-[32rem] text-[1.2rem] leading-9 text-[#6d594d]">
                A memory-first daily tracker for the parts of life that usually get split across tasks, notes, photos, places, and half-remembered moments.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Button size="lg" className="h-12 rounded-full bg-[#d4875f] px-6 text-base text-white hover:bg-[#c9784e]" onClick={handleStart}>
                Create account
                <ArrowRight />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="h-12 rounded-full border-[rgba(111,86,70,0.26)] bg-white/92 px-6 text-base text-[#5d493d]"
                onClick={handleDemo}
              >
                <PlayCircle />
                Open live demo
              </Button>
            </div>

            <div className="space-y-3 border-l border-[rgba(124,82,56,0.14)] pl-5">
              {supportingLines.map((line) => (
                <p key={line} className="max-w-[28rem] text-[15px] leading-7 text-[#786457]">
                  {line}
                </p>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[36px] border border-[rgba(124,82,56,0.10)] bg-[rgba(255,250,244,0.72)] p-5">
              <div className="rounded-[30px] border border-[rgba(49,36,31,0.10)] bg-[#d8cec1] p-3">
                  <div className="rounded-[28px] border border-[rgba(49,36,31,0.12)] bg-[#2b221d] p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                    <div className="mb-3 flex items-center gap-2 rounded-[18px] bg-[#382e29] px-3 py-2">
                      <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                      <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                      <div className="ml-2 flex-1 rounded-full bg-[#4a3f39] px-4 py-1 text-center text-[11px] text-[#e3d7cc]">
                        evidenceoflife.app/demo
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-[24px] border border-[rgba(227,215,204,0.12)] bg-[#171210]">
                      <div className="relative aspect-[16/10] overflow-hidden">
                        <div className="absolute left-4 top-4 z-10 rounded-full border border-[rgba(223,154,118,0.24)] bg-[rgba(23,18,16,0.76)] px-3 py-1.5 text-[11px] font-medium text-[#f4dfd1] shadow-[0_10px_24px_-16px_rgba(0,0,0,0.45)]">
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
                        <div className="pointer-events-none absolute bottom-4 left-4 z-10 rounded-full border border-[rgba(223,154,118,0.18)] bg-[rgba(23,18,16,0.76)] px-3 py-1 text-[10px] font-medium text-[#f4dfd1] shadow-[0_10px_24px_-16px_rgba(0,0,0,0.45)]">
                          Public demo only. Sample data.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            <div className="rounded-[28px] border border-[rgba(124,82,56,0.08)] bg-[rgba(255,250,244,0.84)] px-5 py-4">
              <div className="flex flex-wrap gap-2">
                {steps.map((step) => (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepIndex(steps.findIndex((item) => item.id === step.id))}
                    className={`rounded-full px-4 py-2 text-sm transition-colors ${
                      step.id === activeStep.id
                        ? 'bg-[#d4875f] text-white'
                        : 'bg-[rgba(255,255,255,0.7)] text-[#7b675a]'
                    }`}
                  >
                    {step.number}. {step.label}
                  </button>
                ))}
              </div>
              <div className="mt-4 max-w-2xl">
                <p className="text-lg font-medium text-[#342821]">{activeStep.title}</p>
                <p className="mt-1 text-[15px] leading-7 text-[#786457]">{activeStep.body}</p>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
