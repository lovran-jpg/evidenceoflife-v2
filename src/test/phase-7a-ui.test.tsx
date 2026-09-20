import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { AuthRoute, HomeRoute, ProtectedRoute } from '@/App';
import { RestaurantShell } from '@/components/RestaurantShell';
import { formatCroatianDate } from '@/lib/croatianDate';

const state = vi.hoisted(() => ({
  user: null as { id: string } | null,
  isDemo: false,
  loading: false,
  authReady: true,
  signOut: vi.fn(async () => {}),
}));

vi.mock('@/hooks/useAuth', () => ({ useAuth: () => state }));

function CurrentRoute() {
  const location = useLocation();
  return <output data-testid="route">{location.pathname}</output>;
}

function renderRoot() {
  render(<MemoryRouter initialEntries={['/']}><CurrentRoute /><Routes>
    <Route path="/" element={<HomeRoute />} />
    <Route path="/auth" element={<p>Prijava</p>} />
    <Route path="/restaurants" element={<p>Restorani stranica</p>} />
    <Route path="/demo-app" element={<p>Demo</p>} />
  </Routes></MemoryRouter>);
}

beforeEach(() => {
  state.user = null;
  state.isDemo = false;
  state.loading = false;
  state.authReady = true;
  state.signOut.mockClear();
});

describe('Faza 7A V1 ulaz i navigacija', () => {
  it('šalje neprijavljenog korisnika s root rute na auth', async () => {
    renderRoot();
    expect(await screen.findByText('Prijava')).toBeInTheDocument();
    expect(screen.getByTestId('route')).toHaveTextContent('/auth');
  });

  it('šalje prijavljenog korisnika s root i auth rute na restorane', async () => {
    state.user = { id: 'alice' };
    renderRoot();
    expect(await screen.findByText('Restorani stranica')).toBeInTheDocument();
    expect(screen.getByTestId('route')).toHaveTextContent('/restaurants');

    render(<MemoryRouter initialEntries={['/auth']}><CurrentRoute /><Routes>
      <Route path="/auth" element={<AuthRoute><p>Auth forma</p></AuthRoute>} />
      <Route path="/restaurants" element={<p>V1 restorani</p>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText('V1 restorani')).toBeInTheDocument();
  });

  it('ostavlja legacy /app dostupan izravnim URL-om prijavljenom korisniku', () => {
    state.user = { id: 'alice' };
    render(<MemoryRouter initialEntries={['/app']}><Routes>
      <Route path="/app" element={<ProtectedRoute><p>Legacy aplikacija</p></ProtectedRoute>} />
    </Routes></MemoryRouter>);
    expect(screen.getByText('Legacy aplikacija')).toBeInTheDocument();
  });

  it('navigira između sva tri V1 taba i označava aktivnu sekciju', () => {
    state.user = { id: 'alice' };
    render(<MemoryRouter initialEntries={['/restaurants/restaurant-1/edit']}><CurrentRoute /><Routes>
      <Route path="*" element={<RestaurantShell><p>Sadržaj</p></RestaurantShell>} />
    </Routes></MemoryRouter>);

    const restaurants = screen.getByRole('link', { name: 'Restorani' });
    const calendar = screen.getByRole('link', { name: 'Kalendar' });
    const map = screen.getByRole('link', { name: 'Mapa' });
    expect(restaurants).toHaveAttribute('aria-current', 'page');
    expect(calendar).not.toHaveAttribute('aria-current');

    fireEvent.click(calendar);
    expect(screen.getByTestId('route')).toHaveTextContent('/calendar');
    expect(calendar).toHaveAttribute('aria-current', 'page');
    fireEvent.click(map);
    expect(screen.getByTestId('route')).toHaveTextContent('/map');
    expect(map).toHaveAttribute('aria-current', 'page');
    expect(screen.queryByText('Stara aplikacija')).not.toBeInTheDocument();
  });

  it('odjavljuje postojeću sesiju i vodi na auth', async () => {
    state.user = { id: 'alice' };
    render(<MemoryRouter initialEntries={['/calendar']}><CurrentRoute /><Routes>
      <Route path="/calendar" element={<RestaurantShell><p>Kalendar sadržaj</p></RestaurantShell>} />
      <Route path="/auth" element={<p>Prijava nakon odjave</p>} />
    </Routes></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Odjava' }));
    await waitFor(() => expect(state.signOut).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('Prijava nakon odjave')).toBeInTheDocument();
    expect(screen.getByTestId('route')).toHaveTextContent('/auth');
  });
});

describe('hrvatski prikaz kalendarskog datuma', () => {
  it('formatira datum bez parsiranja u lokalnu vremensku zonu', () => {
    const storedDate = '2026-09-20';
    expect(formatCroatianDate(storedDate)).toBe('20. 9. 2026.');
    expect(storedDate).toBe('2026-09-20');
    expect(formatCroatianDate('nepoznato')).toBe('nepoznato');
  });
});
