import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import type { RestaurantVisit } from '@/lib/restaurantDomain';
import RestaurantCalendar from '@/pages/RestaurantCalendar';
import { restaurantVisitPhotos } from '@/lib/restaurantVisitPhotos';

const alice = '11111111-1111-4111-8111-111111111111';
const bob = '22222222-2222-4222-8222-222222222222';
const state = vi.hoisted(() => ({
  userId: '11111111-1111-4111-8111-111111111111',
  visits: [] as RestaurantVisit[],
  places: [] as Array<{ id: string; name: string; user_id: string; category: string }>,
  fail: false,
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: state.userId }, isDemo: false }) }));
vi.mock('@/lib/restaurantCalendar', async importOriginal => {
  const actual = await importOriginal<typeof import('@/lib/restaurantCalendar')>();
  return { ...actual, restaurantCalendar: {
    listMonth: vi.fn(async (userId: string, month: { year: number; month: number }) => {
      if (state.fail) throw new Error('Query failed');
      const prefix = `${month.year}-${String(month.month).padStart(2, '0')}-`;
      return state.visits.filter(visit => visit.user_id === userId && visit.date.startsWith(prefix))
        .flatMap(visit => {
          const restaurant = state.places.find(place => place.id === visit.place_id && place.user_id === userId && place.category === 'restaurant');
          return restaurant ? [{ visit, restaurant: { id: restaurant.id, name: restaurant.name } }] : [];
        });
    }),
  } };
});
vi.mock('@/lib/restaurantVisitPhotos', () => ({
  restaurantVisitPhotos: { signedUrl: vi.fn(async (_userId: string, path: string) => `https://example.test/signed/${path}`) },
}));

function addPlace(id: string, name: string, userId = alice) {
  state.places.push({ id, name, user_id: userId, category: 'restaurant' });
}

function addVisit(id: string, placeId: string, date: string, userId = alice, extras: Partial<RestaurantVisit> = {}) {
  state.visits.push({ id, place_id: placeId, date, user_id: userId, moment_id: null, note: null,
    what_i_ate: null, rating: null, photos: [], created_at: '2026-09-19T00:00:00Z', ...extras });
}

function Location() {
  const location = useLocation();
  return <output data-testid="route">{location.pathname}</output>;
}

function open() {
  render(<MemoryRouter initialEntries={['/calendar']}><Location /><Routes>
    <Route path="/calendar" element={<RestaurantCalendar />} />
    <Route path="/restaurants/:restaurantId" element={<p>Detalj restorana</p>} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(2026, 8, 19, 12));
  state.userId = alice;
  state.visits = [];
  state.places = [];
  state.fail = false;
  vi.clearAllMocks();
});
afterEach(() => vi.useRealTimers());

describe('Restaurant V1 Calendar', () => {
  it('shows a Monday-first empty month, today and selected day', async () => {
    open();
    expect(await screen.findByText('Ovaj mjesec nema posjeta.')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /rujan 2026/i })).toBeInTheDocument();
    expect(screen.getByText('pon')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /19. rujna 2026/ })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: /^1\. rujna 2026/ }));
    expect(screen.getByText('Nema posjeta ovog dana.')).toBeInTheDocument();
  });

  it('marks one day and shows every visit, including equal restaurant names and repeated place ID', async () => {
    addPlace('first', 'Bistro');
    addPlace('second', 'Bistro');
    addVisit('v1', 'first', '2026-09-01', alice, { what_i_ate: 'Riba', rating: 5 });
    addVisit('v2', 'first', '2026-09-01', alice, { note: 'Dobar ručak' });
    addVisit('v3', 'second', '2026-09-01');
    open();
    const day = await screen.findByRole('button', { name: /1. rujna 2026.*3 posjeta/ });
    expect(within(day).getByText('1')).toBeInTheDocument();
    fireEvent.click(day);
    const cards = screen.getAllByRole('article');
    expect(cards).toHaveLength(3);
    expect(screen.getByText('Što sam jeo: Riba')).toBeInTheDocument();
    expect(screen.getByText('Ocjena: 5/5')).toBeInTheDocument();
    expect(screen.getByText('Dobar ručak')).toBeInTheDocument();
    expect(cards.map(card => within(card).getByRole('link', { name: 'Bistro' }).getAttribute('href')))
      .toEqual(['/restaurants/first', '/restaurants/first', '/restaurants/second']);
    fireEvent.click(within(cards[2]).getByRole('link', { name: 'Bistro' }));
    expect(screen.getByTestId('route')).toHaveTextContent('/restaurants/second');
  });

  it('shows only the selected date and preserves first/last day markers', async () => {
    addPlace('one', 'Konoba');
    addVisit('start', 'one', '2026-09-01');
    addVisit('end', 'one', '2026-09-30');
    open();
    const first = await screen.findByRole('button', { name: /1. rujna 2026.*1 posjet/ });
    const last = screen.getByRole('button', { name: /30. rujna 2026.*1 posjet/ });
    fireEvent.click(first);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(last);
    expect(screen.getAllByRole('article')).toHaveLength(1);
    expect(screen.getByRole('heading', { name: /30. rujna 2026/ })).toBeInTheDocument();
  });

  it('navigates from December to January without shifting the selected ISO date', async () => {
    vi.setSystemTime(new Date(2026, 11, 31, 12));
    addPlace('one', 'Konoba');
    addVisit('new-year', 'one', '2027-01-01');
    open();
    fireEvent.click(screen.getByRole('button', { name: 'Sljedeći mjesec' }));
    expect(await screen.findByRole('heading', { name: /siječanj 2027/i })).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: /1. siječnja 2027.*1 posjet/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getAllByRole('article')).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Prethodni mjesec' }));
    expect(await screen.findByRole('heading', { name: /prosinac 2026/i })).toBeInTheDocument();
  });

  it('hides another user’s visit and handles an optional photo preview', async () => {
    addPlace('own', 'Moj restoran');
    addPlace('foreign', 'Tuđi restoran', bob);
    addVisit('own-visit', 'own', '2026-09-19', alice, { photos: [`${alice}/restaurants/own-visit/a.webp`] });
    addVisit('foreign-visit', 'foreign', '2026-09-19', bob);
    open();
    expect(await screen.findByText('Moj restoran')).toBeInTheDocument();
    expect(screen.queryByText('Tuđi restoran')).not.toBeInTheDocument();
    expect(await screen.findByAltText('Fotografija posjeta')).toBeInTheDocument();
    expect(restaurantVisitPhotos.signedUrl).toHaveBeenCalledWith(alice, `${alice}/restaurants/own-visit/a.webp`);
  });

  it('shows a query error rather than a false empty state', async () => {
    state.fail = true;
    open();
    expect(await screen.findByRole('alert')).toHaveTextContent('Query failed');
    expect(screen.queryByText('Ovaj mjesec nema posjeta.')).not.toBeInTheDocument();
  });
});
