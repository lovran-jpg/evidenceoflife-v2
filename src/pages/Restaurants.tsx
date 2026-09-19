import { useEffect, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, ChevronRight, Plus } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { restaurants } from '@/lib/restaurants';
import { restaurantVisits } from '@/lib/restaurantVisits';
import type { Restaurant, RestaurantVisit } from '@/lib/restaurantDomain';

const detailPath = (id: string) => `/restaurants/${id}`;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Pokušajte ponovno.';

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh min-w-0 bg-background text-foreground">
      <header className="border-b border-border/70 bg-background/95 px-4 py-4">
        <div className="mx-auto flex max-w-2xl items-center justify-between gap-3">
          <Link to="/restaurants" className="text-lg font-semibold">Dnevnik restorana</Link>
          <Link to="/app" className="rounded-lg px-3 py-2 text-sm text-muted-foreground hover:text-foreground">Stara aplikacija</Link>
        </div>
      </header>
      <main className="mx-auto w-full max-w-2xl min-w-0 px-4 pb-28 pt-6">{children}</main>
    </div>
  );
}

function BackLink({ to, label }: { to: string; label: string }) {
  return <Link to={to} className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={18} />{label}</Link>;
}

function ErrorNotice({ message }: { message: string }) {
  return <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{message}</p>;
}

