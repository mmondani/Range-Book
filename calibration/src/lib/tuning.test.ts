import { describe, expect, it } from 'vitest';
import { DEFAULT_TUNING } from '@/lib/impact-detection';
import { parseTuning, tuningValues } from './tuning';

describe('tuningValues y parseTuning', () => {
  it('por defecto son los parámetros de la app', () => {
    expect(tuningValues().threshold).toBe('45');
    expect(tuningValues().windowRatio).toBe('1,5');
    expect(tuningValues().minFill).toBe('0,35');
    expect(parseTuning(tuningValues())).toEqual({ tuning: DEFAULT_TUNING });
  });

  it('acepta coma decimal y rechaza lo que no es un número mayor que 0', () => {
    const values = { ...tuningValues(), threshold: '60', minFill: '0,5', maxAreaRatio: 'x' };
    expect(parseTuning(values)).toEqual({ errors: ['maxAreaRatio'] });
    expect(parseTuning({ ...values, maxAreaRatio: '3' })).toEqual({
      tuning: { ...DEFAULT_TUNING, threshold: 60, minFill: 0.5, maxAreaRatio: 3 },
    });
    expect(parseTuning({ ...values, maxAreaRatio: '0' })).toEqual({ errors: ['maxAreaRatio'] });
  });
});
