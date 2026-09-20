import type { Restaurant, RestaurantVisit } from '@/lib/restaurantDomain';
import { restaurants } from '@/lib/restaurants';
import { restaurantVisits } from '@/lib/restaurantVisits';

export interface MappedRestaurant {
  restaurant: Restaurant;
  lat: number;
  lng: number;
  visitCount: number;
  lastVisit: string | null;
}

export function hasMapLocation(restaurant: Restaurant): restaurant is Restaurant & { lat: number; lng: number } {
  return restaurant.lat != null && restaurant.lng != null &&
    Number.isFinite(restaurant.lat) && Number.isFinite(restaurant.lng) &&
    restaurant.lat >= -90 && restaurant.lat <= 90 && restaurant.lng >= -180 && restaurant.lng <= 180;
}

export function summarizeMappedRestaurant(restaurant: Restaurant, visits: RestaurantVisit[]): MappedRestaurant | null {
  if (!hasMapLocation(restaurant)) return null;
  return {
    restaurant,
    lat: restaurant.lat,
    lng: restaurant.lng,
    visitCount: visits.length,
    lastVisit: visits.reduce<string | null>((latest, visit) => !latest || visit.date > latest ? visit.date : latest, null),
  };
}

export type GoogleLocationResolver = (placeId: string) => Promise<{ lat: number; lng: number } | null>;

type RestaurantReader = Pick<typeof restaurants, 'list'>;
type VisitReader = Pick<typeof restaurantVisits, 'list'>;

export function createRestaurantMapService(restaurantReader: RestaurantReader = restaurants, visitReader: VisitReader = restaurantVisits) {
  return {
    async list(userId: string, resolveGoogleLocation?: GoogleLocationResolver): Promise<MappedRestaurant[]> {
      const owned = await restaurantReader.list(userId);
      const located = await Promise.all(owned.map(async restaurant => {
        if (restaurant.lat != null && restaurant.lng != null && Number.isFinite(restaurant.lat) &&
            Number.isFinite(restaurant.lng) && restaurant.lat >= -90 && restaurant.lat <= 90 &&
            restaurant.lng >= -180 && restaurant.lng <= 180) return restaurant;
        if (!restaurant.google_place_id || !resolveGoogleLocation) return null;
        try {
          const point = await resolveGoogleLocation(restaurant.google_place_id);
          return point && Number.isFinite(point.lat) && Number.isFinite(point.lng) &&
            point.lat >= -90 && point.lat <= 90 && point.lng >= -180 && point.lng <= 180
            ? { ...restaurant, ...point } : null;
        } catch { return null; } // One stale Google ID must not hide other restaurants.
      }));
      const mapped = located.filter((restaurant): restaurant is Restaurant & { lat: number; lng: number } => restaurant !== null);
      return Promise.all(mapped.map(async restaurant =>
        summarizeMappedRestaurant(restaurant, await visitReader.list(userId, restaurant.id)) as MappedRestaurant));
    },
  };
}

export const restaurantMap = createRestaurantMapService();
