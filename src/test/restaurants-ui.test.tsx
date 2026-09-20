import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import type { Restaurant, RestaurantVisit } from '@/lib/restaurantDomain';
import Restaurants from '@/pages/Restaurants';
import { restaurantVisitPhotos } from '@/lib/restaurantVisitPhotos';
import { optimizeRestaurantPhotos } from '@/lib/optimizeRestaurantPhoto';
import { restaurantDeletion } from '@/lib/restaurantDeletion';
import { restaurants } from '@/lib/restaurants';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const state = vi.hoisted(() => ({
  userId: '11111111-1111-4111-8111-111111111111',
  restaurants: [] as Restaurant[],
  visits: [] as RestaurantVisit[],
  sequence: 0,
  googleKey: '',
}));

vi.mock('@/lib/googleMapsBrowser', () => ({
  googleMapsConfig: () => ({ apiKey: state.googleKey, mapId: 'test-map' }),
  createGoogleRestaurantSearch: () => ({
    suggest: vi.fn(async () => [{ placeId: 'google-123', label: 'Google Bistro, Zagreb', prediction: {} }]),
    select: vi.fn(async () => ({ placeId: 'google-123', name: 'Google Bistro', address: 'Ulica 1, Zagreb' })),
  }),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: state.userId }, isDemo: false }),
}));

vi.mock('@/lib/optimizeRestaurantPhoto', () => ({
  optimizeRestaurantPhotos: vi.fn(async (files: File[]) => files.map(file => ({
    file, width: 1000, height: 1000, originalBytes: file.size, optimizedBytes: file.size, quality: 0.82,
  }))),
}));

vi.mock('@/lib/restaurants', () => ({
  restaurants: {
    list: vi.fn(async (userId: string) => state.restaurants.filter(item => item.user_id === userId && item.category === 'restaurant')),
    get: vi.fn(async (userId: string, id: string) => state.restaurants.find(item => item.user_id === userId && item.category === 'restaurant' && item.id === id) ?? null),
    create: vi.fn(async (userId: string, input: { name: string }) => {
      const item = {
        id: `restaurant-${++state.sequence}`, user_id: userId,
        category: 'restaurant', city_id: null, lat: null, lng: null, address: null, google_place_id: null,
        ...input, name: input.name.trim(), created_at: '2026-09-19T00:00:00Z',
      } as Restaurant;
      state.restaurants.push(item);
      return item;
    }),
    update: vi.fn(async (userId: string, id: string, changes: Partial<Restaurant>) => {
      const item = state.restaurants.find(row => row.user_id === userId && row.id === id);
      if (!item) throw new Error('Restaurant not found');
      Object.assign(item, changes);
      return item;
    }),
  },
}));

