import { Moment } from '@/types';

export interface EvidenceExport {
  app: 'Evidence of Life';
  schema: number;
  exportedAt: string;
  counts: {
    moments: number;
    days: number;
    photos: number;
    places: number;
  };
  moments: Moment[];
}

/**
 * Build a complete, portable snapshot of a person's evidence.
 *
 * This is the concrete backing for the product's "private by default —
 * your data stays yours" promise: everything a user has captured can be
 * handed back to them as a single self-describing JSON document, with no
 * server round-trip required. Pure and deterministic given `now`, so the
 * shape can be unit-tested.
 */
export function buildEvidenceExport(moments: Moment[], now: Date = new Date()): EvidenceExport {
  const safeMoments = Array.isArray(moments) ? moments : [];

  const days = new Set<string>();
  const places = new Set<string>();
  let photos = 0;

  for (const moment of safeMoments) {
    if (moment.date) days.add(moment.date);
    photos += Array.isArray(moment.photos) ? moment.photos.length : 0;
    if (moment.location?.name) {
      places.add(`${moment.location.name}|${moment.location.lat},${moment.location.lng}`);
    }
  }

  // Newest first, so the most recent life is at the top of the file.
  const ordered = [...safeMoments].sort((a, b) => {
    const at = a.createdAt || a.date || '';
    const bt = b.createdAt || b.date || '';
    return bt.localeCompare(at);
  });

  return {
    app: 'Evidence of Life',
    schema: 1,
    exportedAt: now.toISOString(),
    counts: {
      moments: safeMoments.length,
      days: days.size,
      photos,
      places: places.size,
    },
    moments: ordered,
  };
}

/** Serialize an export to a human-readable, re-importable JSON string. */
export function serializeEvidenceExport(data: EvidenceExport): string {
  return JSON.stringify(data, null, 2);
}

/** A stable, dated filename for the downloaded archive. */
export function evidenceExportFilename(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `evidence-of-life-${yyyy}-${mm}-${dd}.json`;
}
