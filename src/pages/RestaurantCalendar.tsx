import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { RestaurantShell } from '@/components/RestaurantShell';
import { RestaurantVisitPhoto } from '@/components/RestaurantVisitPhoto';
import { restaurantCalendar, dateKey, localTodayKey, monthCells, shiftMonth } from '@/lib/restaurantCalendar';
import type { CalendarMonth, CalendarVisit } from '@/lib/restaurantCalendar';
import { Button } from '@/components/ui/button';

const weekdays = ['pon', 'uto', 'sri', 'čet', 'pet', 'sub', 'ned'];

function dateForLabel(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function dayLabel(key: string): string {
  return new Intl.DateTimeFormat('hr-HR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }).format(dateForLabel(key));
}

function monthLabel(month: CalendarMonth): string {
  return new Intl.DateTimeFormat('hr-HR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(dateForLabel(dateKey(month.year, month.month, 1)));
}

function VisitCard({ item, userId }: { item: CalendarVisit; userId: string }) {
  const { visit, restaurant } = item;
  const note = visit.note && visit.note.length > 160 ? `${visit.note.slice(0, 160)}…` : visit.note;
  return <article className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
    <div className="flex min-w-0 gap-3">
      <div className="min-w-0 flex-1">
        <Link to={`/restaurants/${restaurant.id}`} className="inline-flex min-h-11 items-center break-words font-semibold text-primary underline-offset-2 hover:underline">{restaurant.name}</Link>
        <time dateTime={visit.date} className="block text-sm text-muted-foreground">{dayLabel(visit.date)}</time>
        {visit.what_i_ate ? <p className="mt-2 break-words text-sm">Što sam jeo: {visit.what_i_ate}</p> : null}
        {visit.rating != null ? <p className="mt-2 text-sm">Ocjena: {visit.rating}/5</p> : null}
        {note ? <p className="mt-2 whitespace-pre-wrap break-words text-sm text-muted-foreground">{note}</p> : null}
      </div>
      {visit.photos[0] ? <div className="shrink-0"><RestaurantVisitPhoto userId={userId} path={visit.photos[0]} small /></div> : null}
    </div>
  </article>;
}

export default function RestaurantCalendar() {
  const { user, isDemo } = useAuth();
  const [today] = useState(() => localTodayKey());
  const [month, setMonth] = useState<CalendarMonth>(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });
  const [selected, setSelected] = useState(() => localTodayKey());
  const [items, setItems] = useState<CalendarVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const userId = user?.id;
  const visibleYear = month.year;
  const visibleMonth = month.month;

  useEffect(() => {
    if (!userId || isDemo) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    setItems([]);
    setError('');
    void restaurantCalendar.listMonth(userId, { year: visibleYear, month: visibleMonth }).then(found => {
      if (active) setItems(found);
    }).catch(cause => {
      if (active) setError(`Kalendar se ne može učitati. ${cause instanceof Error ? cause.message : 'Pokušajte ponovno.'}`);
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, isDemo, visibleYear, visibleMonth]);

  const cells = useMemo(() => monthCells(month), [month]);
  const counts = useMemo(() => {
    const found = new Map<string, number>();
    for (const item of items) found.set(item.visit.date, (found.get(item.visit.date) ?? 0) + 1);
    return found;
  }, [items]);
  const selectedVisits = items.filter(item => item.visit.date === selected);

  function moveMonth(offset: number) {
    const next = shiftMonth(month, offset);
    setMonth(next);
    setSelected(dateKey(next.year, next.month, 1));
  }

  if (!user || isDemo) return <RestaurantShell><p role="alert">Prijavite se svojim računom za pristup kalendaru.</p></RestaurantShell>;

  return <RestaurantShell>
    <h1 className="mb-5 text-3xl font-semibold">Kalendar</h1>
    <section aria-label="Mjesečni kalendar" className="rounded-2xl border border-border bg-card p-3 shadow-sm sm:p-4">
      <div className="mb-4 flex items-center justify-between gap-2">
        <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Prethodni mjesec" onClick={() => moveMonth(-1)}><ChevronLeft size={20} /></Button>
        <h2 className="text-center text-lg font-semibold capitalize" aria-live="polite">{monthLabel(month)}</h2>
        <Button type="button" variant="outline" size="icon" className="h-11 w-11 shrink-0" aria-label="Sljedeći mjesec" onClick={() => moveMonth(1)}><ChevronRight size={20} /></Button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground">
        {weekdays.map(day => <span key={day} className="py-2">{day}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((key, index) => key ? <button key={key} type="button" aria-label={`${dayLabel(key)}${counts.has(key) ? `, ${counts.get(key)} ${counts.get(key) === 1 ? 'posjet' : 'posjeta'}` : ''}`} aria-pressed={selected === key} onClick={() => setSelected(key)} className={`flex min-h-12 min-w-0 flex-col items-center justify-center rounded-xl text-sm transition-colors ${selected === key ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'} ${today === key ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : ''}`}>
          <span>{Number(key.slice(-2))}</span>
          {counts.has(key) ? <span aria-hidden="true" className={`mt-1 h-1.5 w-1.5 rounded-full ${selected === key ? 'bg-primary-foreground' : 'bg-primary'}`} /> : null}
        </button> : <span key={`blank-${index}`} aria-hidden="true" />)}
      </div>
    </section>
    {loading ? <p role="status" className="mt-6">Učitavanje posjeta…</p> : null}
    {error ? <p role="alert" className="mt-6 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}
    {!loading && !error ? <section aria-label="Posjeti odabranog dana" className="mt-7">
      <h2 className="mb-4 text-xl font-semibold capitalize">{dayLabel(selected)}</h2>
      {items.length === 0 ? <p className="mb-3 text-sm text-muted-foreground">Ovaj mjesec nema posjeta.</p> : null}
      {selectedVisits.length === 0 ? <p className="rounded-2xl border border-dashed p-5 text-muted-foreground">Nema posjeta ovog dana.</p> : <div className="space-y-3">{selectedVisits.map(item => <VisitCard key={item.visit.id} item={item} userId={user.id} />)}</div>}
    </section> : null}
  </RestaurantShell>;
}
