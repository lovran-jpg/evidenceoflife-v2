import { describe, expect, it } from 'vitest';
import {
  buildEvidenceExport,
  serializeEvidenceExport,
  evidenceExportFilename,
} from '@/lib/exportEvidence';
import { Moment } from '@/types';

function moment(partial: Partial<Moment>): Moment {
  return {
    id: 'x',
    date: '2026-05-01',
    photos: [],
    createdAt: '2026-05-01T08:00:00.000Z',
    ...partial,
  };
}

describe('buildEvidenceExport', () => {
  it('summarizes counts across moments, days, photos and places', () => {
    const data = buildEvidenceExport(
      [
        moment({ id: 'a', date: '2026-05-01', photos: ['p1', 'p2'] }),
        moment({
          id: 'b',
          date: '2026-05-01',
          photos: ['p3'],
          location: { name: 'Joe Coffee', lat: 1, lng: 2 },
        }),
        moment({ id: 'c', date: '2026-05-02', photos: [] }),
      ],
      new Date('2026-05-03T00:00:00.000Z'),
    );

    expect(data.counts).toEqual({ moments: 3, days: 2, photos: 3, places: 1 });
    expect(data.app).toBe('Evidence of Life');
    expect(data.schema).toBe(1);
    expect(data.exportedAt).toBe('2026-05-03T00:00:00.000Z');
  });

  it('orders moments newest-first by createdAt', () => {
    const data = buildEvidenceExport([
      moment({ id: 'old', createdAt: '2026-05-01T08:00:00.000Z' }),
      moment({ id: 'new', createdAt: '2026-05-02T08:00:00.000Z' }),
    ]);
    expect(data.moments.map(m => m.id)).toEqual(['new', 'old']);
  });

  it('counts the same place once even across multiple visits', () => {
    const place = { name: 'Park', lat: 5, lng: 6 };
    const data = buildEvidenceExport([
      moment({ id: 'a', location: place }),
      moment({ id: 'b', location: place }),
    ]);
    expect(data.counts.places).toBe(1);
  });

  it('is resilient to malformed input', () => {
    const data = buildEvidenceExport(null as unknown as Moment[]);
    expect(data.counts.moments).toBe(0);
    expect(data.moments).toEqual([]);
  });

  it('serializes to valid, re-parseable JSON', () => {
    const data = buildEvidenceExport([moment({ id: 'a' })]);
    const parsed = JSON.parse(serializeEvidenceExport(data));
    expect(parsed.moments[0].id).toBe('a');
  });

  it('produces a dated filename', () => {
    expect(evidenceExportFilename(new Date('2026-05-03T12:00:00.000Z'))).toMatch(
      /^evidence-of-life-2026-05-\d{2}\.json$/,
    );
  });
});