vi.mock('@/lib/restaurantDeletion', () => ({
  RestaurantDeletionError: class RestaurantDeletionError extends Error {},
  restaurantDeletion: {
    delete: vi.fn(async (userId: string, restaurantId: string) => {
      const index = state.restaurants.findIndex(item => item.user_id === userId && item.id === restaurantId);
      if (index < 0) throw new Error('Restoran nije pronađen ili ga nemaš pravo obrisati.');
      state.restaurants.splice(index, 1);
      state.visits = state.visits.filter(visit => !(visit.user_id === userId && visit.place_id === restaurantId));
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
    id, name, user_id: userId, category, city_id: null, lat: null, lng: null, address: null, google_place_id: null,
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
  return <><output data-testid="route">{location.pathname}{location.search}</output><button onClick={() => navigate(-1)}>Browser Back</button></>;
}

function open(path = '/restaurants') {
  render(<MemoryRouter initialEntries={[path]}>
    <Location />
    <Routes>
      <Route path="/restaurants/*" element={<Restaurants />} />
      <Route path="/map" element={<p>Mapa</p>} />
    </Routes>
  </MemoryRouter>);
}

beforeEach(() => {
  state.userId = alice;
  state.restaurants = [];
  state.visits = [];
  state.sequence = 0;
  state.googleKey = '';
  vi.restoreAllMocks();
  vi.clearAllMocks();
});

describe('Restaurant V1 routes', () => {
  it('confirms and deletes a restaurant without visits, then returns to the list', async () => {
    addRestaurant('one', 'Bistro');
    addRestaurant('other', 'Drugi');
    open('/restaurants/one');

    fireEvent.click(await screen.findByRole('button', { name: 'Obriši restoran' }));
    expect(screen.getByText('Želiš li trajno obrisati ovaj restoran?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trajno obriši' }));

    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/restaurants'));
    expect(restaurantDeletion.delete).toHaveBeenCalledWith(alice, 'one');
    expect(state.restaurants.map(item => item.id)).toEqual(['other']);
  });

  it('shows the visit count and deletes only the selected ID when names are equal', async () => {
    addRestaurant('first', 'Bistro');
    addRestaurant('second', 'Bistro');
    addVisit('visit-1', 'first', '2026-09-18', alice, { photos: [`${alice}/restaurants/visit-1/one.jpg`] });
    addVisit('visit-2', 'first', '2026-09-19', alice, { photos: [`${alice}/restaurants/visit-2/two.jpg`] });
    addVisit('visit-other', 'second', '2026-09-20');
    open('/restaurants/first');

    fireEvent.click(await screen.findByRole('button', { name: 'Obriši restoran' }));
    expect(screen.getByText('Ovim ćeš trajno obrisati restoran, 2 posjeta i sve njihove fotografije. Ova radnja se ne može poništiti.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Trajno obriši' }));

    await waitFor(() => expect(screen.getByTestId('route')).toHaveTextContent('/restaurants'));
    expect(state.restaurants.map(item => item.id)).toEqual(['second']);
    expect(state.visits.map(item => item.id)).toEqual(['visit-other']);
  });

  it('cancel confirmation leaves the restaurant and visits untouched', async () => {
    addRestaurant('one', 'Bistro');
    addVisit('visit-1', 'one', '2026-09-18');
    open('/restaurants/one');

    fireEvent.click(await screen.findByRole('button', { name: 'Obriši restoran' }));
    fireEvent.click(screen.getByRole('button', { name: 'Odustani' }));
    expect(restaurantDeletion.delete).not.toHaveBeenCalled();
    expect(state.restaurants).toHaveLength(1);
    expect(state.visits).toHaveLength(1);
    expect(screen.getByTestId('route')).toHaveTextContent('/restaurants/one');
  });

  it('keeps the restaurant and shows the cleanup state when deletion fails', async () => {
    addRestaurant('one', 'Bistro');
    const { RestaurantDeletionError } = await import('@/lib/restaurantDeletion');
    vi.mocked(restaurantDeletion.delete).mockRejectedValueOnce(new RestaurantDeletionError(
      'Restoran nije obrisan jer čišćenje fotografija nije potpuno uspjelo. Zapisi su ostali sačuvani, ali dio fotografija možda je već uklonjen; pokušaj ponovno.',
      'storage', [],
    ));
    open('/restaurants/one');

    fireEvent.click(await screen.findByRole('button', { name: 'Obriši restoran' }));
    fireEvent.click(screen.getByRole('button', { name: 'Trajno obriši' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('dio fotografija možda je već uklonjen');
    expect(state.restaurants.map(item => item.id)).toEqual(['one']);
    expect(screen.getByTestId('route')).toHaveTextContent('/restaurants/one');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not expose restaurant deletion for another user through a direct URL', async () => {
    addRestaurant('foreign', 'Privatno', bob);
    open('/restaurants/foreign');
    expect(await screen.findByRole('alert')).toHaveTextContent('Restoran nije pronađen');
    expect(screen.queryByRole('button', { name: 'Obriši restoran' })).not.toBeInTheDocument();
    expect(restaurantDeletion.delete).not.toHaveBeenCalled();
  });

  it.each([
    { google_place_id: 'google-123', lat: null, lng: null },
    { google_place_id: null, lat: 0, lng: 0 },
  ])('links a located restaurant to the map using its Restaurant ID: %j', async location => {
    const id = '33333333-3333-4333-8333-333333333333';
    addRestaurant(id, 'Bistro');
    Object.assign(state.restaurants[0], location);
    open(`/restaurants/${id}`);

    const link = await screen.findByRole('link', { name: 'Prikaži na mapi' });
    expect(link).toHaveAttribute('href', `/map?restaurantId=${id}`);
    expect(screen.getByRole('link', { name: 'Uredi restoran' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Dodaj lokaciju' })).not.toBeInTheDocument();
    fireEvent.click(link);
    expect(screen.getByTestId('route').textContent).toBe(`/map?restaurantId=${id}`);
  });

  it.each([
    { lat: null, lng: null, address: null },
    { lat: 45.8, lng: null, address: 'Samo adresa 1' },
    { lat: 91, lng: 15.9, address: null },
  ])('offers the existing editor for a restaurant without a usable location: %j', async location => {
    addRestaurant('one', 'Bistro');
    Object.assign(state.restaurants[0], location);
    state.googleKey = 'test';
    open('/restaurants/one');

    const link = await screen.findByRole('link', { name: 'Dodaj lokaciju' });
    expect(link).toHaveAttribute('href', '/restaurants/one/edit');
    expect(screen.queryByRole('link', { name: 'Prikaži na mapi' })).not.toBeInTheDocument();
    fireEvent.click(link);
    expect(await screen.findByRole('heading', { name: 'Uredi restoran' })).toBeInTheDocument();
    const name = await screen.findByLabelText('Naziv restorana');
    expect(name).toHaveValue('Bistro');
    fireEvent.change(name, { target: { value: 'Bistro Zagreb' } });
    expect(await screen.findByRole('button', { name: 'Google Bistro, Zagreb' })).toBeInTheDocument();
  });

  it('associates a selected Google Place ID without replacing the user-entered restaurant name', async () => {
    state.googleKey = 'test';
    open('/restaurants/new');
    fireEvent.change(screen.getByLabelText('Naziv restorana'), { target: { value: 'Moj Bistro' } });
    fireEvent.click(await screen.findByRole('button', { name: 'Google Bistro, Zagreb' }));
    expect(await screen.findByText('Google lokacija: Google Bistro')).toBeInTheDocument();
    expect(screen.getByLabelText('Naziv restorana')).toHaveValue('Moj Bistro');
    fireEvent.change(screen.getByLabelText(/Adresa/), { target: { value: 'Moja adresa 4' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spremi restoran' }));
    await waitFor(() => expect(state.restaurants[0]).toMatchObject({
      name: 'Moj Bistro', address: 'Moja adresa 4', google_place_id: 'google-123', lat: null, lng: null,
    }));
  });

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

  it('blocks saving while preparing and reports a failed photo without uploading', async () => {
    addRestaurant('one', 'Bistro');
    let rejectPreparation!: (error: Error) => void;
    vi.mocked(optimizeRestaurantPhotos).mockImplementationOnce(() => new Promise((_, reject) => { rejectPreparation = reject; }));
    open('/restaurants/one/visits/new');
    const picker = await screen.findByLabelText(/Fotografije/);
    fireEvent.change(picker, { target: { files: [new File(['bad'], 'bad.heic', { type: 'image/heic' })] } });
    expect(within(picker.parentElement!).getByRole('status')).toHaveTextContent('Priprema fotografija');
    expect(screen.getByRole('button', { name: 'Priprema fotografija…' })).toBeDisabled();
    rejectPreparation(new Error('Fotografija „bad.heic” nije pripremljena.'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Fotografija se ne može pripremiti');
    expect(screen.queryByText('bad.heic')).not.toBeInTheDocument();
    expect(restaurantVisitPhotos.create).not.toHaveBeenCalled();
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

  it('validates a required restaurant name in Croatian without sending a request', async () => {
    open('/restaurants/new');
    const name = screen.getByLabelText('Naziv restorana');
    fireEvent.change(name, { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spremi restoran' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Upiši naziv restorana');
    expect(name).toHaveFocus();
    expect(restaurants.create).not.toHaveBeenCalled();
  });

  it('prevents a same-frame double submit while saving a restaurant', async () => {
    let rejectSave!: (error: Error) => void;
    vi.mocked(restaurants.create).mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject; }));
    open('/restaurants/new');
    fireEvent.change(screen.getByLabelText('Naziv restorana'), { target: { value: 'Bistro' } });
    const form = screen.getByRole('button', { name: 'Spremi restoran' }).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(restaurants.create).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Spremanje…' })).toBeDisabled();
    rejectSave(new Error('raw database response'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Restoran nije spremljen');
    expect(screen.queryByText('raw database response')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Naziv restorana')).toHaveValue('Bistro');
  });

  it('edits a restaurant address while keeping its ID and optional location', async () => {
    addRestaurant('one', 'Bistro');
    open('/restaurants/one/edit');
    expect(await screen.findByRole('heading', { name: 'Uredi restoran' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(/Adresa/), { target: { value: 'Moja ulica 2' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spremi izmjene' }));
    await waitFor(() => expect(state.restaurants[0]).toMatchObject({ id: 'one', address: 'Moja ulica 2', lat: null, lng: null }));
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
    expect(within(cards[0]).getByText('18. 9. 2026.')).toHaveAttribute('datetime', '2026-09-18');
    expect(within(cards[1]).getByText('17. 9. 2026.')).toHaveAttribute('datetime', '2026-09-17');
  });

  it('validates the visit date in Croatian without sending a request', async () => {
    addRestaurant('one', 'Bistro');
    open('/restaurants/one/visits/new');
    const date = await screen.findByLabelText('Datum');
    fireEvent.change(date, { target: { value: '' } });
    fireEvent.click(screen.getByRole('button', { name: 'Spremi posjet' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Odaberi valjan datum posjeta');
    expect(date).toHaveFocus();
    expect(restaurantVisitPhotos.create).not.toHaveBeenCalled();
  });

  it('prevents a same-frame double submit while saving a visit', async () => {
    addRestaurant('one', 'Bistro');
    let rejectSave!: (error: Error) => void;
    vi.mocked(restaurantVisitPhotos.create).mockImplementationOnce(() => new Promise((_, reject) => { rejectSave = reject; }));
    open('/restaurants/one/visits/new');
    const form = (await screen.findByRole('button', { name: 'Spremi posjet' })).closest('form')!;
    fireEvent.submit(form);
    fireEvent.submit(form);

    expect(restaurantVisitPhotos.create).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Spremanje…' })).toBeDisabled();
    rejectSave(new Error('raw storage response'));
    expect(await screen.findByRole('alert')).toHaveTextContent('Posjet nije spremljen');
    expect(screen.queryByText('raw storage response')).not.toBeInTheDocument();
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
