export interface GooglePoint { lat: number; lng: number }

export interface GoogleMapObject {
  fitBounds(bounds: GoogleBoundsObject, padding?: number): void;
  setCenter(point: GooglePoint): void;
  setZoom(zoom: number): void;
}

export interface GoogleBoundsObject { extend(point: GooglePoint): void }

export interface GoogleMarkerObject {
  map: GoogleMapObject | null;
  addListener(event: 'click', callback: () => void): { remove(): void };
}

export interface GoogleMapsLibrary {
  Map: new (element: HTMLElement, options: { center: GooglePoint; zoom: number; mapId: string; mapTypeControl: boolean; streetViewControl: boolean }) => GoogleMapObject;
}

export interface GoogleCoreLibrary {
  LatLngBounds: new () => GoogleBoundsObject;
}

export interface GoogleMarkerLibrary {
  AdvancedMarkerElement: new (options: { map: GoogleMapObject; position: GooglePoint; title: string }) => GoogleMarkerObject;
}

export interface GooglePlaceResult {
  id: string;
  displayName?: string;
  formattedAddress?: string;
  location?: { lat(): number; lng(): number };
  fetchFields(options: { fields: string[] }): Promise<unknown>;
}

export interface GooglePlacePrediction {
  placeId: string;
  text: { toString(): string };
  toPlace(): GooglePlaceResult;
}

export interface GooglePlacesLibrary {
  Place: new (options: { id: string }) => GooglePlaceResult;
  AutocompleteSessionToken: new () => object;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions(request: {
      input: string;
      includedPrimaryTypes: string[];
      language: string;
      sessionToken: object;
    }): Promise<{ suggestions: Array<{ placePrediction?: GooglePlacePrediction }> }>;
  };
}

interface GoogleMapsApi {
  importLibrary(name: 'core'): Promise<GoogleCoreLibrary>;
  importLibrary(name: 'maps'): Promise<GoogleMapsLibrary>;
  importLibrary(name: 'marker'): Promise<GoogleMarkerLibrary>;
  importLibrary(name: 'places'): Promise<GooglePlacesLibrary>;
}

type GoogleWindow = Window & {
  google?: { maps: GoogleMapsApi };
  __restaurantGoogleMapsReady?: () => void;
};

let loading: Promise<GoogleMapsApi> | null = null;

export function googleMapsConfig() {
  return {
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() ?? '',
    mapId: import.meta.env.VITE_GOOGLE_MAPS_MAP_ID?.trim() ?? '',
  };
}

export function loadGoogleMaps(): Promise<GoogleMapsApi> {
  const { apiKey } = googleMapsConfig();
  if (!apiKey) return Promise.reject(new Error('Google Maps nije konfiguriran. Dodajte VITE_GOOGLE_MAPS_API_KEY.'));
  const browser = window as GoogleWindow;
  if (browser.google?.maps?.importLibrary) return Promise.resolve(browser.google.maps);
  if (loading) return loading;
  loading = new Promise<GoogleMapsApi>((resolve, reject) => {
    const script = document.createElement('script');
    const timeout = window.setTimeout(() => fail(new Error('Google Maps se nije učitao na vrijeme.')), 15000);
    function fail(error: Error) {
      window.clearTimeout(timeout);
      delete browser.__restaurantGoogleMapsReady;
      script.remove();
      loading = null;
      reject(error);
    }
    browser.__restaurantGoogleMapsReady = () => {
      window.clearTimeout(timeout);
      delete browser.__restaurantGoogleMapsReady;
      if (!browser.google?.maps?.importLibrary) { fail(new Error('Google Maps nije dostupan.')); return; }
      resolve(browser.google.maps);
    };
    script.async = true;
    script.onerror = () => fail(new Error('Google Maps nije moguće učitati. Provjerite ključ i dopuštenu domenu.'));
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly&loading=async&callback=__restaurantGoogleMapsReady`;
    document.head.appendChild(script);
  });
  return loading;
}

export interface GoogleRestaurantSuggestion {
  placeId: string;
  label: string;
  prediction: GooglePlacePrediction;
}

export function createGoogleRestaurantSearch() {
  let token: object | null = null;
  return {
    async suggest(input: string): Promise<GoogleRestaurantSuggestion[]> {
      if (input.trim().length < 3) return [];
      const places = await (await loadGoogleMaps()).importLibrary('places');
      token ??= new places.AutocompleteSessionToken();
      const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: input.trim(), includedPrimaryTypes: ['restaurant'], language: 'hr', sessionToken: token,
      });
      return suggestions.flatMap(suggestion => suggestion.placePrediction
        ? [{ placeId: suggestion.placePrediction.placeId, label: suggestion.placePrediction.text.toString(), prediction: suggestion.placePrediction }]
        : []);
    },
    async select(suggestion: GoogleRestaurantSuggestion): Promise<{ placeId: string; name: string; address: string | null }> {
      const place = suggestion.prediction.toPlace();
      await place.fetchFields({ fields: ['id', 'displayName', 'formattedAddress'] });
      token = null; // fetchFields completes this billing session.
      return { placeId: place.id, name: place.displayName || suggestion.label, address: place.formattedAddress || null };
    },
  };
}

export async function fetchGooglePlaceLocation(placeId: string): Promise<GooglePoint | null> {
  const places = await (await loadGoogleMaps()).importLibrary('places');
  const place = new places.Place({ id: placeId });
  await place.fetchFields({ fields: ['location'] });
  const point = place.location && { lat: place.location.lat(), lng: place.location.lng() };
  return point && Number.isFinite(point.lat) && Number.isFinite(point.lng) ? point : null;
}
