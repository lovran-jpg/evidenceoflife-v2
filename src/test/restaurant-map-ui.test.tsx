import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { MappedRestaurant } from '@/lib/restaurantMap';
import RestaurantMap from '@/pages/RestaurantMap';

const alice = '11111111-1111-4111-8111-111111111111';
const state = vi.hoisted(() => ({
  items: [] as MappedRestaurant[], callbacks: [] as Array<() => void>, fail: false,
  imports: [] as string[], markers: [] as Array<{ lat: number; lng: number }>,
  bounds: [] as Array<{ lat: number; lng: number }>, fitBounds: vi.fn(),
  mapOptions: [] as Array<{ center: { lat: number; lng: number }; zoom: number }>,
  dataGate: null as Promise<void> | null, mapsGate: null as Promise<void> | null,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: alice }, isDemo: false }) }));
vi.mock('@/lib/restaurantMap', () => ({ restaurantMap: {
  list: vi.fn(async () => { await state.dataGate; if (state.fail) throw new Error('Query failed'); return state.items; }),
} }));
vi.mock('@/lib/googleMapsBrowser', () => ({
  googleMapsConfig: () => ({ apiKey: 'test', mapId: 'test-map-id' }),
  fetchGooglePlaceLocation: vi.fn(),
  loadGoogleMaps: vi.fn(async () => { await state.mapsGate; return { importLibrary: async (name: string) => {
    state.imports.push(name);
    if (name === 'maps') return { Map: class {
      constructor(_element: HTMLElement, options: { center: { lat: number; lng: number }; zoom: number }) { state.mapOptions.push(options); }
      fitBounds = state.fitBounds;
    } };
    if (name === 'core') return { LatLngBounds: class { extend(point: { lat: number; lng: number }) { state.bounds.push(point); } } };
    return { AdvancedMarkerElement: class {
      map = {};
      constructor(options: { title: string; position: { lat: number; lng: number } }) {
        state.markers.push(options.position);
      }
      addListener(_event: string, callback: () => void) {
        state.callbacks.push(callback);
        return { remove() {} };
      }
    } };
  } }; }),
}));

function item(id: string, name: string, visitCount = 0): MappedRestaurant {
  return { restaurant: { id, name, category: 'restaurant', user_id: alice, city_id: null,
    lat: 45.8, lng: 15.9, address: 'Zagreb', google_place_id: null, created_at: '' },
  lat: 45.8, lng: 15.9, visitCount, lastVisit: visitCount ? '2026-09-19' : null };
}

function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return <>
    <output data-testid="route">{location.pathname}{location.search}</output>
    <button onClick={() => navigate('/map?restaurantId=second')}>Focus second</button>
    <button onClick={() => navigate('/map?restaurantId=missing')}>Focus missing</button>
    <button onClick={() => navigate(-1)}>Browser Back</button>
  </>;
}
function open(path = '/map') {
  render(<MemoryRouter initialEntries={[path]}><Location /><Routes>
    <Route path="/map" element={<RestaurantMap />} />
    <Route path="/restaurants/:restaurantId" element={<p>Detalj</p>} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  state.items = []; state.callbacks = []; state.fail = false;
  state.imports = []; state.markers = []; state.bounds = [];
  state.mapOptions = []; state.dataGate = null; state.mapsGate = null;
  vi.clearAllMocks();
});

