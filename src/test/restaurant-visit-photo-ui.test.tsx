import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RestaurantVisitPhoto } from '@/components/RestaurantVisitPhoto';
import { restaurantVisitPhotos } from '@/lib/restaurantVisitPhotos';

vi.mock('@/lib/restaurantVisitPhotos', () => ({
  restaurantVisitPhotos: { signedUrl: vi.fn() },
}));

describe('Restaurant visit photo', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows a loading state until the private signed URL is ready', async () => {
    let resolveUrl!: (url: string) => void;
    vi.mocked(restaurantVisitPhotos.signedUrl).mockImplementationOnce(() => new Promise(resolve => { resolveUrl = resolve; }));
    render(<RestaurantVisitPhoto userId="alice" path="alice/restaurants/visit/photo.webp" />);

    expect(screen.getByRole('status')).toHaveTextContent('Učitavanje');
    expect(screen.queryByText('Fotografija nije dostupna')).not.toBeInTheDocument();
    resolveUrl('https://example.test/signed/photo.webp');
    expect(await screen.findByAltText('Fotografija posjeta')).toBeInTheDocument();
  });

  it('shows a clear fallback when a signed URL cannot be created', async () => {
    vi.mocked(restaurantVisitPhotos.signedUrl).mockRejectedValueOnce(new Error('raw storage response'));
    render(<RestaurantVisitPhoto userId="alice" path="alice/restaurants/visit/photo.webp" />);

    expect(await screen.findByText('Fotografija nije dostupna')).toBeInTheDocument();
    expect(screen.queryByText('raw storage response')).not.toBeInTheDocument();
  });
});
