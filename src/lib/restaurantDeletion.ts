import { supabase } from '@/integrations/supabase/client';
import { isVisitOwnedPath } from '@/lib/restaurantVisitPhotos';
import { restaurants } from '@/lib/restaurants';
import { restaurantVisits } from '@/lib/restaurantVisits';

const BUCKET = 'moment-photos';
const STORAGE_DELETE_BATCH = 100;

type RestaurantDeleteApi = Pick<typeof restaurants, 'get' | 'delete'>;
type VisitListApi = Pick<typeof restaurantVisits, 'list'>;

export class RestaurantDeletionError extends Error {
  constructor(
    message: string,
    public readonly stage: 'storage' | 'database',
    public readonly affectedPaths: string[],
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = 'RestaurantDeletionError';
  }
}

export function createRestaurantDeletionService(
  db: typeof supabase = supabase,
  restaurantApi: RestaurantDeleteApi = restaurants,
  visitApi: VisitListApi = restaurantVisits,
) {
  return {
    async delete(userId: string, restaurantId: string): Promise<void> {
      const restaurant = await restaurantApi.get(userId, restaurantId);
      if (!restaurant) throw new RestaurantDeletionError('Restoran nije pronađen ili ga nemaš pravo obrisati.', 'database', []);

      const visits = await visitApi.list(userId, restaurantId);
      const paths = [...new Set(visits
        .filter(visit => visit.user_id === userId && visit.place_id === restaurantId)
        .flatMap(visit => visit.photos.filter(path => isVisitOwnedPath(userId, visit.id, path))))];

      if (paths.length) {
        try {
          for (let offset = 0; offset < paths.length; offset += STORAGE_DELETE_BATCH) {
            const { error } = await db.storage.from(BUCKET).remove(paths.slice(offset, offset + STORAGE_DELETE_BATCH));
            if (error) throw error;
          }
        } catch (cause) {
          throw new RestaurantDeletionError(
            'Restoran nije obrisan jer čišćenje fotografija nije potpuno uspjelo. Zapisi su ostali sačuvani, ali dio fotografija možda je već uklonjen; pokušaj ponovno.',
            'storage', paths, cause,
          );
        }
      }

      try {
        // The existing owner-aware FK cascade removes this restaurant's visits atomically.
        await restaurantApi.delete(userId, restaurantId);
      } catch (cause) {
        throw new RestaurantDeletionError(
          paths.length
            ? 'Fotografije su uklonjene, ali restoran i njegovi posjeti nisu obrisani. Pokušaj ponovno.'
            : 'Restoran nije obrisan. Pokušaj ponovno.',
          'database', paths, cause,
        );
      }
    },
  };
}

export const restaurantDeletion = createRestaurantDeletionService();
