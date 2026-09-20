import { describe, expect, it } from 'vitest';
import { RestaurantServiceError } from '@/lib/restaurantDomain';
import { restaurantUiError, visitCountLabel } from '@/lib/restaurantUi';

describe('Restaurant V1 UI helpers', () => {
  it.each([
    [0, '0 posjeta'],
    [1, '1 posjet'],
    [2, '2 posjeta'],
    [5, '5 posjeta'],
  ])('formats %i visits in Croatian', (count, label) => {
    expect(visitCountLabel(count)).toBe(label);
  });

  it('does not expose an unknown technical error to the user', () => {
    expect(restaurantUiError(new Error('undefined is not a constructor'), 'Pokušaj ponovno.'))
      .toBe('Pokušaj ponovno.');
  });

  it('maps a missing owned record to a safe message', () => {
    const error = new RestaurantServiceError('not_found', 'Restaurant not found');
    expect(restaurantUiError(error, 'Pokušaj ponovno.')).toBe('Traženi zapis nije pronađen.');
  });
});
