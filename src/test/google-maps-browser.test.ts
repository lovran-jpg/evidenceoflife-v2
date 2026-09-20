import { afterEach, describe, expect, it, vi } from 'vitest';
import { createGoogleRestaurantSearch, fetchGooglePlaceLocation } from '@/lib/googleMapsBrowser';

afterEach(() => {
  vi.unstubAllEnvs();
  delete (window as Window & { google?: unknown }).google;
});

describe('Google restaurant lookup', () => {
  it('uses a Places session for suggestions, fetches transient name/address and retains the Place ID', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'restricted-browser-key');
    const fetchFields = vi.fn(async () => {});
    const place = { id: 'google-place-1', displayName: 'Google Bistro', formattedAddress: 'Trg 1, Zagreb', fetchFields };
    const prediction = { placeId: 'google-place-1', text: { toString: () => 'Google Bistro, Zagreb' }, toPlace: () => place };
    const fetchAutocompleteSuggestions = vi.fn(async () => ({ suggestions: [{ placePrediction: prediction }] }));
    const importLibrary = vi.fn(async () => ({
      AutocompleteSessionToken: class {},
      AutocompleteSuggestion: { fetchAutocompleteSuggestions },
    }));
    (window as Window & { google?: unknown }).google = { maps: { importLibrary } };

    const search = createGoogleRestaurantSearch();
    expect(await search.suggest('Bi')).toEqual([]);
    const suggestions = await search.suggest('Bistro');
    expect(fetchAutocompleteSuggestions).toHaveBeenCalledWith(expect.objectContaining({
      input: 'Bistro', includedPrimaryTypes: ['restaurant'], language: 'hr', sessionToken: expect.any(Object),
    }));
    expect(suggestions[0]).toMatchObject({ placeId: 'google-place-1', label: 'Google Bistro, Zagreb' });
    expect(await search.select(suggestions[0])).toEqual({
      placeId: 'google-place-1', name: 'Google Bistro', address: 'Trg 1, Zagreb',
    });
    expect(fetchFields).toHaveBeenCalledWith({ fields: ['id', 'displayName', 'formattedAddress'] });
  });

  it('fetches coordinates on demand without writing them to the restaurant row', async () => {
    vi.stubEnv('VITE_GOOGLE_MAPS_API_KEY', 'restricted-browser-key');
    const fetchFields = vi.fn(async () => {});
    const Place = vi.fn(function (this: object) {
      Object.assign(this, { location: { lat: () => 45.8, lng: () => 15.9 }, fetchFields });
    });
    (window as Window & { google?: unknown }).google = { maps: { importLibrary: async () => ({ Place }) } };
    expect(await fetchGooglePlaceLocation('google-place-1')).toEqual({ lat: 45.8, lng: 15.9 });
    expect(Place).toHaveBeenCalledWith({ id: 'google-place-1' });
    expect(fetchFields).toHaveBeenCalledWith({ fields: ['location'] });
  });
});
