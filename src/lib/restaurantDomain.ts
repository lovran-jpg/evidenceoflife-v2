import type { Tables } from '@/integrations/supabase/types';

export type Restaurant = Tables<'places'>;
export type RestaurantVisit = Tables<'visits'>;

export type RestaurantInput = Pick<Restaurant, 'name' | 'city_id' | 'lat' | 'lng'>;
export type RestaurantChanges = Partial<RestaurantInput>;
export type VisitInput = Pick<RestaurantVisit, 'place_id' | 'date'> &
  Partial<Pick<RestaurantVisit, 'what_i_ate' | 'note' | 'rating' | 'photos'>>;
export type VisitChanges = Partial<VisitInput>;

export class RestaurantServiceError extends Error {
  constructor(
    public readonly code: 'invalid_input' | 'not_found' | 'database',
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RestaurantServiceError';
  }
}

export function requireName(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) throw new RestaurantServiceError('invalid_input', 'Restaurant name is required.');
  return trimmed;
}

export function requireIsoDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) ||
      Number.isNaN(Date.parse(`${date}T00:00:00Z`)) ||
      new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) !== date) {
    throw new RestaurantServiceError('invalid_input', 'Visit date must be a valid yyyy-MM-dd date.');
  }
}

export function requireRating(rating: number | null | undefined): void {
  if (rating != null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) {
    throw new RestaurantServiceError('invalid_input', 'Rating must be empty or an integer from 1 to 5.');
  }
}

/** The storage API stores object paths without a bucket prefix, e.g. user-id/photo.jpg. */
export function requireCanonicalPhotos(userId: string, photos: string[]): void {
  for (const path of photos) {
    if (typeof path !== 'string' || !path.startsWith(`${userId}/`)) {
      throw new RestaurantServiceError('invalid_input', 'Photos must be canonical Storage paths in the user folder.');
    }
    const parts = path.split('/');
    if (parts.length < 2 || parts.some(part => !part || part === '.' || part === '..') ||
        /[?#\s\\]/.test(path) || [...path].some(character => character.charCodeAt(0) < 32)) {
      throw new RestaurantServiceError('invalid_input', 'Photos must be canonical Storage paths in the user folder.');
    }
  }
}

export function databaseError(action: string, error: { message: string }): RestaurantServiceError {
  return new RestaurantServiceError('database', `${action}: ${error.message}`, error);
}
