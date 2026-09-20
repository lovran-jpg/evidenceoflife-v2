import { supabase } from '@/integrations/supabase/client';
import { databaseError, requireName, RestaurantServiceError } from '@/lib/restaurantDomain';
import type { Restaurant, RestaurantChanges, RestaurantInput } from '@/lib/restaurantDomain';

export function createRestaurantService(db: typeof supabase = supabase) {
  async function get(userId: string, id: string): Promise<Restaurant | null> {
    const { data, error } = await db.from('places').select('*')
      .eq('user_id', userId).eq('category', 'restaurant').eq('id', id).maybeSingle();
    if (error) throw databaseError('Could not load restaurant', error);
    return data;
  }

  return {
    get,
    async list(userId: string): Promise<Restaurant[]> {
      const { data, error } = await db.from('places').select('*')
        .eq('user_id', userId).eq('category', 'restaurant').order('created_at', { ascending: false });
      if (error) throw databaseError('Could not load restaurants', error);
      return data ?? [];
    },
    async create(userId: string, input: RestaurantInput): Promise<Restaurant> {
      const { data, error } = await db.from('places').insert({
        ...input, name: requireName(input.name), category: 'restaurant', user_id: userId,
        city_id: input.city_id ?? null, lat: input.lat ?? null, lng: input.lng ?? null,
        ...(input.address === undefined ? {} : { address: input.address?.trim() || null }),
        ...(input.google_place_id === undefined ? {} : { google_place_id: input.google_place_id?.trim() || null }),
      }).select('*').single();
      if (error) throw databaseError('Could not create restaurant', error);
      return data;
    },
    async update(userId: string, id: string, changes: RestaurantChanges): Promise<Restaurant> {
      const current = await get(userId, id);
      if (!current) throw new RestaurantServiceError('not_found', 'Restaurant not found.');
      const payload = {
        ...changes,
        ...(changes.name === undefined ? {} : { name: requireName(changes.name) }),
        ...(changes.address === undefined ? {} : { address: changes.address?.trim() || null }),
        ...(changes.google_place_id === undefined ? {} : { google_place_id: changes.google_place_id?.trim() || null }),
      };
      const { data, error } = await db.from('places').update(payload)
        .eq('id', id).eq('user_id', userId).eq('category', 'restaurant').select('*').maybeSingle();
      if (error) throw databaseError('Could not update restaurant', error);
      if (!data) throw new RestaurantServiceError('not_found', 'Restaurant not found.');
      return data;
    },
    async delete(userId: string, id: string): Promise<void> {
      if (!await get(userId, id)) throw new RestaurantServiceError('not_found', 'Restaurant not found.');
      const { data, error } = await db.from('places').delete()
        .eq('id', id).eq('user_id', userId).eq('category', 'restaurant').select('id').maybeSingle();
      if (error) throw databaseError('Could not delete restaurant', error);
      if (!data) throw new RestaurantServiceError('not_found', 'Restaurant not found.');
    },
  };
}

export const restaurants = createRestaurantService();
