import { useState, useMemo, useEffect, useRef, useCallback, Component, type ErrorInfo, type ReactNode } from 'react';
import { useDateLocale } from '@/hooks/useDateLocale';
import { MapPin, Coffee, UtensilsCrossed, Trees, Building2, ChevronLeft, Globe } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { Moment } from '@/types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/hooks/useLanguage';

import { CityWithPlaces } from '@/hooks/usePlaces';

interface MapViewProps {
  moments: Moment[];
  placesData?: {
    cities: CityWithPlaces[];
    loading: boolean;
  };
  // When set, the map jumps to this place (used when opening the map from a moment's location).
  focusPlace?: { name: string; lat: number; lng: number; token: number } | null;
  // Open the day a visit happened on (jumps back to the Today recap for that date).
  onOpenDate?: (dateStr: string) => void;
}

type Category = 'all' | 'restaurant' | 'coffee' | 'park' | 'museum' | 'other';

const categoryKeys: { id: Category; labelKey: string; icon: typeof MapPin }[] = [
  { id: 'all', labelKey: 'map.all', icon: MapPin },
  { id: 'restaurant', labelKey: 'map.food', icon: UtensilsCrossed },
  { id: 'coffee', labelKey: 'map.coffee', icon: Coffee },
  { id: 'park', labelKey: 'map.outdoors', icon: Trees },
  { id: 'museum', labelKey: 'map.culture', icon: Building2 },
];

const categoryColors: Record<string, string> = {
  restaurant: '#ef4444',
  coffee: '#8b5a2b',
  park: '#22c55e',
  museum: '#8b5cf6',
  other: '#c9a88c',
};

function addTileWithFallback(map: L.Map) {
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
    className: 'map-tiles-light',
  }).addTo(map);
}

// Warm orange accent for life map
const LIFE_MAP_COLOR = '#e8825a';
const DETAIL_MAP_ENABLED = true;
const MAP_SAFE_MODE = false;
const HEATMAP_ENABLED = false;

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface PlaceInfo {
  id: string;
  name: string;
  category: string;
  visits: number;
  lastVisit: string;
  photos: string[];
  lat: number;
  lng: number;
  visitDetails: { date: string; photos: string[]; text?: string; momentId?: string }[];
}

interface CityCluster {
  places: PlaceInfo[];
  centerLat: number;
  centerLng: number;
  cityName: string;
  totalVisits: number;
}

interface WorldCityGroup {
  members: CityCluster[];
  centerLat: number;
  centerLng: number;
  totalVisits: number;
  totalPlaces: number;
}

interface DisplayPlacePoint {
  place: PlaceInfo;
  renderLat: number;
  renderLng: number;
}

class MapDetailErrorBoundary extends Component<
  { children: ReactNode; onClose: () => void; lang: string },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Map detail overlay crashed:', error, info);
  }

  componentDidUpdate(prevProps: Readonly<{ children: ReactNode; onClose: () => void; lang: string }>) {
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false });
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 flex-shrink-0 bg-background/95 backdrop-blur-sm">
            <button onClick={this.props.onClose} className="p-1.5 hover:bg-secondary rounded-xl transition-colors">
              <ChevronLeft size={20} />
            </button>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-sm truncate">
                {this.props.lang === 'zh' ? '地点详情' : 'Place details'}
              </h2>
              <p className="text-[11px] text-muted-foreground/60">
                {this.props.lang === 'zh' ? '详情暂时打不开' : "This detail card couldn't load."}
              </p>
            </div>
          </div>
          <div className="flex-1 flex items-center justify-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-foreground/85">
                {this.props.lang === 'zh' ? '详情加载失败' : 'Detail failed to load'}
              </p>
              <p className="mt-2 text-[12px] leading-6 text-muted-foreground/65">
                {this.props.lang === 'zh' ? '请返回列表重新打开该地点' : 'Go back and reopen the place.'}
              </p>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function clusterByProximity(places: PlaceInfo[], radiusKm = 30): CityCluster[] {
  const assigned = new Set<number>();
  const clusters: CityCluster[] = [];

  for (let i = 0; i < places.length; i++) {
    if (assigned.has(i)) continue;
    const group: PlaceInfo[] = [places[i]];
    assigned.add(i);

    for (let j = i + 1; j < places.length; j++) {
      if (assigned.has(j)) continue;
      const close = group.some(g => haversineKm(g.lat, g.lng, places[j].lat, places[j].lng) < radiusKm);
      if (close) {
        group.push(places[j]);
        assigned.add(j);
      }
    }

    const centerLat = group.reduce((s, p) => s + p.lat, 0) / group.length;
    const centerLng = group.reduce((s, p) => s + p.lng, 0) / group.length;
    const totalVisits = group.reduce((s, p) => s + p.visits, 0);

    clusters.push({ places: group, centerLat, centerLng, cityName: '', totalVisits });
  }

  return clusters.sort((a, b) => b.totalVisits - a.totalVisits);
}

function clusterCitiesForZoom(cities: CityCluster[], zoom: number): WorldCityGroup[] {
  const radiusKm = zoom <= 3 ? 320 : zoom <= 4 ? 180 : zoom <= 5 ? 110 : zoom <= 6 ? 70 : 40;
  const assigned = new Set<number>();
  const groups: WorldCityGroup[] = [];

  for (let i = 0; i < cities.length; i++) {
    if (assigned.has(i)) continue;

    const members: CityCluster[] = [cities[i]];
    assigned.add(i);

    for (let j = i + 1; j < cities.length; j++) {
      if (assigned.has(j)) continue;
      const close = members.some((m) => haversineKm(m.centerLat, m.centerLng, cities[j].centerLat, cities[j].centerLng) < radiusKm);
      if (close) {
        members.push(cities[j]);
        assigned.add(j);
      }
    }

    const totalVisits = members.reduce((sum, city) => sum + city.totalVisits, 0);
    const totalPlaces = members.reduce((sum, city) => sum + city.places.length, 0);
    const weight = Math.max(totalVisits, 1);
    const centerLat = members.reduce((sum, city) => sum + city.centerLat * city.totalVisits, 0) / weight;
    const centerLng = members.reduce((sum, city) => sum + city.centerLng * city.totalVisits, 0) / weight;

    groups.push({ members, centerLat, centerLng, totalVisits, totalPlaces });
  }

  return groups.sort((a, b) => b.totalVisits - a.totalVisits);
}

function dotMarkerHtml(color: string, isSelected: boolean): string {
  const size = isSelected ? 18 : 13;
  const glow = `<circle cx="${size/2}" cy="${size/2}" r="${size/2}" fill="${color}" opacity="0.15"/>`;
  const ring = isSelected ? `<circle cx="${size/2}" cy="${size/2}" r="${size/2 - 1}" fill="none" stroke="white" stroke-width="2"/>` : '';
  return `<div style="width:${size}px;height:${size}px;filter:drop-shadow(0 0 4px ${color}80);transition:transform 0.2s ease;" class="map-dot-marker">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      ${glow}
      ${ring}
      <circle cx="${size/2}" cy="${size/2}" r="${isSelected ? 5 : 4}" fill="${color}"/>
      <circle cx="${size/2}" cy="${size/2}" r="${isSelected ? 3 : 2.5}" fill="white" opacity="0.4"/>
      <circle cx="${size/2}" cy="${size/2}" r="${isSelected ? 5 : 4.5}" fill="${color}" />
      <circle cx="${size/2}" cy="${size/2}" r="${isSelected ? 2 : 1.5}" fill="white" />
    </svg>
  </div>`;
}

function normalizePhotoList(photos: unknown): string[] {
  if (!Array.isArray(photos)) return [];
  return photos.filter((photo): photo is string => typeof photo === 'string' && photo.trim().length > 0);
}

