import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import { ArrowLeft, ChevronRight, MapPin, Plus, Trash2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { restaurants } from '@/lib/restaurants';
import { restaurantDeletion } from '@/lib/restaurantDeletion';
import { hasMapLocation } from '@/lib/restaurantMap';
import { restaurantVisits } from '@/lib/restaurantVisits';
import { restaurantVisitPhotos, validateVisitFiles, VisitPhotoError } from '@/lib/restaurantVisitPhotos';
import { optimizeRestaurantPhotos, type OptimizedPhoto } from '@/lib/optimizeRestaurantPhoto';
import { RestaurantShell as Page } from '@/components/RestaurantShell';
import { RestaurantVisitPhoto as VisitPhoto } from '@/components/RestaurantVisitPhoto';
import { createGoogleRestaurantSearch, googleMapsConfig } from '@/lib/googleMapsBrowser';
import type { GoogleRestaurantSuggestion } from '@/lib/googleMapsBrowser';
import type { Restaurant, RestaurantVisit } from '@/lib/restaurantDomain';

const detailPath = (id: string) => `/restaurants/${id}`;
const errorText = (error: unknown) => error instanceof Error ? error.message : 'Pokušajte ponovno.';

function BackLink({ to, label }: { to: string; label: string }) {
  return <Link to={to} className="mb-6 inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={18} />{label}</Link>;
}

function ErrorNotice({ message }: { message: string }) {
  return <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{message}</p>;
}

function LocalPhoto({ file }: { file: File }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return url ? <img src={url} alt={file.name} className="h-24 w-24 rounded-lg object-cover" /> : null;
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

function RestaurantEditor({ userId, edit = false }: { userId: string; edit?: boolean }) {
  const navigate = useNavigate();
  const { restaurantId } = useParams();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [googlePlaceId, setGooglePlaceId] = useState<string | null>(null);
  const [googlePreview, setGooglePreview] = useState<{ name: string; address: string | null } | null>(null);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [suggestions, setSuggestions] = useState<GoogleRestaurantSuggestion[]>([]);
  const [searching, setSearching] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [loading, setLoading] = useState(edit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const search = useRef(createGoogleRestaurantSearch());
  const { apiKey } = googleMapsConfig();

  useEffect(() => {
    if (!edit || !restaurantId) return;
    let active = true;
    void restaurants.get(userId, restaurantId).then(found => {
      if (!active) return;
      if (found) {
        setName(found.name);
        setAddress(found.address ?? '');
        setGooglePlaceId(found.google_place_id);
      } else setError('Restoran nije pronađen.');
    }).catch(cause => { if (active) setError(`Restoran se ne može učitati. ${errorText(cause)}`); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [edit, restaurantId, userId]);

  useEffect(() => {
    if (!apiKey || !searchEnabled || name.trim().length < 3 || googlePreview) { setSuggestions([]); return; }
    let active = true;
    const timer = window.setTimeout(() => {
      setSearching(true);
      void search.current.suggest(name).then(found => { if (active) setSuggestions(found.slice(0, 5)); })
        .catch(cause => { if (active) setError(`Google pretraživanje nije dostupno. ${errorText(cause)}`); })
        .finally(() => { if (active) setSearching(false); });
    }, 350);
    return () => { active = false; window.clearTimeout(timer); };
  }, [apiKey, name, googlePreview, searchEnabled]);

  async function choose(suggestion: GoogleRestaurantSuggestion) {
    if (choosing) return;
    setChoosing(true);
    setError('');
    try {
      const found = await search.current.select(suggestion);
      setGooglePlaceId(found.placeId);
      setGooglePreview({ name: found.name, address: found.address });
      setSuggestions([]);
    } catch (cause) { setError(`Google lokacija nije odabrana. ${errorText(cause)}`); }
    finally { setChoosing(false); }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || choosing || loading) return;
    setError('');
    setSaving(true);
    try {
      const restaurant = edit && restaurantId
        ? await restaurants.update(userId, restaurantId, { name, address: address.trim() || null, google_place_id: googlePlaceId })
        : await restaurants.create(userId, { name,
          ...(address.trim() ? { address: address.trim() } : {}),
          ...(googlePlaceId ? { google_place_id: googlePlaceId } : {}),
        });
      navigate(detailPath(restaurant.id), { replace: true });
    } catch (cause) {
      setError(`Restoran nije spremljen. ${errorText(cause)}`);
      setSaving(false);
    }
  }

  return <Page>
    <BackLink to={edit && restaurantId ? detailPath(restaurantId) : '/restaurants'} label={edit ? 'Natrag na restoran' : 'Svi restorani'} />
    <h1 className="mb-6 text-3xl font-semibold">{edit ? 'Uredi restoran' : 'Novi restoran'}</h1>
    {loading ? <p role="status">Učitavanje restorana…</p> : null}
    {!loading && (!edit || !error || name) ? <form onSubmit={save} className="space-y-6">
      <div className="space-y-2"><Label htmlFor="restaurant-name">Naziv restorana</Label><Input id="restaurant-name" className="h-12" autoFocus required maxLength={160} value={name} onChange={event => { setName(event.target.value); setSearchEnabled(true); setSuggestions([]); }} /></div>
      {apiKey ? <div className="space-y-2">
        <p className="text-sm text-muted-foreground">Google prijedlozi su opcionalni. Sprema se naziv koji sami upišete.</p>
        {searching ? <p role="status" className="text-sm text-muted-foreground">Traženje restorana…</p> : null}
        {suggestions.length ? <div aria-label="Google prijedlozi" className="space-y-1 rounded-xl border p-2">
          {suggestions.map(suggestion => <button key={suggestion.placeId} type="button" disabled={choosing} onClick={() => void choose(suggestion)} className="block min-h-11 w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-muted">{suggestion.label}</button>)}
          <p className="px-3 text-xs text-muted-foreground" aria-label="Google Maps izvor prijedloga">Google Maps</p>
        </div> : null}
        {googlePreview ? <div className="rounded-xl border p-3 text-sm">
          <p>Google lokacija: {googlePreview.name}</p>
          {googlePreview.address ? <p className="text-muted-foreground">{googlePreview.address}</p> : null}
          <p className="mt-1 text-xs text-muted-foreground">Google Maps</p>
          <p className="mt-1 text-xs text-muted-foreground">Sprema se samo Google Place ID. Naziv i adresu za dnevnik upišite sami.</p>
          <Button type="button" variant="outline" className="mt-2 min-h-11" onClick={() => { setGooglePlaceId(null); setGooglePreview(null); }}>Ukloni Google lokaciju</Button>
        </div> : null}
      </div> : <p className="text-sm text-muted-foreground">Google pretraživanje nije dostupno; restoran možete spremiti samo s imenom.</p>}
      <div className="space-y-2"><Label htmlFor="restaurant-address">Adresa (opcionalno, vaš unos)</Label><Input id="restaurant-address" className="h-12" maxLength={300} value={address} onChange={event => setAddress(event.target.value)} /></div>
      {error ? <ErrorNotice message={error} /> : null}
      <div className="sticky bottom-4"><Button size="lg" className="h-12 w-full rounded-xl shadow-lg" disabled={saving || choosing}>{saving ? 'Spremanje…' : edit ? 'Spremi izmjene' : 'Spremi restoran'}</Button></div>
    </form> : error ? <ErrorNotice message={error} /> : null}
  </Page>;
}

function RestaurantDetail({ userId }: { userId: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const cleanupWarning = (location.state as { cleanupWarning?: string } | null)?.cleanupWarning;
  const { restaurantId } = useParams();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [visits, setVisits] = useState<RestaurantVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingRestaurant, setDeletingRestaurant] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

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
    if (!window.confirm('Trajno obrisati ovaj posjet i njegove fotografije?')) return;
    setError('');
    setDeletingId(id);
    try {
      await restaurantVisitPhotos.delete(userId, id);
      setVisits(current => current.filter(visit => visit.id !== id));
    } catch (cause) {
      if (cause instanceof VisitPhotoError && cause.committed) setVisits(current => current.filter(visit => visit.id !== id));
      setError(cause instanceof VisitPhotoError && cause.committed ? errorText(cause) : `Posjet nije obrisan. ${errorText(cause)}`);
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteRestaurant() {
    if (!restaurant || deletingRestaurant) return;
    setError('');
    setDeletingRestaurant(true);
    try {
      await restaurantDeletion.delete(userId, restaurant.id);
      navigate('/restaurants', { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Restoran nije obrisan. Pokušaj ponovno.');
      setDeletingRestaurant(false);
      setDeleteDialogOpen(false);
    }
  }

  const hasLocation = restaurant && (Boolean(restaurant.google_place_id?.trim()) || hasMapLocation(restaurant));

  return <Page>
    <BackLink to="/restaurants" label="Svi restorani" />
    {loading ? <p role="status">Učitavanje restorana…</p> : null}
    {error ? <ErrorNotice message={error} /> : null}
    {cleanupWarning ? <ErrorNotice message={cleanupWarning} /> : null}
    {!loading && !restaurant && !error ? <p role="alert">Restoran nije pronađen.</p> : null}
    {restaurant ? <>
      <h1 className="break-words text-3xl font-semibold">{restaurant.name}</h1>
      {restaurant.address ? <p className="mt-2 text-sm text-muted-foreground">{restaurant.address}</p> : null}
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button asChild className="min-h-11"><Link to={hasLocation ? `/map?restaurantId=${encodeURIComponent(restaurant.id)}` : `${detailPath(restaurant.id)}/edit`}>
          <MapPin aria-hidden="true" />{hasLocation ? 'Prikaži na mapi' : 'Dodaj lokaciju'}
        </Link></Button>
        <Button asChild variant="outline" className="min-h-11"><Link to={`${detailPath(restaurant.id)}/edit`}>Uredi restoran</Link></Button>
      </div>
      <p className="mb-7 mt-2 text-muted-foreground">{visits.length} {visits.length === 1 ? 'posjet' : 'posjeta'}</p>
      <h2 className="mb-4 text-xl font-semibold">Posjeti</h2>
      {visits.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">Još nema posjeta ovom restoranu.</p> : null}
      <div className="space-y-3">
        {visits.map(visit => <article key={visit.id} className="min-w-0 rounded-2xl border border-border bg-card p-4 shadow-sm">
          <time dateTime={visit.date} className="font-semibold">{visit.date}</time>
          {visit.what_i_ate ? <p className="mt-2 break-words">Što sam jeo: {visit.what_i_ate}</p> : null}
          {visit.note ? <p className="mt-2 whitespace-pre-wrap break-words text-muted-foreground">{visit.note}</p> : null}
          {visit.rating != null ? <p className="mt-2 text-sm">Ocjena: {visit.rating}/5</p> : null}
          {visit.photos.length > 0 ? <div className="mt-3 flex max-w-full gap-2 overflow-x-auto pb-2">{visit.photos.map((path, index) => <VisitPhoto key={`${path}-${index}`} userId={userId} path={path} />)}</div> : null}
          <div className="mt-4 flex gap-2 border-t pt-3">
            <Button asChild variant="outline" className="min-h-11 flex-1"><Link to={`${detailPath(restaurant.id)}/visits/${visit.id}/edit`}>Uredi</Link></Button>
            <Button type="button" variant="outline" className="min-h-11 flex-1 text-destructive" disabled={deletingId === visit.id} onClick={() => void deleteVisit(visit.id)}>Obriši</Button>
          </div>
        </article>)}
      </div>
      <AlertDialog open={deleteDialogOpen} onOpenChange={open => { if (!deletingRestaurant) setDeleteDialogOpen(open); }}>
        <AlertDialogTrigger asChild>
          <Button type="button" variant="ghost" className="mt-6 min-h-11 w-full text-destructive hover:bg-destructive/10 hover:text-destructive">
            <Trash2 aria-hidden="true" /> Obriši restoran
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent className="max-w-[calc(100%-2rem)] rounded-2xl sm:max-w-lg">
          <AlertDialogHeader>
            <AlertDialogTitle>Obriši restoran?</AlertDialogTitle>
            <AlertDialogDescription>
              {visits.length === 0
                ? 'Želiš li trajno obrisati ovaj restoran?'
                : `Ovim ćeš trajno obrisati restoran, ${visits.length} posjeta i sve njihove fotografije. Ova radnja se ne može poništiti.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingRestaurant}>Odustani</AlertDialogCancel>
            <AlertDialogAction disabled={deletingRestaurant} onClick={event => { event.preventDefault(); void deleteRestaurant(); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deletingRestaurant ? 'Brisanje…' : 'Trajno obriši'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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
  const [existingPhotos, setExistingPhotos] = useState<string[]>([]);
  const [newPhotos, setNewPhotos] = useState<OptimizedPhoto[]>([]);
  const [preparing, setPreparing] = useState(false);
  const preparingRef = useRef(false);
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
            setExistingPhotos(visit.photos);
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
    if (saving || preparingRef.current || !restaurant) return;
    setError('');
    setSaving(true);
    const values = {
      date,
      what_i_ate: whatIAte.trim() || null,
      note: note.trim() || null,
      rating: rating ? Number(rating) : null,
    };
    try {
      const files = newPhotos.map(photo => photo.file);
      if (edit && visitId) await restaurantVisitPhotos.update(userId, visitId, values, existingPhotos, files);
      else await restaurantVisitPhotos.create(userId, { place_id: restaurant.id, ...values }, files);
      navigate(detailPath(restaurant.id), { replace: true });
    } catch (cause) {
      if (cause instanceof VisitPhotoError && cause.committed) {
        navigate(detailPath(restaurant.id), { replace: true, state: { cleanupWarning: errorText(cause) } });
        return;
      }
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
        <div className="space-y-3">
          <Label htmlFor="visit-photos">Fotografije (do 10, svaka do 5 MB)</Label>
          <Input id="visit-photos" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif" multiple disabled={saving || preparing} className="h-12 pt-2" onChange={event => {
            const selected = Array.from(event.target.files ?? []);
            event.target.value = '';
            if (!selected.length || preparingRef.current) return;
            preparingRef.current = true;
            setPreparing(true);
            setError('');
            void (async () => {
              try {
                if (existingPhotos.length + newPhotos.length + selected.length > 10) throw new Error('Najviše 10 fotografija po posjetu.');
                const prepared = await optimizeRestaurantPhotos(selected);
                validateVisitFiles(prepared.map(photo => photo.file), existingPhotos.length + newPhotos.length);
                setNewPhotos(current => [...current, ...prepared]);
              } catch (cause) { setError(errorText(cause)); }
              finally { preparingRef.current = false; setPreparing(false); }
            })();
          }} />
          {preparing ? <p role="status" className="text-sm text-muted-foreground">Priprema fotografija…</p> : null}
          {(existingPhotos.length > 0 || newPhotos.length > 0) ? <div className="flex max-w-full gap-3 overflow-x-auto pb-2">
            {existingPhotos.map((path, index) => <div key={`${path}-${index}`} className="shrink-0"><VisitPhoto userId={userId} path={path} /><Button type="button" variant="outline" className="mt-1 min-h-11 w-full" onClick={() => setExistingPhotos(current => current.filter((_, i) => i !== index))}>Ukloni</Button></div>)}
            {newPhotos.map((photo, index) => <div key={`${photo.file.name}-${index}`} className="shrink-0"><LocalPhoto file={photo.file} /><p className="mt-1 text-xs text-muted-foreground">{(photo.originalBytes / 1048576).toFixed(1)} → {(photo.optimizedBytes / 1048576).toFixed(1)} MB</p><Button type="button" variant="outline" className="mt-1 min-h-11 w-full" onClick={() => setNewPhotos(current => current.filter((_, i) => i !== index))}>Ukloni</Button></div>)}
          </div> : null}
        </div>
        <div className="sticky bottom-4 pt-3"><Button size="lg" className="h-12 w-full rounded-xl shadow-lg" disabled={saving || preparing}>{preparing ? 'Priprema fotografija…' : saving ? 'Spremanje…' : edit ? 'Spremi izmjene' : 'Spremi posjet'}</Button></div>
      </form>
    </> : null}
  </Page>;
}

export default function Restaurants() {
  const { user, isDemo } = useAuth();
  if (!user || isDemo) return <Page><p role="alert">Prijavite se svojim računom za pristup restoranima.</p></Page>;
  return <Routes>
    <Route index element={<RestaurantList userId={user.id} />} />
    <Route path="new" element={<RestaurantEditor userId={user.id} />} />
    <Route path=":restaurantId" element={<RestaurantDetail userId={user.id} />} />
    <Route path=":restaurantId/edit" element={<RestaurantEditor userId={user.id} edit />} />
    <Route path=":restaurantId/visits/new" element={<VisitForm userId={user.id} edit={false} />} />
    <Route path=":restaurantId/visits/:visitId/edit" element={<VisitForm userId={user.id} edit />} />
    <Route path="*" element={<Page><p role="alert">Stranica nije pronađena.</p></Page>} />
  </Routes>;
}
