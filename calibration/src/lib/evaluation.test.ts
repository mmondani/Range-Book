import { describe, expect, it } from 'vitest';
import type { Calibration } from '@/lib/calibration';
import { DEFAULT_TUNING, detectImpactsInPhoto } from '@/lib/impact-detection';
import { syntheticTarget } from '@/test/synthetic-target';
import type { LabeledImpact } from './dataset';
import { buildReport, evaluatePhoto, matchImpacts, reportPath, summarize } from './evaluation';

// Foto de 240 px con 1 mm por px y el centro en el medio.
const calibration: Calibration = {
  kind: 'ring',
  width: 240,
  height: 240,
  center: { x: 120, y: 120 },
  edge: { x: 220, y: 120 },
  diameterMm: 200,
};

const impact = (x: number, y: number, ...tags: LabeledImpact['tags']): LabeledImpact => ({
  x,
  y,
  tags,
});

describe('matchImpacts', () => {
  it('cada impacto marcado se queda con a lo sumo una detección, la más cercana', () => {
    const truth = [
      { x: 0, y: 0 },
      { x: 3, y: 0 },
      { x: 100, y: 100 },
    ];
    const detected = [
      { x: 2, y: 0 },
      { x: 50, y: 50 },
    ];
    // La detección en x = 2 está más cerca del segundo (1) que del primero (2).
    expect(matchImpacts(truth, detected, 4.5)).toEqual([{ truth: 1, detected: 0, distance: 1 }]);
    expect(matchImpacts(truth, detected, 0.5)).toEqual([]);
  });
});

describe('evaluatePhoto', () => {
  it('impactos encontrados, detecciones correctas, errores, etiquetas y centro', () => {
    const evaluation = evaluatePhoto(
      {
        file: '001.jpg',
        conditions: ['shadow'],
        calibration,
        impacts: [
          impact(100, 100),
          impact(150, 100, 'touching'),
          impact(30, 30, 'touching', 'old'),
        ],
      },
      'rings',
      {
        impacts: [
          { x: 101, y: 100 },
          { x: 150, y: 102 },
          { x: 200, y: 200 },
        ],
        // 3 mm a la derecha y 4 mm arriba del centro marcado.
        center: { x: 123, y: 116 },
        holeMm: 9,
      },
    );
    expect(evaluation).toMatchObject({ truth: 3, detected: 3, matched: 2 });
    expect(evaluation.errorsMm[0]).toBeCloseTo(1, 10);
    expect(evaluation.errorsMm[1]).toBeCloseTo(2, 10);
    expect(evaluation.byTag).toEqual({
      touching: { truth: 2, found: 1 },
      outside: { truth: 0, found: 0 },
      old: { truth: 1, found: 0 },
      untagged: { truth: 1, found: 1 },
    });
    expect(evaluation.centerErrorMm).toBeCloseTo(5, 10);
  });

  it('el centro solo se evalúa en blancos con anillos', () => {
    const photo = { file: 'a.jpg', conditions: [], calibration, impacts: [] };
    const detection = { impacts: [], center: null, holeMm: 9 };
    expect(evaluatePhoto(photo, 'rings', detection).centerErrorMm).toBeNull();
    expect(evaluatePhoto(photo, 'none', detection)).not.toHaveProperty('centerErrorMm');
  });
});

describe('summarize y buildReport', () => {
  const photo = (file: string, conditions: Array<'shadow' | 'flash'>, detectedOffsets: number[]) =>
    evaluatePhoto(
      { file, conditions, calibration, impacts: [impact(100, 100), impact(140, 100)] },
      'rings',
      {
        impacts: detectedOffsets.map((dx, i) => ({ x: 100 + i * 40 + dx, y: 100 })),
        center: { x: 120, y: 120 },
        holeMm: 9,
      },
    );

  it('suma las fotos y calcula los porcentajes', () => {
    // A: encuentra los dos (errores 1 y 3). B: uno bien (2) y una detección lejos.
    const metrics = summarize([photo('a', ['shadow'], [1, 3]), photo('b', ['flash'], [2, 30])]);
    expect(metrics).toMatchObject({
      photos: 2,
      truth: 4,
      detected: 4,
      matched: 3,
      recall: 0.75,
      precision: 0.75,
      maxErrorMm: 3,
      centerPhotos: 2,
      centerMissing: 0,
      centerMeanErrorMm: 0,
    });
    expect(metrics.meanErrorMm).toBeCloseTo(2, 10);
  });

  it('sin impactos ni detecciones, los porcentajes quedan vacíos', () => {
    expect(summarize([])).toMatchObject({ recall: null, precision: null, meanErrorMm: null });
  });

  it('el reporte tiene el set, cada foto, las etiquetas y las condiciones que aparecen', () => {
    const report = buildReport(
      [photo('a', ['shadow'], [1, 3]), photo('b', ['shadow', 'flash'], [2, 30])],
      DEFAULT_TUNING,
      new Date('2026-10-28T15:04:05Z'),
      [{ file: 'c', error: 'No se pudo leer la foto' }],
    );
    expect(report.createdAt).toBe('2026-10-28T15:04:05.000Z');
    expect(report.tuning).toEqual(DEFAULT_TUNING);
    expect(report.set.matched).toBe(3);
    expect(report.photos.map((item) => [item.file, item.metrics.recall])).toEqual([
      ['a', 1],
      ['b', 0.5],
    ]);
    expect(report.byTag.untagged).toEqual({ truth: 4, found: 3, recall: 0.75 });
    expect(Object.keys(report.byCondition)).toEqual(['shadow', 'flash']);
    expect(report.byCondition.flash?.recall).toBe(0.5);
    expect(report.failed).toEqual([{ file: 'c', error: 'No se pudo leer la foto' }]);
  });

  it('el archivo del resultado lleva la fecha y la hora', () => {
    expect(reportPath(new Date(2026, 9, 28, 9, 5, 7))).toBe('resultados/2026-10-28-090507.json');
  });
});

describe('con la detección real sobre un blanco sintético', () => {
  // Tres agujeros en la foto; el cuarto marcado no está (lo tapó un parche): se pierde.
  const image = syntheticTarget()
    .hole({ x: 60, y: 60 }, 40)
    .hole({ x: 170, y: 80 }, 40)
    .hole({ x: 120, y: 180 }, 40)
    .image();
  const impacts = [impact(60, 60), impact(170, 80, 'touching'), impact(120, 180), impact(30, 200)];
  const evaluate = (tuning?: Partial<typeof DEFAULT_TUNING>) => {
    const detected = detectImpactsInPhoto(image, calibration, [], 9, { tuning });
    const evaluation = evaluatePhoto(
      { file: 'sintetico', conditions: [], calibration, impacts },
      'rings',
      { impacts: detected, center: { x: 120, y: 120 }, holeMm: 9 },
    );
    return summarize([evaluation]);
  };

  it('informa los valores esperados', () => {
    const metrics = evaluate();
    expect(metrics).toMatchObject({
      truth: 4,
      detected: 3,
      matched: 3,
      recall: 0.75,
      precision: 1,
    });
    // Los centros se ubican a menos de 1 mm.
    expect(metrics.maxErrorMm).toBeLessThan(1);
  });

  it('con otros parámetros, el resultado cambia', () => {
    expect(evaluate({ threshold: 250 })).toMatchObject({
      detected: 0,
      matched: 0,
      recall: 0,
      precision: null,
    });
  });
});