function dedupeVisitDetails(visits: PlaceInfo['visitDetails']): PlaceInfo['visitDetails'] {
  const seen = new Set<string>();
  const result: PlaceInfo['visitDetails'] = [];

  visits.forEach((visit) => {
    const key = visit.momentId
      ? `moment:${visit.momentId}`
      : `fallback:${visit.date}:${visit.text || ''}:${normalizePhotoList(visit.photos).join('|')}`;
    const existing = result.find(item => {
      const itemKey = item.momentId
        ? `moment:${item.momentId}`
        : `fallback:${item.date}:${item.text || ''}:${normalizePhotoList(item.photos).join('|')}`;
      return itemKey === key;
    });

    if (existing) {
      existing.text = existing.text || visit.text;
      existing.photos = Array.from(new Set([...normalizePhotoList(existing.photos), ...normalizePhotoList(visit.photos)]));
      return;
    }

    if (seen.has(key)) return;
    seen.add(key);
    result.push({
      ...visit,
      photos: Array.from(new Set(normalizePhotoList(visit.photos))),
    });
  });

  return result;
}

function escapeHtml(text: string): string {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function photoMarkerHtml(photo: string, color: string, isSelected: boolean, name: string): string {
  const size = isSelected ? 52 : 42;
  const ring = isSelected ? 3 : 2;
  const shadow = isSelected ? '0 10px 24px rgba(35, 25, 20, 0.24)' : '0 8px 18px rgba(35, 25, 20, 0.16)';
  const frameColor = isSelected ? color : 'rgba(214, 190, 172, 0.92)';
  const frameBg = isSelected ? 'rgba(241, 226, 215, 0.92)' : 'rgba(56, 43, 36, 0.92)';

  return `<div style="width:${size}px;height:${size}px;position:relative;filter:drop-shadow(${shadow});">
    <div style="position:absolute;inset:0;border-radius:14px;overflow:hidden;border:${ring}px solid ${frameColor};background:${frameBg};">
      <img src="${escapeHtml(photo)}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover;display:block;" />
    </div>
    <div style="position:absolute;left:50%;bottom:-7px;width:12px;height:12px;background:${frameBg};border-right:${ring}px solid ${frameColor};border-bottom:${ring}px solid ${frameColor};transform:translateX(-50%) rotate(45deg);border-bottom-right-radius:3px;"></div>
  </div>`;
}

function getPlaceCoverPhoto(place: PlaceInfo): string | null {
  if (place.photos.length > 0) return place.photos[0];
  for (const visit of place.visitDetails) {
    if (visit.photos.length > 0) return visit.photos[0];
  }
  return null;
}

function spreadNearbyPlaces(places: PlaceInfo[]): DisplayPlacePoint[] {
  const remaining = places.map((place) => ({ place, renderLat: place.lat, renderLng: place.lng }));
  const used = new Set<string>();
  const groups: DisplayPlacePoint[][] = [];

  for (let i = 0; i < remaining.length; i++) {
    const base = remaining[i];
    if (used.has(base.place.id)) continue;

    const group = [base];
    used.add(base.place.id);

    for (let j = i + 1; j < remaining.length; j++) {
      const candidate = remaining[j];
      if (used.has(candidate.place.id)) continue;
      const distKm = haversineKm(base.place.lat, base.place.lng, candidate.place.lat, candidate.place.lng);
      if (distKm <= 0.12) {
        group.push(candidate);
        used.add(candidate.place.id);
      }
    }

    groups.push(group);
  }

  return groups.flatMap((group) => {
    if (group.length === 1) return group;

    const radius = Math.min(0.0011 + group.length * 0.00008, 0.0016);
    return group.map((item, index) => {
      const angle = (-Math.PI / 2) + (index / group.length) * Math.PI * 2;
      return {
        ...item,
        renderLat: item.place.lat + Math.sin(angle) * radius,
        renderLng: item.place.lng + Math.cos(angle) * radius,
      };
    });
  });
}

function sanitizePlaceInfo(place: PlaceInfo): PlaceInfo {
  return {
    id: place.id || crypto.randomUUID(),
    name: place.name || 'Untitled place',
    category: place.category || 'other',
    visits: Number.isFinite(place.visits) ? place.visits : 0,
    lastVisit: place.lastVisit || '',
    photos: normalizePhotoList(place.photos),
    lat: Number.isFinite(place.lat) ? place.lat : 0,
    lng: Number.isFinite(place.lng) ? place.lng : 0,
    visitDetails: Array.isArray(place.visitDetails)
      ? place.visitDetails.map((visit) => ({
          date: visit?.date || '',
          photos: normalizePhotoList(visit?.photos),
          text: typeof visit?.text === 'string' ? visit.text : undefined,
          momentId: typeof visit?.momentId === 'string' ? visit.momentId : undefined,
        }))
      : [],
  };
}

function formatVisitDateLabel(value: string, formatDate: (date: Date, formatStr?: string) => string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value || '';
  }
  return formatDate(parsed, 'MMM d, yyyy');
}

type ViewMode = 'world' | 'city';

