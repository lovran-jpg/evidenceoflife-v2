import { toast } from 'sonner';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_PHOTOS = 10;

export function validatePhotoFile(file: File): boolean {
  if (!ALLOWED_TYPES.includes(file.type)) {
    toast.error(`Invalid file type: ${file.type}. Only PNG, JPEG, GIF, WebP allowed.`);
    return false;
  }
  if (file.size > MAX_FILE_SIZE) {
    toast.error(`File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Max 5MB.`);
    return false;
  }
  return true;
}

export function canAddMorePhotos(currentCount: number, adding: number): boolean {
  if (currentCount + adding > MAX_PHOTOS) {
    toast.error(`Max ${MAX_PHOTOS} photos per moment.`);
    return false;
  }
  return true;
}
