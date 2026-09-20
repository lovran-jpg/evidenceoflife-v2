import { useEffect, useState } from 'react';
import { restaurantVisitPhotos } from '@/lib/restaurantVisitPhotos';

export function RestaurantVisitPhoto({ userId, path, small = false }: { userId: string; path: string; small?: boolean }) {
  const [url, setUrl] = useState('');
  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  useEffect(() => {
    let active = true;
    setUrl('');
    setState('loading');
    void restaurantVisitPhotos.signedUrl(userId, path).then(value => {
      if (active) { setUrl(value); setState('ready'); }
    }).catch(() => {
      if (active) { setUrl(''); setState('error'); }
    });
    return () => { active = false; };
  }, [userId, path]);
  const size = small ? 'h-16 w-16' : 'h-24 w-24';
  if (state === 'loading') return <span role="status" className={`flex ${size} items-center justify-center rounded-lg bg-muted px-2 text-center text-xs text-muted-foreground`}>Učitavanje…</span>;
  if (state === 'error' || !url) return <span className={`flex ${size} items-center justify-center rounded-lg bg-muted px-2 text-center text-xs text-muted-foreground`}>Fotografija nije dostupna</span>;
  return <a href={url} target="_blank" rel="noreferrer" aria-label="Otvori fotografiju">
    <img src={url} alt="Fotografija posjeta" className={`${size} rounded-lg object-cover`} onError={() => setState('error')} />
  </a>;
}