export function MapView({ moments, placesData, focusPlace, onOpenDate }: MapViewProps) {
  const { formatDate } = useDateLocale();
  const { t, lang } = useLanguage();
  const [viewMode, setViewMode] = useState<ViewMode>('city');
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [selectedPlace, setSelectedPlace] = useState<string | null>(null);
  const [showPlaceDetail, setShowPlaceDetail] = useState<PlaceInfo | null>(null);
  const [mapPreviewFailed, setMapPreviewFailed] = useState(false);
  const [detailMapFailed, setDetailMapFailed] = useState(false);
  const [selectedCityIdx, setSelectedCityIdx] = useState<number>(0);
  const autoSelectedRef = useRef(false);
  const mapRef = useRef<L.Map | null>(null);
  const detailMapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<(L.Marker | L.CircleMarker | L.Circle)[]>([]);
  // Store city-view markers keyed by place name for lightweight updates on selection
  const cityMarkerMapRef = useRef(new Map<string, { marker: L.Marker; category: string; lat: number; lng: number; renderLat: number; renderLng: number }>());
  const heatLayerRef = useRef<any>(null);
  const boundaryLayersRef = useRef<L.GeoJSON[]>([]);
  const [cityBoundaries, setCityBoundaries] = useState<Map<string, any>>(new Map());
  // Build all places: merge from new places tables + legacy moments
  const allPlaces = useMemo(() => {
    const placeMap = new Map<string, PlaceInfo>();
    const momentsById = new Map(moments.map((moment) => [moment.id, moment]));
    const momentKey = (name: string, date: string) => `${name.trim().toLowerCase()}__${date}`;
    const momentsByPlaceAndDate = new Map<string, Moment[]>();

    moments.forEach((moment) => {
      if (!moment.location?.name) return;
      const key = momentKey(moment.location.name, moment.date);
      const current = momentsByPlaceAndDate.get(key) || [];
      current.push(moment);
      momentsByPlaceAndDate.set(key, current);
    });

    // 1) New structured places data (priority)
    if (placesData?.cities) {
      placesData.cities.forEach(city => {
        city.places.forEach(p => {
          const existing = placeMap.get(p.name);
          const visitDetails = p.visits.map((v: any) => ({
            date: v.date || '',
            photos: normalizePhotoList(v.photos),
            text: typeof v.note === 'string' && v.note.trim().length > 0 ? v.note : undefined,
            // 如果 visits 表里有绑定 moment_id，用这个来去重
            momentId: v.moment_id || undefined,
          })).map((visit) => {
            const linkedMoment = visit.momentId ? momentsById.get(visit.momentId) : undefined;
            const fallbackMoment = !linkedMoment
              ? (momentsByPlaceAndDate.get(momentKey(p.name, visit.date)) || [])[0]
              : undefined;
            const sourceMoment = linkedMoment || fallbackMoment;

            return {
              ...visit,
              text: visit.text || sourceMoment?.text,
              photos: visit.photos.length > 0 ? visit.photos : normalizePhotoList(sourceMoment?.photos),
              momentId: visit.momentId || sourceMoment?.id,
            };
          });
          if (existing) {
            existing.visits += p.visits.length;
            existing.photos.push(...p.visits.flatMap(v => normalizePhotoList(v.photos)));
            existing.visitDetails.push(...visitDetails);
            if (p.visits.length > 0) {
              const latest = p.visits.reduce((a, b) => a.date > b.date ? a : b);
              if (latest.date > existing.lastVisit) existing.lastVisit = latest.date;
            }
          } else {
            placeMap.set(p.name, {
              id: p.id,
              name: p.name,
              category: p.category || 'other',
              visits: p.visits.length || 1,
              lastVisit: p.visits[0]?.date || '',
              photos: p.visits.flatMap(v => normalizePhotoList(v.photos)),
              lat: p.lat,
              lng: p.lng,
              visitDetails,
            });
          }
        });
      });
    }

    // 2) Legacy moments data (fill gaps)
    moments.forEach(m => {
      if (m.location) {
        const existing = placeMap.get(m.location.name);
        if (existing) {
          // 只要这个 moment 已经作为 visit 记录过（通过 momentId 绑定），就不要重复记次数
          const trackedVisit = existing.visitDetails.find(v => v.momentId === m.id);
          if (trackedVisit) {
            if (!trackedVisit.text && m.text) trackedVisit.text = m.text;
            if (trackedVisit.photos.length === 0 && m.photos.length > 0) {
              trackedVisit.photos = normalizePhotoList(m.photos);
            }
            existing.photos.push(...normalizePhotoList(m.photos));
            if (m.date > existing.lastVisit) existing.lastVisit = m.date;
          } else {
            existing.visits++;
            if (m.date > existing.lastVisit) existing.lastVisit = m.date;
            existing.photos.push(...normalizePhotoList(m.photos));
            existing.visitDetails.push({ date: m.date, photos: normalizePhotoList(m.photos), text: m.text, momentId: m.id });
          }
        } else {
          placeMap.set(m.location.name, {
            id: m.id,
            name: m.location.name,
            category: m.location.category || 'other',
            visits: 1,
            lastVisit: m.date,
            photos: normalizePhotoList(m.photos),
            lat: m.location.lat,
            lng: m.location.lng,
            visitDetails: [{ date: m.date, photos: normalizePhotoList(m.photos), text: m.text, momentId: m.id }],
          });
        }
      }
    });
    return Array.from(placeMap.values())
      .map((place) => {
        const visitDetails = dedupeVisitDetails(place.visitDetails).map((visit) => ({
            ...visit,
            date: visit.date || '',
            photos: Array.from(new Set(normalizePhotoList(visit.photos))),
          }));

        return {
          ...place,
          visits: visitDetails.length,
          photos: Array.from(new Set(normalizePhotoList(place.photos))),
          visitDetails,
        };
      })
      .sort((a, b) => b.visits - a.visits);
  }, [moments, placesData]);

  // Cluster into cities
  const [cities, setCities] = useState<CityCluster[]>([]);

  // Single sequential effect: resolve names → fetch boundaries → reclassify (all in order)
  // const geoInitRef = useRef(false);

  useEffect(() => {
    if (allPlaces.length === 0) {
      setCities([]);
      setCityBoundaries(new Map());
      return;
    }

    const initialCities = clusterByProximity(allPlaces);
    // Use city names from structured places data when available (database has proper names)
    const knownCityNames = new Map<string, string>();
    if (placesData?.cities) {
      placesData.cities.forEach(city => {
        city.places.forEach(p => {
          // Map place coords to their parent city name
          const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
          if (!knownCityNames.has(key)) {
            knownCityNames.set(key, city.name);
          }
        });
      });
    }

    initialCities.forEach((c, i) => {
      // Try to find a matching city name from structured data
      let resolvedName = '';
      for (const p of c.places) {
        const key = `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;
        const cityName = knownCityNames.get(key);
        if (cityName) { resolvedName = cityName; break; }
      }
      // Also check placesData cities by proximity
      if (!resolvedName && placesData?.cities) {
        for (const dbCity of placesData.cities) {
          const dist = haversineKm(c.centerLat, c.centerLng, dbCity.lat, dbCity.lng);
          if (dist < 30) { resolvedName = dbCity.name; break; }
        }
      }
      c.cityName = resolvedName || `Area ${i + 1}`;
    });
    setCities(initialCities);

    let geoSeqCancelled = false;

    const runGeoSequence = async () => {
      try {
        const { supabase } = await import('@/integrations/supabase/client');

        // Step 1: Only resolve city names for clusters that don't already have a name from the database
        const unresolvedCities = initialCities.filter(c => !c.cityName || c.cityName.startsWith('Area '));
        if (unresolvedCities.length > 0) {
          const resolved = [...initialCities];
          for (let i = 0; i < resolved.length; i++) {
            if (geoSeqCancelled) return;
            // Skip cities that already have a name from the database
            if (resolved[i].cityName && !resolved[i].cityName.startsWith('Area ')) continue;
            try {
              const { data } = await supabase.functions.invoke('geo', {
                body: { type: 'reverse', lat: resolved[i].centerLat, lng: resolved[i].centerLng },
              });
              if (data?.city && data.city.trim()) {
                resolved[i] = { ...resolved[i], cityName: data.city.trim() };
              } else if (data?.name) {
                const parts = String(data.name).split(',').map((s: string) => s.trim()).filter(Boolean);
                if (parts.length >= 3) resolved[i] = { ...resolved[i], cityName: parts[parts.length - 2] };
                else if (parts.length >= 2) resolved[i] = { ...resolved[i], cityName: parts[parts.length - 1] };
                else if (parts[0]) resolved[i] = { ...resolved[i], cityName: parts[0] };
              }
            } catch { /* keep fallback name */ }
            if (i < resolved.length - 1) await new Promise(r => setTimeout(r, 1500));
          }
          if (!geoSeqCancelled) setCities(resolved);
        }

        if (geoSeqCancelled) return;

        // Step 2: Fetch boundaries (single call, but the edge fn internally rate-limits)
        const citiesWithNames = initialCities.filter(c => c.cityName && !c.cityName.startsWith('Area '));
        if (citiesWithNames.length > 0) {
          try {
            const { data } = await supabase.functions.invoke('geo', {
              body: {
                type: 'boundaries',
                cities: citiesWithNames.slice(0, 6).map(c => ({
                  name: c.cityName,
                  lat: c.centerLat,
                  lng: c.centerLng,
                })),
              },
            });
            if (!geoSeqCancelled && data?.boundaries?.length > 0) {
              const map = new Map<string, any>();
              data.boundaries.forEach((b: { name: string; geojson: any }) => {
                map.set(b.name, b.geojson);
              });
              setCityBoundaries(map);
            }
          } catch (err) {
            console.warn('Failed to fetch city boundaries:', err);
          }
        }

        if (geoSeqCancelled) return;

        // Step 3: Reclassify (fire-and-forget, non-critical)
        const otherPlaces = allPlaces.filter(p => p.category === 'other');
        if (otherPlaces.length > 0) {
          try {
            await supabase.functions.invoke('geo', {
              body: {
                type: 'reclassify',
                places: otherPlaces.slice(0, 10).map(p => ({ id: p.id, name: p.name, lat: p.lat, lng: p.lng })),
              },
            });
          } catch { /* non-critical */ }
        }
      } catch (err) {
        console.warn('Geo sequence failed:', err);
      }
    };

    runGeoSequence();
    return () => { geoSeqCancelled = true; };
  }, [allPlaces, placesData]);

  // Auto-select closest city to user's location on first load
  useEffect(() => {
    // Only auto-select once. If already auto-selected, do nothing.
    if (autoSelectedRef.current) return;
    if (cities.length === 0) return;

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const userLat = pos.coords.latitude;
          const userLng = pos.coords.longitude;
          let closestIdx = 0;
          let closestDist = Infinity;
          cities.forEach((city, i) => {
            const dist = haversineKm(userLat, userLng, city.centerLat, city.centerLng);
            if (dist < closestDist) {
              closestDist = dist;
              closestIdx = i;
            }
          });
          setSelectedCityIdx(closestIdx);
          autoSelectedRef.current = true;
        },
        () => {
          // Geolocation denied/failed - default to first city (most visits)
          setSelectedCityIdx(0);
          autoSelectedRef.current = true;
        },
        { timeout: 5000 }
      );
    } else {
      setSelectedCityIdx(0);
      autoSelectedRef.current = true;
    }
  }, [cities]);

  // External focus request (e.g. user tapped a moment's location): jump to that place.
  useEffect(() => {
    if (!focusPlace || cities.length === 0) return;
    const target = focusPlace.name.trim().toLowerCase();
    let bestIdx = -1;
    let bestDist = Infinity;
    cities.forEach((city, i) => {
      city.places.forEach((p) => {
        if (p.name.trim().toLowerCase() === target) {
          if (bestIdx !== i) { bestIdx = i; bestDist = 0; }
        } else if (bestDist > 0) {
          const d = haversineKm(focusPlace.lat, focusPlace.lng, p.lat, p.lng);
          if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
      });
    });
    if (bestIdx < 0) return;
    autoSelectedRef.current = true;
    setViewMode('city');
    setSelectedCityIdx(bestIdx);
    setSelectedPlace(focusPlace.name);
  }, [focusPlace, cities]);

  const currentCity = selectedCityIdx >= 0 ? cities[selectedCityIdx] : null;
  const cityPlaces = currentCity?.places || [];

  const filteredPlaces = useMemo(() => {
    if (activeCategory === 'all') return cityPlaces;
    return cityPlaces.filter(p => p.category === activeCategory);
  }, [cityPlaces, activeCategory]);

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'restaurant': return UtensilsCrossed;
      case 'coffee': return Coffee;
      case 'park': return Trees;
      case 'museum': return Building2;
      default: return MapPin;
    }
  };

  // Max visits across cities for intensity calc
  const maxCityVisits = useMemo(() => Math.max(...cities.map(c => c.totalVisits), 1), [cities]);

  const [worldZoom, setWorldZoom] = useState(2);

  const openPlaceDetail = useCallback((place: PlaceInfo) => {
    try {
      setShowPlaceDetail(sanitizePlaceInfo(place));
    } catch (err) {
      console.error('Failed to open place detail', err);
      setShowPlaceDetail({
        id: place.id || crypto.randomUUID(),
        name: place.name || 'Untitled place',
        category: place.category || 'other',
        visits: 0,
        lastVisit: '',
        photos: [],
        lat: Number.isFinite(place.lat) ? place.lat : 0,
        lng: Number.isFinite(place.lng) ? place.lng : 0,
        visitDetails: [],
      });
    }
  }, []);

  // Initialize the main map once, but wait until the container has a measurable size.
  useEffect(() => {
    if (MAP_SAFE_MODE || mapPreviewFailed) return;
    if (!mapContainerRef.current) return;
    if (mapRef.current) return;

    let cancelled = false;
    const resizeTimers: ReturnType<typeof setTimeout>[] = [];

    const initMap = (attempt = 0) => {
      if (cancelled || mapRef.current || !mapContainerRef.current) return;

      const container = mapContainerRef.current;
      const rect = container.getBoundingClientRect();
      if ((rect.width < 8 || rect.height < 8) && attempt < 6) {
        resizeTimers.push(setTimeout(() => initMap(attempt + 1), 120));
        return;
      }

      try {
        const map = L.map(container, {
          center: [30, 0],
          zoom: 2,
          zoomControl: false,
          attributionControl: false,
          // Tile fade-in occasionally stalls at opacity:0 when the container is
          // initialized while hidden / resized repeatedly, leaving a black map.
          // Disabling fade makes loaded tiles paint immediately.
          fadeAnimation: false,
        });

        mapRef.current = map;
        setMapPreviewFailed(false);

        map.on('zoomend', () => setWorldZoom(map.getZoom()));
        setWorldZoom(map.getZoom());

        addTileWithFallback(map);
        L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

        [80, 200, 400, 800, 1400].forEach((ms) => {
          resizeTimers.push(setTimeout(() => {
            if (!cancelled) {
              try {
                map.invalidateSize();
              } catch {}
            }
          }, ms));
        });
      } catch (err) {
        console.error('Failed to initialize life map', err);
        setMapPreviewFailed(true);
      }
    };

    const timer = setTimeout(() => initMap(), 50);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      resizeTimers.forEach(clearTimeout);

      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];
      cityMarkerMapRef.current.clear();

      if (heatLayerRef.current && mapRef.current) {
        mapRef.current.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }

      boundaryLayersRef.current.forEach((l) => l.remove());
      boundaryLayersRef.current = [];

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [mapPreviewFailed]);
  useEffect(() => {
    if (MAP_SAFE_MODE || mapPreviewFailed) return;
    if (!mapContainerRef.current || !mapRef.current) return;

    const el = mapContainerRef.current;
    const observer = new ResizeObserver(() => {
      requestAnimationFrame(() => {
        mapRef.current?.invalidateSize();
      });
    });

    observer.observe(el);

    return () => {
      observer.disconnect();
    };
  }, [viewMode, showPlaceDetail, mapPreviewFailed]);

  // Force the main map to recompute its size whenever it becomes visible again
  // (closing the place detail or switching world/city views). The container is
  // toggled with display:none while a detail is open, which leaves Leaflet with a
  // stale 0×0 size — the markers stay correctly positioned but the tiles render
  // black until invalidateSize() runs. The ResizeObserver above is timing-flaky
  // for display toggles, so we also fire invalidateSize() on a short schedule.
  useEffect(() => {
    if (MAP_SAFE_MODE || mapPreviewFailed) return;
    if (showPlaceDetail) return; // map is hidden; nothing to refresh yet
    if (!mapRef.current) return;

    const map = mapRef.current;
    const timers = [0, 60, 160, 320, 600].map((ms) =>
      setTimeout(() => {
        try {
          map.invalidateSize();
        } catch {
          // ignore stale leaflet state
        }
      }, ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [showPlaceDetail, viewMode, mapPreviewFailed]);

  // Fit to visited cities when switching to world view
  useEffect(() => {
    if (MAP_SAFE_MODE || mapPreviewFailed) return;
    if (!mapRef.current || viewMode !== 'world' || cities.length === 0) return;

    const map = mapRef.current;

    const fitWorld = () => {
      map.invalidateSize();
      const bounds = L.latLngBounds([] as L.LatLngExpression[]);
      // Temporarily fit only by city centers to avoid possible malformed geojson bounds
      cities.forEach((city) => {
        bounds.extend([city.centerLat, city.centerLng]);
      });
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 11, animate: false });
      }
    };

    // Multiple invalidateSize + fit calls to handle container repaint
    const timers = [50, 200, 500, 800].map(ms =>
      setTimeout(fitWorld, ms)
    );
    return () => timers.forEach(clearTimeout);
  }, [cities, viewMode]);
  useEffect(() => {
    if (MAP_SAFE_MODE || mapPreviewFailed) return;
    if (!mapRef.current || viewMode !== 'world') return;

    const map = mapRef.current;
    let cancelled = false;
    let rafHandle: number | null = null;
    let innerTimer: ReturnType<typeof setTimeout> | null = null;

    // Clean up previous layers
    try {
      markersRef.current.forEach((m) => m.remove());
    } catch {}
    markersRef.current = [];
    try {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    } catch {}
    try {
      boundaryLayersRef.current.forEach((l) => l.remove());
    } catch {}
    boundaryLayersRef.current = [];

    // Invalidate size after container height change (world has taller map)
    rafHandle = requestAnimationFrame(() => {
      if (cancelled) return;
      innerTimer = setTimeout(() => {
        if (!cancelled) { try { map.invalidateSize(); } catch {} }
      }, 150);
    });

    if (cities.length === 0) {
      return () => {
        cancelled = true;
        if (rafHandle !== null) cancelAnimationFrame(rafHandle);
        if (innerTimer !== null) clearTimeout(innerTimer);
      };
    }

    const maxPlaceVisits = Math.max(...allPlaces.map((p) => p.visits), 1);
    const citiesWithBoundary = new Set<string>();
    const polygonVisibility = 1; // Always fully visible

    // ---- 1) Boundary polygons: visited cities get colored fill ----
    cities.forEach((city) => {
      const geojson = cityBoundaries.get(city.cityName);
      if (!geojson) return;
      citiesWithBoundary.add(city.cityName);

      const intensity = Math.min(city.totalVisits / maxCityVisits, 1);
      const fillOpacity = 0.18 + intensity * 0.12; // softer fill only

      // Use fill-only styling for a softer "visited area" effect — no visible stroke.
      const layer = L.geoJSON(geojson, {
        style: {
          fillColor: LIFE_MAP_COLOR,
          fillOpacity,
          stroke: false,
        },
      }).addTo(map);

      // On hover, only slightly increase the fill opacity. Do not introduce borders.
      layer.on('mouseover', () => {
        layer.setStyle({
          fillColor: LIFE_MAP_COLOR,
          fillOpacity: Math.min(fillOpacity + 0.06, 0.34),
          stroke: false,
        });
      });
      layer.on('mouseout', () => {
        layer.setStyle({
          fillColor: LIFE_MAP_COLOR,
          fillOpacity,
          stroke: false,
        });
      });

      // Click to enter city — match by name + coordinates to avoid ambiguous names
      layer.on('click', () => {
        const cityIndex = cities.findIndex(c => c.cityName === city.cityName && c.centerLat === city.centerLat && c.centerLng === city.centerLng);
        if (cityIndex >= 0) {
          setSelectedCityIdx(cityIndex);
          setViewMode('city');
        }
      });

      boundaryLayersRef.current.push(layer);
    });

    // ---- 2) Heatmap as subtle supplement ----
    const heatPoints: [number, number, number][] = [];
    allPlaces.forEach((place) => {
      const normalized = Math.min(place.visits / maxPlaceVisits, 1);
      const intensity = 0.24 + normalized * 0.72;
      const repeat = Math.min(7, Math.max(2, Math.round(place.visits)));
      for (let i = 0; i < repeat; i++) {
        const jitter = 0.003;
        const lat = place.lat + (Math.random() - 0.5) * jitter;
        const lng = place.lng + (Math.random() - 0.5) * jitter;
        heatPoints.push([lat, lng, intensity]);
      }
    });

    if (HEATMAP_ENABLED && heatPoints.length > 0) {
      heatLayerRef.current = (L as any).heatLayer(heatPoints, {
        radius: worldZoom <= 4 ? 18 : 24,
        blur: worldZoom <= 4 ? 20 : 25,
        maxZoom: 15,
        max: 1.0,
        minOpacity: 0.02,
        gradient: {
          0.0: 'rgba(232,130,90,0)',
          0.3: 'rgba(232,130,90,0.10)',
          0.6: 'rgba(232,130,90,0.20)',
          1.0: 'rgba(222,117,72,0.35)',
        },
      }).addTo(map);
    }

    // ---- 3) Clustered pins to avoid overlap when zoomed out ----
    const worldGroups = clusterCitiesForZoom(cities, worldZoom);

    worldGroups.forEach((group) => {
      const intensity = Math.min(group.totalVisits / maxCityVisits, 1);
      const isCluster = group.members.length > 1;

      const marker = L.circleMarker([group.centerLat, group.centerLng], {
        radius: isCluster ? 6 + intensity * 3 : 3.5 + intensity * 3,
        color: 'white',
        weight: 1.4,
        fillColor: LIFE_MAP_COLOR,
        fillOpacity: isCluster ? 0.92 : 0.86,
      }).addTo(map);

      const visitLabel = lang === 'zh' ? '次访问' : (group.totalVisits === 1 ? 'visit' : 'visits');
      const placeLabel = lang === 'zh' ? '个地点' : (group.totalPlaces === 1 ? 'place' : 'places');
      const cityLabel = lang === 'zh' ? '个城市' : (group.members.length === 1 ? 'city' : 'cities');
      const title = isCluster
        ? `${group.members.length} ${cityLabel}`
        : (group.members[0]?.cityName || 'Area');

      marker.bindTooltip(
        `<div style="text-align:center;font-family:inherit;">
          <div style="font-weight:600;font-size:13px;">${title}</div>
          <div style="color:#888;font-size:11px;margin-top:2px;">${group.totalVisits} ${visitLabel} · ${group.totalPlaces} ${placeLabel}</div>
        </div>`,
        { direction: 'top', offset: [0, -8], className: 'life-map-tooltip' }
      );

      marker.on('click', () => {
        if (isCluster) {
          const clusterBounds = L.latLngBounds(
            group.members.map((city) => [city.centerLat, city.centerLng] as [number, number])
          );
          map.fitBounds(clusterBounds, { padding: [42, 42], maxZoom: 10 });
          return;
        }

        const cityIndex = cities.findIndex(
          (city) => city.cityName === group.members[0].cityName
            && city.centerLat === group.members[0].centerLat
            && city.centerLng === group.members[0].centerLng
        );

        if (cityIndex >= 0) {
          setSelectedCityIdx(cityIndex);
          setViewMode('city');
        }
      });

      markersRef.current.push(marker);
    });

    return () => {
      cancelled = true;
      if (rafHandle !== null) cancelAnimationFrame(rafHandle);
      if (innerTimer !== null) clearTimeout(innerTimer);
    };
  }, [cities, viewMode, maxCityVisits, lang, allPlaces, cityBoundaries, worldZoom]);

  // Render city view: individual place markers with glow
  useEffect(() => {
    if (MAP_SAFE_MODE || mapPreviewFailed) return;
    if (!mapRef.current || viewMode !== 'city') return;

    let cancelled = false;

    try { markersRef.current.forEach(m => m.remove()); } catch {}
    markersRef.current = [];
    cityMarkerMapRef.current.clear();
    try {
      if (heatLayerRef.current) {
        mapRef.current.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    } catch {}
    try { boundaryLayersRef.current.forEach(l => l.remove()); } catch {}
    boundaryLayersRef.current = [];

    // Invalidate size and fit bounds to places (detail map behavior)
    const map = mapRef.current;

    // If there are no places, fall back to centering on the city center
    if (filteredPlaces.length === 0) {
      if (currentCity) {
        // ensure map knows its size then center
        const centerTimer = setTimeout(() => {
          if (cancelled) return;
          try {
            map.invalidateSize();
            map.setView([currentCity.centerLat, currentCity.centerLng], 13, { animate: false });
          } catch {}
        }, 120);
        return () => { cancelled = true; clearTimeout(centerTimer); };
      }
      return;
    }

    const maxPlaceVisits = Math.max(...filteredPlaces.map(p => p.visits), 1);
    const displayPlaces = spreadNearbyPlaces(filteredPlaces);

    // Heatmap glow for city view
    const heatPoints: [number, number, number][] = [];
    filteredPlaces.forEach((p) => {
      const normalized = Math.min(p.visits / maxPlaceVisits, 1);
      const intensity = 0.4 + normalized * 0.6;
      const repeat = Math.min(6, Math.max(1, Math.round(p.visits)));
      for (let i = 0; i < repeat; i++) {
        heatPoints.push([p.lat, p.lng, intensity]);
      }
    });

    if (HEATMAP_ENABLED) {
      heatLayerRef.current = (L as any).heatLayer(heatPoints, {
        radius: 20,
        blur: 22,
        maxZoom: 17,
        max: 1.0,
        minOpacity: 0.03,
        gradient: {
          0.0: 'rgba(232,130,90,0)',
          0.3: 'rgba(232,130,90,0.12)',
          0.6: 'rgba(232,130,90,0.22)',
          1.0: 'rgba(222,117,72,0.35)',
        },
      }).addTo(mapRef.current);
    }

    // Dot markers on top
    displayPlaces.forEach(({ place, renderLat, renderLng }) => {
      const color = categoryColors[place.category] || categoryColors.other;
      const isSelected = selectedPlace === place.name;
      const coverPhoto = getPlaceCoverPhoto(place);
      const size = coverPhoto ? (isSelected ? 52 : 42) : (isSelected ? 16 : 12);
      const icon = L.divIcon({
        className: coverPhoto ? 'map-photo-icon' : 'map-dot-icon',
        html: coverPhoto ? photoMarkerHtml(coverPhoto, color, isSelected, place.name) : dotMarkerHtml(color, isSelected),
        iconSize: coverPhoto ? [size, size + 10] : [size, size],
        iconAnchor: coverPhoto ? [size / 2, size + 2] : [size / 2, size / 2],
      });

      const marker = L.marker([renderLat, renderLng], { icon })
        .addTo(mapRef.current!)
        .bindPopup(`<div style="text-align:center;font-family:inherit;padding:4px 2px;">
          <p style="font-weight:600;font-size:13px;margin:0 0 2px;">${place.name}</p>
          <p style="color:#888;font-size:11px;margin:0;">${place.visits} ${place.visits === 1 ? t('map.visit') : t('map.visits')}</p>
        </div>`, { closeButton: false, className: 'map-popup-minimal' });

      marker.on('click', () => {
        setSelectedPlace(place.name);
        openPlaceDetail(place);
      });
      markersRef.current.push(marker);
      cityMarkerMapRef.current.set(place.name, { marker, category: place.category, lat: place.lat, lng: place.lng, renderLat, renderLng });
    });

      // After markers are added and the container is visible, invalidateSize then fit to places.
      // Use a short delay so the browser has painted the container (helps Leaflet measure correctly).
      const performFit = () => {
        if (cancelled) return;
        try {
          map.invalidateSize();
          if (displayPlaces.length === 1) {
            const p = displayPlaces[0];
            map.setView([p.renderLat, p.renderLng], 15, { animate: false });
          } else {
            const bounds = L.latLngBounds(displayPlaces.map(p => [p.renderLat, p.renderLng] as L.LatLngExpression));
            if (bounds.isValid()) {
              map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15, animate: false });
            }
          }
        } catch {
          // swallow if map was removed or view changed
        }
      };

      const primary = setTimeout(performFit, 120);
      const fallback = setTimeout(performFit, 600);

      return () => {
        cancelled = true;
        clearTimeout(primary);
        clearTimeout(fallback);
      };
  }, [filteredPlaces, viewMode, currentCity, mapPreviewFailed, lang]);

  // Lightweight effect: update only marker styling / pan when selectedPlace changes.
  useEffect(() => {
    if (MAP_SAFE_MODE || mapPreviewFailed) return;
    if (!mapRef.current || viewMode !== 'city') return;

    const map = mapRef.current;
    try {
      cityMarkerMapRef.current.forEach((entry, name) => {
        const isSelected = selectedPlace === name;
        const color = categoryColors[entry.category] || categoryColors.other;
        const place = filteredPlaces.find((item) => item.name === name);
        const coverPhoto = place ? getPlaceCoverPhoto(place) : null;
        const size = coverPhoto ? (isSelected ? 52 : 42) : (isSelected ? 16 : 12);
        const icon = L.divIcon({
          className: coverPhoto ? 'map-photo-icon' : 'map-dot-icon',
          html: coverPhoto ? photoMarkerHtml(coverPhoto, color, isSelected, name) : dotMarkerHtml(color, isSelected),
          iconSize: coverPhoto ? [size, size + 10] : [size, size],
          iconAnchor: coverPhoto ? [size / 2, size + 2] : [size / 2, size / 2],
        });
        entry.marker.setIcon(icon);
      });

      if (selectedPlace) {
        const entry = cityMarkerMapRef.current.get(selectedPlace);
        if (entry) {
          map.setView([entry.renderLat, entry.renderLng], 16, { animate: true });
        }
      }
    } catch (err) {
      // ignore
    }
  }, [selectedPlace, filteredPlaces, mapPreviewFailed]);

  const detailContainerRef = useRef<HTMLDivElement>(null);

  // Detail map: create/destroy via useEffect keyed on showPlaceDetail
  useEffect(() => {
    if (!DETAIL_MAP_ENABLED) return;
    setDetailMapFailed(false);

    if (detailMapRef.current) {
      try {
        detailMapRef.current.remove();
      } catch (err) {
        // ignore stale leaflet teardown issues
      }
      detailMapRef.current = null;
    }

    if (!showPlaceDetail || !detailContainerRef.current) return;

    const el = detailContainerRef.current as HTMLDivElement & { _leaflet_id?: number };

    // Clean old leaflet state
    if (el._leaflet_id) {
      el._leaflet_id = undefined;
    }
    el.innerHTML = '';

    let resizeObserver: ResizeObserver | null = null;
    let cancelled = false;

    const timer = setTimeout(() => {
      if (!detailContainerRef.current || cancelled) return;

      try {
        const map = L.map(detailContainerRef.current, {
          center: [showPlaceDetail.lat, showPlaceDetail.lng],
          zoom: 16,
          zoomControl: false,
          attributionControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          touchZoom: false,
          fadeAnimation: false,
        });

        detailMapRef.current = map;

        const detailTileLayer = L.tileLayer(
          'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
          {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19,
            className: 'map-tiles-light',
          }
        );
        detailTileLayer.addTo(map);
        L.control.attribution({ position: 'bottomright', prefix: false }).addTo(map);

        const color = categoryColors[showPlaceDetail.category] || categoryColors.other;
        const coverPhoto = getPlaceCoverPhoto(showPlaceDetail);
        const icon = L.divIcon({
          className: coverPhoto ? 'map-photo-icon' : 'map-dot-icon',
          html: coverPhoto ? photoMarkerHtml(coverPhoto, color, true, showPlaceDetail.name) : dotMarkerHtml(color, true),
          iconSize: coverPhoto ? [52, 62] : [16, 16],
          iconAnchor: coverPhoto ? [26, 54] : [8, 8],
        });

        L.marker([showPlaceDetail.lat, showPlaceDetail.lng], { icon }).addTo(map);

        const fixDetailMap = () => {
          if (!detailMapRef.current) return;
          detailMapRef.current.invalidateSize();
          detailMapRef.current.setView([showPlaceDetail.lat, showPlaceDetail.lng], 16, { animate: false });
        };

        const fixTimers = [0, 80, 200, 500].map((ms) =>
          setTimeout(() => {
            if (!cancelled) fixDetailMap();
          }, ms)
        );

        detailTileLayer.on('load', fixDetailMap);

        resizeObserver = new ResizeObserver(() => {
          requestAnimationFrame(() => {
            fixDetailMap();
          });
        });
        resizeObserver.observe(detailContainerRef.current);

        (map as any).__fixTimers = fixTimers;
        (map as any).__detailTileLayer = detailTileLayer;
      } catch (err) {
        console.error('Failed to initialize place detail map', err);
        setDetailMapFailed(true);
      }
    }, 120);

    return () => {
      cancelled = true;
      clearTimeout(timer);

      if (resizeObserver) {
        resizeObserver.disconnect();
      }

      if (detailMapRef.current) {
        const map = detailMapRef.current as any;
        if (map.__fixTimers) {
          map.__fixTimers.forEach((t: ReturnType<typeof setTimeout>) => clearTimeout(t));
        }
        try {
          detailMapRef.current.remove();
        } catch (err) {
          // ignore stale leaflet teardown issues
        }
        detailMapRef.current = null;
      }
    };
  }, [showPlaceDetail]);

  const totalPlaces = allPlaces.length;
  const totalVisits = allPlaces.reduce((s, p) => s + p.visits, 0);

  return (
    <div className="flex-1 flex flex-col pb-6">
      {/* Header */}
      <div className="px-5 py-4 flex items-center gap-2">
        {viewMode === 'city' ? (
          <>
            <button onClick={() => { setViewMode('world'); }} className="p-1 hover:bg-secondary rounded-xl transition-colors">
              <ChevronLeft size={20} />
            </button>
            <h1 className="text-lg font-semibold">{currentCity?.cityName || t('map.places')}</h1>
            <span className="text-muted-foreground/60 text-xs ml-auto tabular-nums">
              {cityPlaces.length} {t('map.places')}
            </span>
          </>
        ) : (
          <>
            <Globe size={16} className="text-primary" />
            <h1 className="text-lg font-semibold">{lang === 'zh' ? '生活足迹' : 'Life Map'}</h1>
            <span className="text-muted-foreground/60 text-xs ml-auto tabular-nums">
              {cities.length} {lang === 'zh' ? '个城市' : (cities.length === 1 ? 'city' : 'cities')} · {totalPlaces} {t('map.places')}
            </span>
          </>
        )}
      </div>

      {/* Category pills - city view only */}
      {viewMode === 'city' && (
        <div className="px-5 pb-3 flex gap-2 overflow-x-auto no-scrollbar">
          {categoryKeys.map(({ id, labelKey, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveCategory(id)}
              className={cn(
                'flex items-center gap-1.5 whitespace-nowrap text-xs py-2 px-3.5 rounded-full transition-all font-medium',
                activeCategory === id
                  ? 'bg-foreground text-background shadow-sm'
                  : 'bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground'
              )}
            >
              <Icon size={13} />
              {t(labelKey)}
            </button>
          ))}
        </div>
      )}

      {/* Map - hide when detail is open to prevent marker bleed */}
      <div className="mx-4 sm:mx-5" style={{ display: showPlaceDetail ? 'none' : undefined }}>
        {MAP_SAFE_MODE || mapPreviewFailed ? (
          <div
            className={cn(
              "rounded-2xl shadow-sm border border-border/40 bg-card/40 flex items-center justify-center text-center px-6",
              viewMode === 'world' ? 'h-[220px] lg:h-[260px]' : 'h-[180px] lg:h-[220px]'
            )}
          >
            <div>
              <p className="text-sm font-medium text-foreground/85">
                {mapPreviewFailed
                  ? (lang === 'zh' ? '地图预览加载失败' : 'Map preview failed to load')
                  : (lang === 'zh' ? '地图预览暂时关闭' : 'Map preview is temporarily off')}
              </p>
              <p className="mt-2 text-[12px] leading-6 text-muted-foreground/65">
                {mapPreviewFailed
                  ? (lang === 'zh'
                    ? '地点列表和详情仍可用'
                    : 'The place list and detail view still work.')
                  : (lang === 'zh'
                    ? '地点列表和详情仍可用'
                    : 'The place list and detail view still work.')}
              </p>
            </div>
          </div>
        ) : (
          <div
            ref={mapContainerRef}
            className={cn(
              "rounded-2xl overflow-hidden shadow-sm",
              viewMode === 'world' ? 'h-[320px] lg:h-[400px]' : 'h-[280px] lg:h-96'
            )}
            style={{ border: '1px solid hsl(var(--border) / 0.4)' }}
          />
        )}
      </div>

      {/* World view: city cards */}
      {viewMode === 'world' && (
        <div className="px-5 mt-4 flex-1 overflow-y-auto">
          <h2 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2.5">
            {lang === 'zh' ? '到访城市' : 'Visited Cities'}
          </h2>
          {cities.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-secondary/60 flex items-center justify-center mb-3">
                <Globe size={22} className="text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground/60 text-sm">{t('map.noPlaces')}</p>
              <p className="text-xs text-muted-foreground/40 mt-1">{t('map.noPlacesHint')}</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cities.map((city, i) => {
                const intensity = Math.min(city.totalVisits / maxCityVisits, 1);
                return (
                  <div
                    key={i}
                    onClick={() => { setSelectedCityIdx(i); setViewMode('city'); }}
                    className="p-4 rounded-2xl bg-card shadow-sm border border-border/30 hover:shadow-md hover:border-border/50 cursor-pointer transition-all life-map-card-enter"
                    style={{ animationDelay: `${i * 60}ms` }}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${LIFE_MAP_COLOR}${Math.round((0.1 + intensity * 0.2) * 255).toString(16).padStart(2, '0')}` }}
                      >
                        <MapPin size={18} style={{ color: LIFE_MAP_COLOR }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm">{city.cityName || `Area ${i + 1}`}</p>
                        <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                          {city.places.length} {lang === 'zh' ? '个地点' : (city.places.length === 1 ? 'place' : 'places')} · {city.totalVisits} {lang === 'zh' ? '次访问' : (city.totalVisits === 1 ? 'visit' : 'visits')}
                        </p>
                      </div>
                      {/* Intensity bar */}
                      <div className="w-12 h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${Math.max(intensity * 100, 10)}%`,
                            backgroundColor: LIFE_MAP_COLOR,
                            opacity: 0.5 + intensity * 0.5,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Stats summary */}
          {cities.length > 0 && (
            <div className="mt-6 grid grid-cols-3 gap-3">
              {[
                { label: lang === 'zh' ? '城市' : 'Cities', value: cities.length },
                { label: lang === 'zh' ? '地点' : 'Places', value: totalPlaces },
                { label: lang === 'zh' ? '访问' : 'Visits', value: totalVisits },
              ].map(stat => (
                <div key={stat.label} className="text-center py-3 rounded-2xl bg-card shadow-sm border border-border/30">
                  <p className="text-lg font-bold" style={{ color: LIFE_MAP_COLOR }}>{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground/50 font-medium uppercase tracking-wider">{stat.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* City view: places list */}
      {viewMode === 'city' && (
        <div className="px-5 mt-4 flex-1 overflow-y-auto">
          <h2 className="text-[11px] font-medium text-muted-foreground/60 uppercase tracking-wider mb-2.5">
            {activeCategory === 'all'
              ? t('map.allPlaces')
              : t(categoryKeys.find(k => k.id === activeCategory)?.labelKey ?? 'map.allPlaces')
            } ({filteredPlaces.length})
          </h2>

          {filteredPlaces.length === 0 ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-secondary/60 flex items-center justify-center mb-3">
                <MapPin size={22} className="text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground/60 text-sm">{t('map.noPlaces')}</p>
            </div>
          ) : (
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:gap-3 lg:space-y-0">
              {filteredPlaces.map((place, i) => {
                const Icon = getCategoryIcon(place.category);
                const color = categoryColors[place.category] || categoryColors.other;
                const isActive = selectedPlace === place.name;
                const coverPhoto = getPlaceCoverPhoto(place);
                return (
                  <div
                    key={place.name}
                    onClick={() => {
                      setSelectedPlace(place.name);
                      // Always zoom main map to place
                      if (mapRef.current) {
                        mapRef.current.setView([place.lat, place.lng], 16, { animate: true });
                      }
                      // Always open detail view
                      openPlaceDetail(place);
                    }}
                    className={cn(
                      "p-3.5 rounded-2xl bg-card flex items-center gap-3 transition-all cursor-pointer",
                      isActive
                        ? "shadow-md ring-1 ring-primary/20"
                        : "shadow-sm hover:shadow-md border border-border/30 hover:border-border/50"
                    )}
                    style={{ animationDelay: `${i * 40}ms` }}
                  >
                    {coverPhoto ? (
                      <div className="w-11 h-11 rounded-2xl overflow-hidden shadow-sm flex-shrink-0 border border-[rgba(214,190,172,0.34)] bg-[rgba(232,130,90,0.06)]">
                        <img src={coverPhoto} alt="" className="w-full h-full object-cover" loading="lazy" />
                      </div>
                    ) : (
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: `${color}12` }}
                      >
                        <Icon size={16} style={{ color }} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[13px] truncate leading-tight">{place.name}</p>
                      <p className="text-[11px] text-muted-foreground/60 mt-0.5">
                        {place.visits} {place.visits === 1 ? t('map.visit') : t('map.visits')}
                        {place.photos.length > 0 && ` · ${place.photos.length} ${place.photos.length === 1 ? t('map.photo') : t('map.photos')}`}
                      </p>
                    </div>
                    <span className="text-lg font-semibold tabular-nums" style={{ color }}>{place.visits}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Place detail overlay */}
      {showPlaceDetail && (
        <MapDetailErrorBoundary onClose={() => { setShowPlaceDetail(null); setSelectedPlace(null); }} lang={lang}>
          {(() => {
            const sortedVisits = [...showPlaceDetail.visitDetails].sort((a, b) => {
              const aTime = new Date(a.date).getTime();
              const bTime = new Date(b.date).getTime();
              return (Number.isNaN(bTime) ? 0 : bTime) - (Number.isNaN(aTime) ? 0 : aTime);
            });
            const allPhotos = Array.from(new Set([
              ...showPlaceDetail.photos,
              ...sortedVisits.flatMap((visit) => visit.photos),
            ]));

            return (
              <>
                <div className="fixed inset-0 z-50 bg-background flex flex-col overflow-hidden">
                  <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 flex-shrink-0 bg-background/95 backdrop-blur-sm">
                    <button onClick={() => { setShowPlaceDetail(null); setSelectedPlace(null); }} className="p-1.5 hover:bg-secondary rounded-xl transition-colors">
                      <ChevronLeft size={20} />
                    </button>
                    <div className="flex-1 min-w-0">
                      <h2 className="font-semibold text-sm truncate">{showPlaceDetail.name}</h2>
                      <p className="text-[11px] text-muted-foreground/60">
                        {showPlaceDetail.visits} {showPlaceDetail.visits === 1 ? t('map.visit') : t('map.visits')} · {allPhotos.length} {allPhotos.length === 1 ? t('map.photo') : t('map.photos')}
                      </p>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto">
                    <div className="px-4 pt-4 pb-3">
                      {!DETAIL_MAP_ENABLED ? (
                        <div
                          className="h-[220px] rounded-[28px] overflow-hidden shadow-sm border border-border/40 bg-secondary/20 flex items-center justify-center px-4"
                        >
                          {getPlaceCoverPhoto(showPlaceDetail) ? (
                            <div className="flex w-full items-center gap-4">
                              <div className="h-24 w-24 overflow-hidden rounded-2xl border border-white/80 shadow-sm">
                                <img
                                  src={getPlaceCoverPhoto(showPlaceDetail)!}
                                  alt=""
                                  className="h-full w-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-foreground">{showPlaceDetail.name}</p>
                                <p className="mt-1 text-[12px] leading-5 text-muted-foreground/70">
                                  {showPlaceDetail.visits} {showPlaceDetail.visits === 1 ? t('map.visit') : t('map.visits')}
                                  {' · '}
                                  {showPlaceDetail.photos.length} {showPlaceDetail.photos.length === 1 ? t('map.photo') : t('map.photos')}
                                </p>
                                <p className="mt-2 text-[12px] leading-5 text-muted-foreground/65">
                                  {lang === 'zh' ? '地图预览暂时关闭' : 'Map preview unavailable'}
                                </p>
                              </div>
                            </div>
                          ) : (
                            <div className="text-center">
                              <p className="text-sm font-medium text-foreground/85">{showPlaceDetail.name}</p>
                              <p className="mt-2 text-[12px] leading-5 text-muted-foreground/65">
                                {lang === 'zh' ? '地图预览暂时关闭' : 'Map preview unavailable'}
                              </p>
                            </div>
                          )}
                        </div>
                      ) : detailMapFailed ? (
                        <div
                          className="h-[220px] rounded-[28px] overflow-hidden shadow-sm border border-border/40 bg-secondary/20 flex items-center justify-center text-center px-6"
                        >
                          <div>
                            <p className="text-sm font-medium text-foreground/85">{showPlaceDetail.name}</p>
                            <p className="mt-1 text-[12px] text-muted-foreground/65">
                              {lang === 'zh' ? '地图预览暂时不可用' : 'Map preview unavailable'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div
                          className="h-[220px] rounded-[28px] overflow-hidden shadow-sm"
                          style={{ border: '1px solid hsl(var(--border) / 0.3)' }}
                          ref={detailContainerRef}
                        />
                      )}
                    </div>

                    <div className="px-4 py-4 pb-8">
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                        <div className="rounded-[22px] border border-border/40 bg-card/70 px-4 py-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/55">
                            {lang === 'zh' ? '地点' : 'Place'}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">{showPlaceDetail.name}</p>
                        </div>
                        <div className="rounded-[22px] border border-border/40 bg-card/70 px-4 py-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/55">
                            {lang === 'zh' ? '记录' : 'Visits'}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {showPlaceDetail.visits} {showPlaceDetail.visits === 1 ? t('map.visit') : t('map.visits')}
                          </p>
                        </div>
                        <div className="rounded-[22px] border border-border/40 bg-card/70 px-4 py-4">
                          <p className="text-[11px] uppercase tracking-[0.16em] text-muted-foreground/55">
                            {lang === 'zh' ? '最近一次' : 'Last visit'}
                          </p>
                          <p className="mt-2 text-lg font-semibold text-foreground">
                            {showPlaceDetail.lastVisit ? formatVisitDateLabel(showPlaceDetail.lastVisit, formatDate) : '—'}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(360px,0.9fr)]">
                        <div className="rounded-[26px] border border-border/40 bg-card/70 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{lang === 'zh' ? '照片' : 'Photos'}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground/60">
                                {allPhotos.length} {allPhotos.length === 1 ? t('map.photo') : t('map.photos')}
                              </p>
                            </div>
                          </div>
                          {allPhotos.length > 0 ? (
                            <div className="grid grid-cols-2 gap-3">
                              <div className="col-span-2 overflow-hidden rounded-[22px] border border-border/35 bg-secondary/20">
                                <img src={allPhotos[0]} alt="" className="aspect-[4/3] h-full w-full object-cover" loading="lazy" />
                              </div>
                              {allPhotos.slice(1).map((photo, index) => (
                                <div key={`${photo}-${index}`} className="aspect-square overflow-hidden rounded-[18px] border border-border/35 bg-secondary/20">
                                  <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="rounded-[20px] border border-dashed border-border/40 px-4 py-10 text-center text-[12px] text-muted-foreground/60">
                              {lang === 'zh' ? '还没有照片' : 'No photos'}
                            </div>
                          )}
                        </div>

                        <div className="rounded-[26px] border border-border/40 bg-card/70 p-4">
                          <div className="mb-3 flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-foreground">{lang === 'zh' ? '到访记录' : 'Visits'}</p>
                              <p className="mt-0.5 text-[11px] text-muted-foreground/60">{sortedVisits.length}</p>
                            </div>
                          </div>
                          {sortedVisits.length === 0 ? (
                            <p className="rounded-[20px] border border-dashed border-border/40 px-4 py-10 text-center text-[12px] leading-6 text-muted-foreground/65">
                              {lang === 'zh' ? '还没有到访记录' : 'No visits yet'}
                            </p>
                          ) : (
                            <div className="space-y-3">
                              {sortedVisits.map((visit, index) => {
                                const canOpen = !!onOpenDate && !!visit.date;
                                return (
                                <div
                                  key={`${visit.momentId || visit.date || 'visit'}-${index}`}
                                  className={cn(
                                    "rounded-[18px] border border-border/30 bg-background/70 px-3.5 py-3.5",
                                    canOpen && "cursor-pointer transition-colors hover:border-primary/40 hover:bg-primary/[0.04]"
                                  )}
                                  onClick={canOpen ? () => onOpenDate!(visit.date) : undefined}
                                  role={canOpen ? 'button' : undefined}
                                  title={canOpen ? (lang === 'zh' ? '查看这一天' : 'Open this day') : undefined}
                                >
                                  <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <p className="text-[12px] font-medium text-foreground/90">
                                        {visit.date ? formatVisitDateLabel(visit.date, formatDate) : (lang === 'zh' ? '未标注日期' : 'Undated')}
                                      </p>
                                      <p className="mt-1 text-[11px] text-muted-foreground/55">
                                        {visit.photos.length} {visit.photos.length === 1 ? t('map.photo') : t('map.photos')}
                                      </p>
                                    </div>
                                    {canOpen && (
                                      <ChevronLeft size={14} className="flex-shrink-0 rotate-180 text-muted-foreground/35" />
                                    )}
                                  </div>
                                  {visit.text && (
                                    <p className="mt-2 text-[12px] leading-6 text-muted-foreground/75 whitespace-pre-wrap">
                                      {visit.text}
                                    </p>
                                  )}
                                  {visit.photos.length > 0 && (
                                    <div className="mt-3 grid grid-cols-3 gap-2">
                                      {visit.photos.map((photo, photoIndex) => (
                                        <div key={`${photo}-${photoIndex}`} className="aspect-square overflow-hidden rounded-[14px] border border-border/30 bg-secondary/20">
                                          <img src={photo} alt="" className="h-full w-full object-cover" loading="lazy" />
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            );
          })()}
        </MapDetailErrorBoundary>
      )}
    </div>
  );
}
