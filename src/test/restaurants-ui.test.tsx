import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Restaurant, RestaurantVisit } from '@/lib/restaurantDomain';
import Restaurants from '@/pages/Restaurants';
import { restaurantVisitPhotos } from '@/lib/restaurantVisitPhotos';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const state = vi.hoisted(() => ({
  userId: '11111111-1111-4111-8111-111111111111',
  restaurants: [] as Restaurant[],
  visits: [] as RestaurantVisit[],
  sequence: 0,
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: state.userId }, isDemo: false }),
}));

vi.mock('@/lib/restaurants', () => ({
  restaurants: {
    list: vi.fn(async (userId: string) => state.restaurants.filter(item => item.user_id === userId && item.category === 'restaurant')),
    get: vi.fn(async (userId: string, id: string) => state.restaurants.find(item => item.user_id === userId && item.category === 'restaurant' && item.id === id) ?? null),
    create: vi.fn(async (userId: string, input: { name: string }) => {
      const item = {
        id: `restaurant-${++state.sequence}`, user_id: userId, name: input.name.trim(),
        category: 'restaurant', city_id: null, lat: null, lng: null, created_at: '2026-09-19T00:00:00Z',
      } as Restaurant;
      state.restaurants.push(item);
      return item;
    }),
  },
}));

vi.mock('@/lib/restaurantVisits', () => ({
  restaurantVisits: {
    list: vi.fn(async (userId: string, placeId: string) => state.visits.filter(item => item.user_id === userId && item.place_id === placeId)),
    get: vi.fn(async (userId: string, id: string) => state.visits.find(item => item.user_id === userId && item.id === id &&
      state.restaurants.some(restaurant => restaurant.id === item.place_id && restaurant.user_id === userId)) ?? null),
    create: vi.fn(async (userId: string, input: Partial<RestaurantVisit> & { place_id: string; date: string }) => {
      const item = {
        id: `visit-${++state.sequence}`, user_id: userId, created_at: '2026-09-19T00:00:00Z',
        moment_id: null, photos: [], note: null, what_i_ate: null, rating: null, ...input,
      } as RestaurantVisit;
      state.visits.push(item);
      return item;
    }),
    update: vi.fn(async (userId: string, id: string, changes: Partial<RestaurantVisit>) => {
      const item = state.visits.find(visit => visit.id === id && visit.user_id === userId);
      if (!item) throw new Error('Visit not found');
      Object.assign(item, changes);
      return item;
    }),
    delete: vi.fn(async (userId: string, id: string) => {
      const index = state.visits.findIndex(item => item.id === id && item.user_id === userId);
      if (index < 0) throw new Error('Visit not found');
      state.visits.splice(index, 1);
    }),
  },
}));

vi.mock('@/lib/restaurantVisitPhotos', () => ({
  VisitPhotoError: class VisitPhotoError extends Error { committed = false; },
  validateVisitFiles: vi.fn(),
  restaurantVisitPhotos: {
    create: vi.fn(async (userId: string, input: Partial<RestaurantVisit> & { place_id: string; date: string }) => {
      const item = { id: `visit-${++state.sequence}`, user_id: userId, created_at: '2026-09-19T00:00:00Z',
        moment_id: null, photos: [], note: null, what_i_ate: null, rating: null, ...input } as RestaurantVisit;
      state.visits.push(item);
      return item;
    }),
    update: vi.fn(async (userId: string, id: string, changes: Partial<RestaurantVisit>, retained: string[]) => {
      const item = state.visits.find(visit => visit.id === id && visit.user_id === userId);
      if (!item) throw new Error('Visit not found');
      Object.assign(item, changes, { photos: retained });
      return item;
    }),
    delete: vi.fn(async (userId: string, id: string) => {
      const index = state.visits.findIndex(item => item.id === id && item.user_id === userId);
      if (index < 0) throw new Error('Visit not found');
      state.visits.splice(index, 1);
    }),
    signedUrl: vi.fn(async (_userId: string, path: string) => path),
  },
}));

