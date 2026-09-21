import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { RestaurantShell } from '@/components/RestaurantShell';
import { Button } from '@/components/ui/button';
import { restaurantMap } from '@/lib/restaurantMap';
import type { MappedRestaurant } from '@/lib/restaurantMap';
import { fetchGooglePlaceLocation, googleMapsConfig, loadGoogleMaps } from '@/lib/googleMapsBrowser';
import { formatCroatianDate } from '@/lib/croatianDate';
import { visitCountLabel } from '@/lib/restaurantUi';

function GoogleRestaurantMap({ items, focusId, onSelect }: { items: MappedRestaurant[]; focusId: string | null; onSelect: (id: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!container.current || !items.length) return;
    const { mapId } = googleMapsConfig();
    if (!mapId) { setError('Google karta trenutačno nije dostupna.'); return; }
    let active = true;
    const markerCleanup: Array<() => void> = [];
    setError('');
    void loadGoogleMaps().then(async google => {
      const [maps, markerLibrary, core] = await Promise.all([
        google.importLibrary('maps'), google.importLibrary('marker'), google.importLibrary('core'),
      ]);
      if (!active || !container.current) return;
      const focused = items.find(item => item.restaurant.id === focusId);
      const center = focused ?? items[0];
      const map = new maps.Map(container.current, {
        center: { lat: center.lat, lng: center.lng }, zoom: focused ? 16 : 12, mapId,
        mapTypeControl: false, streetViewControl: false,
      });
      const bounds = !focused && items.length > 1 ? new core.LatLngBounds() : null;
      for (const item of items) {
        const position = { lat: item.lat, lng: item.lng };
        const marker = new markerLibrary.AdvancedMarkerElement({ map, position, title: item.restaurant.name });
        const listener = marker.addListener('click', () => onSelect(item.restaurant.id));
        // Retain the marker itself for cleanup without exposing it to React state.
        markerCleanup.push(() => { listener.remove(); marker.map = null; });
        bounds?.extend(position);
      }
      if (bounds) map.fitBounds(bounds, 48);
    }).catch(() => { if (active) setError('Google karta trenutačno nije dostupna. Pokušaj ponovno kasnije.'); });
    return () => { active = false; markerCleanup.forEach(cleanup => cleanup()); };
  }, [items, focusId, onSelect]);

  return <>
    {error ? <p role="alert" className="mb-3 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}
    <div ref={container} role="img" aria-label="Karta restorana" className="h-[55dvh] min-h-80 w-full rounded-2xl border border-border bg-muted" />
  </>;
}

function RestaurantMapCard({ item, onClose }: { item: MappedRestaurant; onClose: () => void }) {
  return <section
    aria-label="Odabrani restoran"
    aria-live="polite"
    className="absolute inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-10 max-h-[45dvh] overflow-y-auto rounded-2xl border border-border bg-card/95 p-4 pr-14 shadow-lg backdrop-blur"
  >
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label="Zatvori karticu restorana"
      onClick={onClose}
      className="absolute right-2 top-2 min-h-11 min-w-11 rounded-full"
    >
      <X aria-hidden="true" />
    </Button>
    <h2 className="text-lg font-semibold [overflow-wrap:anywhere]">{item.restaurant.name}</h2>
    {item.restaurant.address ? <p className="mt-1 text-sm text-muted-foreground [overflow-wrap:anywhere]">{item.restaurant.address}</p> : null}
    <p className="mt-2 text-sm">{item.visitCount > 0 ? visitCountLabel(item.visitCount) : 'Još nema posjeta'}</p>
    {item.lastVisit ? <p className="mt-1 text-sm">Zadnji posjet: {formatCroatianDate(item.lastVisit)}</p> : null}
    <Button asChild className="mt-4 min-h-11 w-full rounded-xl">
      <Link to={`/restaurants/${item.restaurant.id}`}>Otvori restoran</Link>
    </Button>
  </section>;
}

export default function RestaurantMap() {
  const { user, isDemo } = useAuth();
  const [searchParams] = useSearchParams();
  const focusId = searchParams.get('restaurantId');
  const userId = user?.id;
  const [items, setItems] = useState<MappedRestaurant[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!userId || isDemo) { setLoading(false); return; }
    let active = true;
    setLoading(true);
    setError('');
    setItems([]);
    void restaurantMap.list(userId, fetchGooglePlaceLocation).then(found => { if (active) setItems(found); })
      .catch(() => { if (active) setError('Mapa se ne može učitati. Provjeri vezu i pokušaj ponovno.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId, isDemo]);

  useEffect(() => {
    // Apply the deep link once per query/data change; manual pin selection stays free.
    setSelectedId(items.find(item => item.restaurant.id === focusId)?.restaurant.id ?? null);
  }, [items, focusId]);

  if (!user || isDemo) return <RestaurantShell><p role="alert">Prijavite se svojim računom za pristup mapi.</p></RestaurantShell>;
  const selected = items.find(item => item.restaurant.id === selectedId);
  const missingFocus = focusId && !items.some(item => item.restaurant.id === focusId);

  return <RestaurantShell>
    <h1 className="mb-2 text-3xl font-semibold">Mapa</h1>
    <p className="mb-6 text-sm text-muted-foreground">Prikazani su tvoji restorani s lokacijom. Restorani bez lokacije ostaju dostupni na popisu.</p>
    {loading ? <p role="status">Učitavanje mape…</p> : null}
    {error ? <p role="alert" className="rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}
    {!loading && !error && missingFocus ? <p role="status" className="mb-4 rounded-xl border border-border bg-muted p-4 text-sm">Traženi restoran nije pronađen ili nema dostupnu lokaciju.</p> : null}
    {!loading && !error && items.length === 0 ? <p className="rounded-2xl border border-dashed p-6 text-muted-foreground">Još nema restorana s lokacijom. Restoran možeš spremiti i bez nje.</p> : null}
    {!loading && !error && items.length > 0 ? <>
      <div className="relative min-w-0">
        <GoogleRestaurantMap items={items} focusId={focusId} onSelect={setSelectedId} />
        {selected ? <RestaurantMapCard item={selected} onClose={() => setSelectedId(null)} /> : null}
      </div>
      <div className="mt-4 flex flex-wrap gap-2" aria-label="Restorani na mapi">
        {items.map(item => <button type="button" key={item.restaurant.id} onClick={() => setSelectedId(item.restaurant.id)} className="max-w-full min-h-11 rounded-xl border border-border px-3 py-2 text-sm [overflow-wrap:anywhere] hover:bg-muted">{item.restaurant.name}</button>)}
      </div>
    </> : null}
  </RestaurantShell>;
}
