import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { MappedRestaurant } from '@/lib/restaurantMap';
import RestaurantMap from '@/pages/RestaurantMap';

const alice = '11111111-1111-4111-8111-111111111111';
const state = vi.hoisted(() => ({ items: [] as MappedRestaurant[], callbacks: new Map<string, () => void>(), fail: false }));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: alice }, isDemo: false }) }));
vi.mock('@/lib/restaurantMap', () => ({ restaurantMap: {
  list: vi.fn(async () => { if (state.fail) throw new Error('Query failed'); return state.items; }),
} }));
vi.mock('@/lib/googleMapsBrowser', () => ({
  googleMapsConfig: () => ({ apiKey: 'test', mapId: 'test-map-id' }),
  fetchGooglePlaceLocation: vi.fn(),
  loadGoogleMaps: vi.fn(async () => ({ importLibrary: async (name: string) => name === 'maps'
    ? { Map: class { fitBounds() {} }, LatLngBounds: class { extend() {} } }
    : { AdvancedMarkerElement: class {
      map = {};
      constructor(options: { title: string }) { state.callbacks.set(options.title, () => {}); }
      addListener(_event: string, callback: () => void) {
        // Same names are tested via the accessible list, IDs via the pin callback below.
        state.callbacks.set(`pin-${state.callbacks.size}`, callback);
        return { remove() {} };
      }
    } },
  })),
}));

function item(id: string, name: string, visitCount = 0): MappedRestaurant {
  return { restaurant: { id, name, category: 'restaurant', user_id: alice, city_id: null,
    lat: 45.8, lng: 15.9, address: 'Zagreb', google_place_id: null, created_at: '' },
  lat: 45.8, lng: 15.9, visitCount, lastVisit: visitCount ? '2026-09-19' : null };
}

function Location() { return <output data-testid="route">{useLocation().pathname}</output>; }
function open() {
  render(<MemoryRouter initialEntries={['/map']}><Location /><Routes>
    <Route path="/map" element={<RestaurantMap />} />
    <Route path="/restaurants/:restaurantId" element={<p>Detalj</p>} />
  </Routes></MemoryRouter>);
}

beforeEach(() => { state.items = []; state.callbacks.clear(); state.fail = false; vi.clearAllMocks(); });

describe('Restaurant V1 map', () => {
  it('shows an empty state without loading Google when no restaurant has a location', async () => {
    open();
    expect(await screen.findByText(/Još nema restorana s lokacijom/)).toBeInTheDocument();
    expect(screen.queryByRole('img', { name: 'Karta restorana' })).not.toBeInTheDocument();
  });

  it('keeps equal names separate and a pin opens the correct Restaurant ID', async () => {
    state.items = [item('first', 'Bistro', 2), item('second', 'Bistro', 1)];
    open();
    expect(await screen.findByRole('img', { name: 'Karta restorana' })).toBeInTheDocument();
    await waitFor(() => expect(state.callbacks.has('pin-1')).toBe(true));
    act(() => state.callbacks.get('pin-1')!());
    expect(await screen.findByText('Zadnji posjet: 2026-09-19')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Otvori restoran' })).toHaveAttribute('href', '/restaurants/first');
    fireEvent.click(screen.getAllByRole('button', { name: 'Bistro' })[1]);
    expect(screen.getByRole('link', { name: 'Otvori restoran' })).toHaveAttribute('href', '/restaurants/second');
    fireEvent.click(screen.getByRole('link', { name: 'Otvori restoran' }));
    expect(screen.getByTestId('route')).toHaveTextContent('/restaurants/second');
  });

  it('shows a data error clearly', async () => {
    state.fail = true;
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Query failed');
  });
});