function addRestaurant(id: string, name: string, userId = alice, category = 'restaurant') {
  state.restaurants.push({
    id, name, user_id: userId, category, city_id: null, lat: null, lng: null,
    created_at: '2026-09-19T00:00:00Z',
  });
}

function addVisit(id: string, placeId: string, date: string, userId = alice, extras: Partial<RestaurantVisit> = {}) {
  state.visits.push({
    id, place_id: placeId, date, user_id: userId, moment_id: null,
    note: null, what_i_ate: null, rating: null, photos: [], created_at: '2026-09-19T00:00:00Z',
    ...extras,
  });
}

function Location() {
  const location = useLocation();
  const navigate = useNavigate();
  return <><output data-testid="route">{location.pathname}</output><button onClick={() => navigate(-1)}>Browser Back</button></>;
}

function open(path = '/restaurants') {
  render(<MemoryRouter initialEntries={[path]}>
    <Location />
    <Routes><Route path="/restaurants/*" element={<Restaurants />} /></Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  state.userId = alice;
  state.restaurants = [];
  state.visits = [];
  state.sequence = 0;
  vi.restoreAllMocks();
});

describe('Restaurant V1 routes', () => {
  it('offers multiple local photos and lets a selected photo be removed before saving', async () => {
    addRestaurant('one', 'Bistro');
    const createObjectURL = vi.fn(() => 'blob:preview');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }));
    open('/restaurants/one/visits/new');
    const picker = await screen.findByLabelText(/Fotografije/);
    const first = new File(['one'], 'one.jpg', { type: 'image/jpeg' });
    const second = new File(['two'], 'two.jpg', { type: 'image/jpeg' });
    fireEvent.change(picker, { target: { files: [first, second] } });
    expect(await screen.findAllByRole('button', { name: 'Ukloni' })).toHaveLength(2);
    fireEvent.click(screen.getAllByRole('button', { name: 'Ukloni' })[0]);
    fireEvent.click(screen.getByRole('button', { name: 'Spremi posjet' }));
    await waitFor(() => expect(restaurantVisitPhotos.create).toHaveBeenCalledWith(alice, expect.objectContaining({ place_id: 'one' }), [second]));
    vi.unstubAllGlobals();
  });

  it('lists only own restaurants, sorts by latest visit, and keeps equal names separate by ID', async () => {
    addRestaurant('old', 'Bistro');
    addRestaurant('recent', 'Bistro');
    addRestaurant('empty', 'Bez posjeta');
    addRestaurant('legacy', 'Park', alice, 'park');
    addRestaurant('foreign', 'Tuđi restoran', bob);
    addVisit('v1', 'old', '2026-07-01');
    addVisit('v2', 'recent', '2026-09-18');
    open();

    const links = await screen.findAllByRole('link', { name: /Bistro/ });
    expect(links).toHaveLength(2);
    expect(links.map(link => link.getAttribute('href'))).toEqual(['/restaurants/recent', '/restaurants/old']);
    expect(screen.getByText('Bez posjeta').closest('a')?.getAttribute('href')).toBe('/restaurants/empty');
    expect(screen.queryByText('Park')).not.toBeInTheDocument();
    expect(screen.queryByText('Tuđi restoran')).not.toBeInTheDocument();
  });

  it('creates a name-only restaurant and opens its ID route', async () => {
    open('/restaurants/new');
    fireEvent.change(screen.getByLabelText('Naziv restorana'), { target: { value: '  Bistro  ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spremi restoran' }));

    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/restaurants/restaurant-1'));
    expect(state.restaurants[0]).toMatchObject({ name: 'Bistro', category: 'restaurant', city_id: null, lat: null, lng: null });
    expect(await screen.findByRole('heading', { name: 'Bistro' })).toBeInTheDocument();
  });

  it('loads a direct detail URL and lets browser Back return to the list', async () => {
    addRestaurant('one', 'Mali restoran');
    open('/restaurants/one');
    expect(await screen.findByRole('heading', { name: 'Mali restoran' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: 'Svi restorani' }));
    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/restaurants'));
    fireEvent.click(screen.getByRole('button', { name: 'Browser Back' }));
    await waitFor(() => expect(screen.getByTestId('route').textContent).toBe('/restaurants/one'));
  });

  it('creates two visits with food, note, optional ratings and immediately refreshes the detail', async () => {
    addRestaurant('one', 'Mali restoran');
    open('/restaurants/one');
    fireEvent.click(await screen.findByRole('link', { name: /Dodaj posjet/ }));
    fireEvent.change(await screen.findByLabelText('Datum'), { target: { value: '2026-09-17' } });
    fireEvent.change(screen.getByLabelText('Što sam jeo'), { target: { value: 'Rižoto' } });
    fireEvent.change(screen.getByLabelText('Dojam / bilješka'), { target: { value: 'Vrlo dobro' } });
    fireEvent.change(screen.getByLabelText('Ocjena'), { target: { value: '5' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spremi posjet' }));
    expect(await screen.findByText('Što sam jeo: Rižoto')).toBeInTheDocument();
    expect(screen.getByText('Vrlo dobro')).toBeInTheDocument();
    expect(screen.getByText('Ocjena: 5/5')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('link', { name: /Dodaj posjet/ }));
    fireEvent.change(await screen.findByLabelText('Datum'), { target: { value: '2026-09-18' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spremi posjet' }));
    await waitFor(() => expect(state.visits).toHaveLength(2));
    expect(state.visits[0]).toMatchObject({ place_id: 'one', moment_id: null, what_i_ate: 'Rižoto', note: 'Vrlo dobro', rating: 5, photos: [] });
    expect(state.visits[1]).toMatchObject({ place_id: 'one', moment_id: null, rating: null });
    const cards = await screen.findAllByRole('article');
    expect(within(cards[0]).getByText('2026-09-18')).toBeInTheDocument();
    expect(within(cards[1]).getByText('2026-09-17')).toBeInTheDocument();
  });

  it('edits a visit by deep link and deletes it only after confirmation', async () => {
    addRestaurant('one', 'Bistro');
    addVisit('visit-one', 'one', '2026-09-17', alice, { note: 'Prvi dojam', rating: null });
    open('/restaurants/one/visits/visit-one/edit');
    expect(await screen.findByRole('heading', { name: 'Uredi posjet' })).toBeInTheDocument();
    expect(screen.getByLabelText('Dojam / bilješka')).toHaveValue('Prvi dojam');
    fireEvent.change(screen.getByLabelText('Dojam / bilješka'), { target: { value: 'Novi dojam' } });
    fireEvent.change(screen.getByLabelText('Ocjena'), { target: { value: '3' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spremi izmjene' }));
    await waitFor(() => expect(screen.getByTestId('route').textContent).toBe('/restaurants/one'));
    expect(await screen.findByText('Novi dojam')).toBeInTheDocument();
    expect(screen.getByText('Ocjena: 3/5')).toBeInTheDocument();

    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true);
    fireEvent.click(screen.getByRole('button', { name: 'Obriši' }));
    expect(state.visits).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Obriši' }));
    await waitFor(() => expect(state.visits).toHaveLength(0));
    expect(screen.getByText('Još nema posjeta ovom restoranu.')).toBeInTheDocument();
    expect(confirm).toHaveBeenCalledTimes(2);
  });

  it('does not open another user’s restaurant or visit through a direct URL', async () => {
    addRestaurant('foreign', 'Privatno', bob);
    addVisit('foreign-visit', 'foreign', '2026-09-19', bob);
    open('/restaurants/foreign');
    expect(await screen.findByRole('alert')).toHaveTextContent('Restoran nije pronađen');
    expect(screen.queryByText('Privatno')).not.toBeInTheDocument();
  });

  it('does not open a visit through a different restaurant URL', async () => {
    addRestaurant('own', 'Moj restoran');
    addRestaurant('foreign', 'Tuđi restoran', bob);
    addVisit('foreign-visit', 'foreign', '2026-09-19', bob);
    open('/restaurants/own/visits/foreign-visit/edit');
    expect(await screen.findByRole('alert')).toHaveTextContent('Restoran ili posjet nije pronađen');
    expect(screen.queryByRole('button', { name: 'Spremi izmjene' })).not.toBeInTheDocument();
  });
});