describe('Restaurant V1 map', () => {
  it('shows an empty state without loading Google when no restaurant has a location', async () => {
    open();
    expect(await screen.findByText(/Još nema restorana s lokacijom/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Karta restorana' })).not.toBeInTheDocument();
    expect(state.imports).toEqual([]);
  });

  it('loads core before constructing bounds, then creates a pin for each located restaurant and fits two pins', async () => {
    state.items = [item('first', 'Bistro'), item('second', 'Bistro')];
    open();
    await waitFor(() => expect(state.markers).toHaveLength(2));
    expect(state.imports).toEqual(expect.arrayContaining(['maps', 'marker', 'core']));
    expect(state.bounds).toHaveLength(2);
    expect(state.fitBounds).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the initial zoom for a single pin', async () => {
    state.items = [item('only', 'Bistro')];
    open();
    await waitFor(() => expect(state.markers).toHaveLength(1));
    expect(state.fitBounds).not.toHaveBeenCalled();
    expect(state.bounds).toEqual([]);
  });

  it('keeps equal names separate and a pin opens the correct Restaurant ID', async () => {
    state.items = [item('first', 'Bistro', 2), item('second', 'Bistro', 1)];
    open();
    expect(await screen.findByRole('img', { name: 'Karta restorana' })).toBeInTheDocument();
    await waitFor(() => expect(state.callbacks).toHaveLength(2));
    act(() => state.callbacks[0]());
    expect(await screen.findByText('Zadnji posjet: 19. 9. 2026.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Otvori restoran' })).toHaveAttribute('href', '/restaurants/first');
    fireEvent.click(screen.getAllByRole('button', { name: 'Bistro' })[1]);
    expect(screen.getByRole('link', { name: 'Otvori restoran' })).toHaveAttribute('href', '/restaurants/second');
    fireEvent.click(screen.getByRole('link', { name: 'Otvori restoran' }));
    expect(screen.getByTestId('route')).toHaveTextContent('/restaurants/second');
  });

  it('shows a data error clearly', async () => {
    state.fail = true;
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Mapa se ne može učitati');
    expect(screen.queryByText('Query failed')).not.toBeInTheDocument();
  });

  it('focuses the requested ID among equal names and automatically opens its card', async () => {
    state.items = [item('first', 'Bistro', 2), { ...item('second', 'Bistro', 1), lat: 45.29, lng: 14.27 }];
    open('/map?restaurantId=second');

    await waitFor(() => expect(state.markers).toHaveLength(2));
    expect(state.mapOptions[0]).toMatchObject({ center: { lat: 45.29, lng: 14.27 }, zoom: 16 });
    expect(state.fitBounds).not.toHaveBeenCalled();
    const card = screen.getByRole('region', { name: 'Odabrani restoran' });
    expect(within(card).getByText('1 posjet')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: 'Otvori restoran' })).toHaveAttribute('href', '/restaurants/second');

    // Selecting another pin must remain possible without recreating or recentering the map.
    act(() => state.callbacks[0]());
    expect(screen.getByRole('link', { name: 'Otvori restoran' })).toHaveAttribute('href', '/restaurants/first');
    expect(state.mapOptions).toHaveLength(1);
    expect(state.fitBounds).not.toHaveBeenCalled();
  });

  it('waits for restaurants and the Google SDK before focusing a direct map URL', async () => {
    let resolveData!: () => void;
    let resolveMaps!: () => void;
    state.dataGate = new Promise(resolve => { resolveData = resolve; });
    state.mapsGate = new Promise(resolve => { resolveMaps = resolve; });
    open('/map?restaurantId=delayed');
    expect(screen.getByText('Učitavanje mape…')).toHaveAttribute('role', 'status');
    expect(state.mapOptions).toHaveLength(0);

    state.items = [{ ...item('delayed', 'Google restoran'), lat: 45.29, lng: 14.27 }];
    await act(async () => resolveData());
    expect(screen.getByRole('link', { name: 'Otvori restoran' })).toHaveAttribute('href', '/restaurants/delayed');
    expect(state.mapOptions).toHaveLength(0);
    await act(async () => resolveMaps());
    expect(state.mapOptions).toHaveLength(1);
    expect(state.mapOptions[0]).toMatchObject({ center: { lat: 45.29, lng: 14.27 }, zoom: 16 });
  });

  it('handles query changes, an invalid ID, and browser Back while already on the map', async () => {
    state.items = [item('first', 'Prvi'), { ...item('second', 'Drugi'), lat: 45.29, lng: 14.27 }];
    open('/map?restaurantId=first');
    await waitFor(() => expect(state.mapOptions).toHaveLength(1));

    fireEvent.click(screen.getByRole('button', { name: 'Focus second' }));
    await waitFor(() => expect(state.mapOptions).toHaveLength(2));
    expect(state.mapOptions[1]).toMatchObject({ center: { lat: 45.29, lng: 14.27 }, zoom: 16 });
    expect(screen.getByRole('link', { name: 'Otvori restoran' })).toHaveAttribute('href', '/restaurants/second');

    fireEvent.click(screen.getByRole('button', { name: 'Focus missing' }));
    expect(await screen.findByText('Traženi restoran nije pronađen ili nema dostupnu lokaciju.')).toHaveAttribute('role', 'status');
    await waitFor(() => expect(state.fitBounds).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('region', { name: 'Odabrani restoran' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Browser Back' }));
    await waitFor(() => expect(state.mapOptions).toHaveLength(4));
    expect(state.mapOptions[3]).toMatchObject({ center: { lat: 45.29, lng: 14.27 }, zoom: 16 });
    expect(screen.getByRole('link', { name: 'Otvori restoran' })).toHaveAttribute('href', '/restaurants/second');
  });

  it('falls back to the normal map for an invalid Restaurant ID and keeps pins usable', async () => {
    state.items = [item('first', 'Prvi'), item('second', 'Drugi')];
    open('/map?restaurantId=not-an-existing-id');
    expect(await screen.findByText('Traženi restoran nije pronađen ili nema dostupnu lokaciju.')).toHaveAttribute('role', 'status');
    await waitFor(() => expect(state.markers).toHaveLength(2));
    expect(state.fitBounds).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('region', { name: 'Odabrani restoran' })).not.toBeInTheDocument();
    act(() => state.callbacks[1]());
    expect(screen.getByRole('link', { name: 'Otvori restoran' })).toHaveAttribute('href', '/restaurants/second');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('handles an unavailable focus when no restaurants have a mappable location', async () => {
    open('/map?restaurantId=without-location');
    expect(await screen.findByText(/Još nema restorana s lokacijom/)).toBeInTheDocument();
    expect(screen.getByText('Traženi restoran nije pronađen ili nema dostupnu lokaciju.')).toHaveAttribute('role', 'status');
    expect(state.mapOptions).toHaveLength(0);
  });
});
