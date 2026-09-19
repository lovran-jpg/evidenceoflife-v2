import { supabase } from '@/integrations/supabase/client';
import { databaseError, requireCanonicalPhotos, requireIsoDate, requireRating, RestaurantServiceError } from '@/lib/restaurantDomain';
import type { RestaurantVisit, VisitChanges, VisitInput } from '@/lib/restaurantDomain';
import { createRestaurantService } from '@/lib/restaurants';

export function createRestaurantVisitService(db: typeof supabase = supabase) {
  const restaurantService = createRestaurantService(db);

  async function requireRestaurant(userId: string, placeId: string): Promise<void> {
    if (!await restaurantService.get(userId, placeId)) {
      throw new RestaurantServiceError('not_found', 'Restaurant not found.');
    }
  }

  async function get(userId: string, id: string): Promise<RestaurantVisit | null> {
    const { data, error } = await db.from('visits').select('*').eq('user_id', userId).eq('id', id).maybeSingle();
    if (error) throw databaseError('Could not load visit', error);
    if (!data) return null;
    return await restaurantService.get(userId, data.place_id) ? data : null;
  }

  return {
    get,
    async list(userId: string, placeId: string): Promise<RestaurantVisit[]> {
      await requireRestaurant(userId, placeId);
      const { data, error } = await db.from('visits').select('*')
        .eq('user_id', userId).eq('place_id', placeId).order('date', { ascending: false });
      if (error) throw databaseError('Could not load visits', error);
      return data ?? [];
    },
    async create(userId: string, input: VisitInput): Promise<RestaurantVisit> {
      await requireRestaurant(userId, input.place_id);
      requireIsoDate(input.date);
      requireRating(input.rating);
      requireCanonicalPhotos(userId, input.photos ?? []);
      const { data, error } = await db.from('visits').insert({
        user_id: userId, place_id: input.place_id, date: input.date,
        moment_id: null, what_i_ate: input.what_i_ate ?? null,
        note: input.note ?? null, rating: input.rating ?? null, photos: input.photos ?? [],
      }).select('*').single();
      if (error) throw databaseError('Could not create visit', error);
      return data;
    },
    async update(userId: string, id: string, changes: VisitChanges): Promise<RestaurantVisit> {
      const current = await get(userId, id);
      if (!current) throw new RestaurantServiceError('not_found', 'Visit not found.');
      if (changes.place_id !== undefined) await requireRestaurant(userId, changes.place_id);
      if (changes.date !== undefined) requireIsoDate(changes.date);
      if (changes.rating !== undefined) requireRating(changes.rating);
      if (changes.photos !== undefined) requireCanonicalPhotos(userId, changes.photos);
      const { data, error } = await db.from('visits').update(changes)
        .eq('id', id).eq('user_id', userId).select('*').maybeSingle();
      if (error) throw databaseError('Could not update visit', error);
      if (!data) throw new RestaurantServiceError('not_found', 'Visit not found.');
      return data;
    },
    async delete(userId: string, id: string): Promise<void> {
      if (!await get(userId, id)) throw new RestaurantServiceError('not_found', 'Visit not found.');
      const { data, error } = await db.from('visits').delete()
        .eq('id', id).eq('user_id', userId).select('id').maybeSingle();
      if (error) throw databaseError('Could not delete visit', error);
      if (!data) throw new RestaurantServiceError('not_found', 'Visit not found.');
    },
  };
}

export const restaurantVisits = createRestaurantVisitService();
