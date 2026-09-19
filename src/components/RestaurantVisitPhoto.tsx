import { useEffect, useState } from 'react';
import { restaurantVisitPhotos } from '@/lib/restaurantVisitPhotos';

export function RestaurantVisitPhoto({ userId, path, small = false }: { userId: string; path: string; small?: boolean }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    let active = true;
    setUrl('');
    void restaurantVisitPhotos.signedUrl(userId, path).then(value => { if (active) setUrl(value); }).catch(() => { if (active) setUrl(''); });
    return () => { active = false; };
  }, [userId, path]);
  const size = small ? 'h-16 w-16' : 'h-24 w-24';
  return url
    ? <a href={url} target="_blank" rel="noreferrer" aria-label="Otvori fotografiju"><img src={url} alt="Fotografija posjeta" className={`${size} rounded-lg object-cover`} /></a>
    : <span className={`flex ${size} items-center justify-center rounded-lg bg-muted text-xs`}>Fotografija nije dostupna</span>;
}