function RestaurantList({ userId }: { userId: string }) {
  const [items, setItems] = useState<Array<{ restaurant: Restaurant; visits: RestaurantVisit[] }>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setItems([]);
    setLoading(true);
    setError('');
    async function load() {
      try {
        const found = await restaurants.list(userId);
        const summaries = await Promise.all(found.map(async restaurant => ({
          restaurant, visits: await restaurantVisits.list(userId, restaurant.id),
        })));
        summaries.sort((a, b) => {
          const newestA = a.visits.reduce((date, visit) => visit.date > date ? visit.date : date, '');
          const newestB = b.visits.reduce((date, visit) => visit.date > date ? visit.date : date, '');
          return newestB.localeCompare(newestA) || a.restaurant.id.localeCompare(b.restaurant.id);
        });
        if (active) setItems(summaries);
      } catch (cause) {
        if (active) setError(`Restorani se ne mogu učitati. ${errorText(cause)}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [userId]);

  return (
    <Page>
      <h1 className="mb-2 text-3xl font-semibold">Restorani</h1>
      <p className="mb-6 text-sm text-muted-foreground">Tvoja mjesta i svi posjeti na jednom mjestu.</p>
      {loading ? <p role="status">Učitavanje restorana…</p> : null}
      {error ? <ErrorNotice message={error} /> : null}
      {!loading && !error && items.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">Još nema restorana. Dodaj prvi restoran.</p> : null}
      <div className="space-y-3">
        {items.map(({ restaurant, visits }) => {
          const latest = visits.reduce((date, visit) => visit.date > date ? visit.date : date, '');
          return (
            <Link key={restaurant.id} to={detailPath(restaurant.id)} className="flex min-h-20 items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm hover:border-primary/50">
              <span className="min-w-0">
                <span className="block truncate font-semibold">{restaurant.name}</span>
                <span className="mt-1 block text-sm text-muted-foreground">{visits.length} {visits.length === 1 ? 'posjet' : 'posjeta'}{latest ? ` · Zadnji: ${latest}` : ''}</span>
              </span>
              <ChevronRight className="shrink-0 text-muted-foreground" size={20} />
            </Link>
          );
        })}
      </div>
      <div className="sticky bottom-4 mt-8">
        <Button asChild size="lg" className="h-12 w-full rounded-xl shadow-lg"><Link to="/restaurants/new"><Plus /> Novi restoran</Link></Button>
      </div>
    </Page>
  );
}

function NewRestaurant({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setError('');
    setSaving(true);
    try {
      const restaurant = await restaurants.create(userId, { name });
      navigate(detailPath(restaurant.id), { replace: true });
    } catch (cause) {
      setError(`Restoran nije spremljen. ${errorText(cause)}`);
      setSaving(false);
    }
  }

  return <Page>
    <BackLink to="/restaurants" label="Svi restorani" />
    <h1 className="mb-6 text-3xl font-semibold">Novi restoran</h1>
    <form onSubmit={save} className="space-y-6">
      <div className="space-y-2"><Label htmlFor="restaurant-name">Naziv restorana</Label><Input id="restaurant-name" className="h-12" autoFocus required maxLength={160} value={name} onChange={event => setName(event.target.value)} /></div>
      {error ? <ErrorNotice message={error} /> : null}
      <div className="sticky bottom-4"><Button size="lg" className="h-12 w-full rounded-xl shadow-lg" disabled={saving}>{saving ? 'Spremanje…' : 'Spremi restoran'}</Button></div>
    </form>
  </Page>;
}

function RestaurantDetail({ userId }: { userId: string }) {
  const { restaurantId } = useParams();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [visits, setVisits] = useState<RestaurantVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setRestaurant(null);
    setVisits([]);
    setError('');
    if (!restaurantId) { setLoading(false); return; }
    async function load() {
      try {
        const found = await restaurants.get(userId, restaurantId!);
        if (!found) { if (active) setRestaurant(null); return; }
        const foundVisits = await restaurantVisits.list(userId, found.id);
        if (active) {
          setRestaurant(found);
          setVisits([...foundVisits].sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)));
        }
      } catch (cause) {
        if (active) setError(`Podaci se ne mogu učitati. ${errorText(cause)}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [restaurantId, userId]);

  async function deleteVisit(id: string) {
    if (!window.confirm('Trajno obrisati ovaj posjet?')) return;
    setError('');
    setDeletingId(id);
    try {
      await restaurantVisits.delete(userId, id);
      setVisits(current => current.filter(visit => visit.id !== id));
    } catch (cause) {
      setError(`Posjet nije obrisan. ${errorText(cause)}`);
    } finally {
      setDeletingId(null);
    }
  }

  return <Page>
    <BackLink to="/restaurants" label="Svi restorani" />
    {loading ? <p role="status">Učitavanje restorana…</p> : null}
    {error ? <ErrorNotice message={error} /> : null}
    {!loading && !restaurant && !error ? <p role="alert">Restoran nije pronađen.</p> : null}
    {restaurant ? <>
      <h1 className="break-words text-3xl font-semibold">{restaurant.name}</h1>
      <p className="mb-7 mt-2 text-muted-foreground">{visits.length} {visits.length === 1 ? 'posjet' : 'posjeta'}</p>
      <h2 className="mb-4 text-xl font-semibold">Posjeti</h2>
      {visits.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">Još nema posjeta ovom restoranu.</p> : null}
      <div className="space-y-3">
        {visits.map(visit => <article key={visit.id} className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <time dateTime={visit.date} className="font-semibold">{visit.date}</time>
          {visit.what_i_ate ? <p className="mt-2 break-words">Što sam jeo: {visit.what_i_ate}</p> : null}
          {visit.note ? <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{visit.note}</p> : null}
          {visit.rating != null ? <p className="mt-2 text-sm">Ocjena: {visit.rating}/5</p> : null}
          {visit.photos.length > 0 ? <p className="mt-2 text-sm text-muted-foreground">Fotografija: {visit.photos.length}</p> : null}
          <div className="mt-4 flex gap-2 border-t pt-3">
            <Button asChild variant="outline" className="min-h-11 flex-1"><Link to={`${detailPath(restaurant.id)}/visits/${visit.id}/edit`}>Uredi</Link></Button>
            <Button type="button" variant="outline" className="min-h-11 flex-1 text-destructive" disabled={deletingId === visit.id} onClick={() => void deleteVisit(visit.id)}>Obriši</Button>
          </div>
        </article>)}
      </div>
      <div className="sticky bottom-4 mt-8"><Button asChild size="lg" className="h-12 w-full rounded-xl shadow-lg"><Link to={`${detailPath(restaurant.id)}/visits/new`}><Plus /> Dodaj posjet</Link></Button></div>
    </> : null}
  </Page>;
}

function VisitForm({ userId, edit }: { userId: string; edit: boolean }) {
  const { restaurantId, visitId } = useParams();
  const navigate = useNavigate();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [date, setDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [whatIAte, setWhatIAte] = useState('');
  const [note, setNote] = useState('');
  const [rating, setRating] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    setRestaurant(null);
    setError('');
    if (!restaurantId) { setLoading(false); return; }
    async function load() {
      try {
        const found = await restaurants.get(userId, restaurantId!);
        if (!found) return;
        if (edit) {
          const visit = visitId ? await restaurantVisits.get(userId, visitId) : null;
          if (!visit || visit.place_id !== found.id) return;
          if (active) {
            setDate(visit.date);
            setWhatIAte(visit.what_i_ate ?? '');
            setNote(visit.note ?? '');
            setRating(visit.rating?.toString() ?? '');
          }
        }
        if (active) setRestaurant(found);
      } catch (cause) {
        if (active) setError(`Podaci se ne mogu učitati. ${errorText(cause)}`);
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [edit, restaurantId, userId, visitId]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || !restaurant) return;
    setError('');
    setSaving(true);
    const values = {
      date,
      what_i_ate: whatIAte.trim() || null,
      note: note.trim() || null,
      rating: rating ? Number(rating) : null,
    };
    try {
      if (edit && visitId) await restaurantVisits.update(userId, visitId, values);
      else await restaurantVisits.create(userId, { place_id: restaurant.id, ...values });
      navigate(detailPath(restaurant.id), { replace: true });
    } catch (cause) {
      setError(`Posjet nije spremljen. ${errorText(cause)}`);
      setSaving(false);
    }
  }

  return <Page>
    <BackLink to={restaurantId ? detailPath(restaurantId) : '/restaurants'} label="Natrag na restoran" />
    {loading ? <p role="status">Učitavanje…</p> : null}
    {!loading && !restaurant && !error ? <p role="alert">Restoran ili posjet nije pronađen.</p> : null}
    {error ? <ErrorNotice message={error} /> : null}
    {restaurant ? <>
      <p className="mb-1 break-words text-sm text-muted-foreground">{restaurant.name}</p>
      <h1 className="mb-6 text-3xl font-semibold">{edit ? 'Uredi posjet' : 'Novi posjet'}</h1>
      <form onSubmit={save} className="space-y-5">
        <div className="space-y-2"><Label htmlFor="visit-date">Datum</Label><Input id="visit-date" type="date" required className="h-12" value={date} onChange={event => setDate(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="visit-food">Što sam jeo</Label><Input id="visit-food" className="h-12" value={whatIAte} onChange={event => setWhatIAte(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="visit-note">Dojam / bilješka</Label><Textarea id="visit-note" className="min-h-28 text-base" value={note} onChange={event => setNote(event.target.value)} /></div>
        <div className="space-y-2"><Label htmlFor="visit-rating">Ocjena</Label><select id="visit-rating" className="h-12 w-full rounded-md border border-input bg-background px-3 text-base" value={rating} onChange={event => setRating(event.target.value)}><option value="">Bez ocjene</option>{[1, 2, 3, 4, 5].map(value => <option key={value} value={value}>{value} / 5</option>)}</select></div>
        <div className="sticky bottom-4 pt-3"><Button size="lg" className="h-12 w-full rounded-xl shadow-lg" disabled={saving}>{saving ? 'Spremanje…' : edit ? 'Spremi izmjene' : 'Spremi posjet'}</Button></div>
      </form>
    </> : null}
  </Page>;
}

export default function Restaurants() {
  const { user, isDemo } = useAuth();
  if (!user || isDemo) return <Page><p role="alert">Prijavite se svojim računom za pristup restoranima.</p></Page>;
  return <Routes>
    <Route index element={<RestaurantList userId={user.id} />} />
    <Route path="new" element={<NewRestaurant userId={user.id} />} />
    <Route path=":restaurantId" element={<RestaurantDetail userId={user.id} />} />
    <Route path=":restaurantId/visits/new" element={<VisitForm userId={user.id} edit={false} />} />
    <Route path=":restaurantId/visits/:visitId/edit" element={<VisitForm userId={user.id} edit />} />
    <Route path="*" element={<Page><p role="alert">Stranica nije pronađena.</p></Page>} />
  </Routes>;
}
