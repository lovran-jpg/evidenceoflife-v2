import { RestaurantDeletionError } from '@/lib/restaurantDeletion';
import { RestaurantServiceError } from '@/lib/restaurantDomain';
import { VisitPhotoError } from '@/lib/restaurantVisitPhotos';

export function visitCountLabel(count: number): string {
  return `${count} ${count === 1 ? 'posjet' : 'posjeta'}`;
}

export function restaurantUiError(error: unknown, fallback: string): string {
  if (error instanceof VisitPhotoError || error instanceof RestaurantDeletionError) return error.message;
  if (error instanceof RestaurantServiceError) {
    if (error.code === 'invalid_input') return error.message;
    if (error.code === 'not_found') return 'Traženi zapis nije pronađen.';
  }
  return fallback;
}
