import { supabase } from '@/integrations/supabase/client';
import { requireCanonicalPhotos, RestaurantServiceError } from '@/lib/restaurantDomain';
import type { RestaurantVisit, VisitChanges, VisitInput } from '@/lib/restaurantDomain';
import { createRestaurantVisitService } from '@/lib/restaurantVisits';

const BUCKET = 'moment-photos';
const MAX_PHOTOS = 10;
const MAX_BYTES = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp',
  'image/gif': 'gif', 'image/heic': 'heic', 'image/heif': 'heif',
};

export class VisitPhotoError extends Error {
  constructor(message: string, public readonly committed = false, public readonly orphanedPaths: string[] = [], public readonly cause?: unknown) {
    super(message);
    this.name = 'VisitPhotoError';
  }
}

export function isVisitOwnedPath(userId: string, visitId: string, path: string): boolean {
  try {
    requireCanonicalPhotos(userId, [path]);
    return path.startsWith(`${userId}/restaurants/${visitId}/`);
  } catch { return false; }
}

export function validateVisitFiles(files: File[], existingCount = 0): void {
  if (existingCount + files.length > MAX_PHOTOS) throw new VisitPhotoError(`Najviše ${MAX_PHOTOS} fotografija po posjetu.`);
  for (const file of files) {
    if (!EXTENSIONS[file.type] || file.size === 0 || file.size > MAX_BYTES) {
      throw new VisitPhotoError('Fotografija mora biti JPEG, PNG, WebP, GIF ili HEIC/HEIF, veličine do 5 MB.');
    }
  }
}

type VisitApi = ReturnType<typeof createRestaurantVisitService>;

export function createRestaurantVisitPhotoService(db: typeof supabase = supabase, visits: VisitApi = createRestaurantVisitService(db)) {
  const bucket = () => db.storage.from(BUCKET);

  async function cleanup(paths: string[]): Promise<string[]> {
    if (!paths.length) return [];
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const { error } = await bucket().remove(paths);
        if (!error) return [];
      } catch { /* A network rejection is retried below. */ }
    }
    return paths;
  }

  async function upload(userId: string, visitId: string, files: File[], uploaded: string[]): Promise<void> {
    for (const file of files) {
      const path = `${userId}/restaurants/${visitId}/${crypto.randomUUID()}.${EXTENSIONS[file.type]}`;
      const { error } = await bucket().upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw new VisitPhotoError(`Prijenos fotografije nije uspio: ${error.message}`, false, [], error);
      uploaded.push(path);
    }
  }

  async function withRollback<T>(uploaded: string[], action: () => Promise<T>): Promise<T> {
    try { return await action(); }
    catch (cause) {
      const orphaned = await cleanup(uploaded);
      const reason = cause instanceof Error ? cause.message : 'Nepoznata greška.';
      throw new VisitPhotoError(`Posjet nije spremljen. ${reason}${orphaned.length ? ' Čišćenje novih fotografija nije uspjelo.' : ''}`, false, orphaned, cause);
    }
  }

  return {
    async create(userId: string, input: VisitInput, files: File[]): Promise<RestaurantVisit> {
      if (input.photos?.length) throw new VisitPhotoError('Novi posjet prihvaća samo fotografije odabrane u ovom obrascu.');
      validateVisitFiles(files);
      const id = crypto.randomUUID();
      const uploaded: string[] = [];
      return withRollback(uploaded, async () => {
        await upload(userId, id, files, uploaded);
        return visits.create(userId, { ...input, id, photos: uploaded });
      });
    },
    async update(userId: string, id: string, changes: VisitChanges, retained: string[], files: File[]): Promise<RestaurantVisit> {
      const current = await visits.get(userId, id);
      if (!current) throw new RestaurantServiceError('not_found', 'Visit not found.');
      if (changes.place_id && changes.place_id !== current.place_id) throw new VisitPhotoError('Fotografije se ne mogu premjestiti na drugi restoran.');
      if (retained.some(path => !current.photos.includes(path)) || new Set(retained).size !== retained.length) {
        throw new VisitPhotoError('Popis postojećih fotografija nije valjan.');
      }
      validateVisitFiles(files, retained.length);
      const previousPhotos = [...current.photos];
      const uploaded: string[] = [];
      const saved = await withRollback(uploaded, async () => {
        await upload(userId, id, files, uploaded);
        return visits.update(userId, id, { ...changes, photos: [...retained, ...uploaded] });
      });
      // Update DB first: failed writes must never destroy existing photos.
      const removed = previousPhotos.filter(path => !retained.includes(path) && isVisitOwnedPath(userId, id, path));
      const orphaned = await cleanup(removed);
      if (orphaned.length) throw new VisitPhotoError('Posjet je spremljen, ali brisanje uklonjenih fotografija nije uspjelo.', true, orphaned);
      return saved;
    },
    async delete(userId: string, id: string): Promise<void> {
      const current = await visits.get(userId, id);
      if (!current) throw new RestaurantServiceError('not_found', 'Visit not found.');
      // Delete the DB row first so a failed DB request never destroys the user's files.
      await visits.delete(userId, id);
      const owned = current.photos.filter(path => isVisitOwnedPath(userId, id, path));
      const orphaned = await cleanup(owned);
      if (orphaned.length) throw new VisitPhotoError('Posjet je obrisan, ali brisanje nekih fotografija nije uspjelo.', true, orphaned);
    },
    async signedUrl(userId: string, path: string): Promise<string> {
      if (/^data:image\/(?:png|jpeg|webp|gif);base64,/i.test(path)) return path; // Read-only legacy record.
      requireCanonicalPhotos(userId, [path]);
      const { data, error } = await bucket().createSignedUrl(path, 3600);
      if (error || !data?.signedUrl) throw new VisitPhotoError(`Fotografija nije dostupna. ${error?.message ?? ''}`);
      return data.signedUrl;
    },
  };
}

export const restaurantVisitPhotos = createRestaurantVisitPhotoService();
