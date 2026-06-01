export interface MomentLinkPreview {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
}

export interface Moment {
  id: string;
  date: string; // ISO date string
  text?: string;
  emoji?: string;
  photos: string[];
  links?: MomentLinkPreview[];
  tags?: string[];
  location?: {
    name: string;
    lat: number;
    lng: number;
    category?: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other';
  };
  isSpecial?: boolean;
  createdAt: string;
  timer_started_at?: string | null;
  timer_ended_at?: string | null;
  timer_seconds?: number | null;
}

export interface Place {
  id: string;
  name: string;
  lat: number;
  lng: number;
  category: 'restaurant' | 'coffee' | 'grocery' | 'park' | 'museum' | 'other';
  visits: PlaceVisit[];
}

export interface PlaceVisit {
  id: string;
  date: string;
  photos: string[];
  note?: string;
}

export interface DayRecord {
  date: string;
  moments: Moment[];
  hasPhotos: boolean;
  hasSpecial: boolean;
}

export type TabType = 'today' | 'calendar' | 'map' | 'dues' | 'habits' | 'profile' | 'notes' | 'linkup';
export type TodayMode = 'plan' | 'recap';
