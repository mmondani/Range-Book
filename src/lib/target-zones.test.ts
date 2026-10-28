import { describe, expect, it } from 'vitest';
import {
  generateZones,
  hasZoneErrors,
  sortZones,
  validateZones,
  zoneScore,
  type TargetZone,
} from './target-zones';

/** Anillos de 10 a 7 puntos, de 50 a 200 mm. */
const ZONES: TargetZone[] = [
  { score: 10, diameterMm: 50 },
  { score: 9, diameterMm: 100 },
  { score: 8, diameterMm: 150 },
  { score: 7, diameterMm: 200 },
];

describe('validateZones', () => {
  it('acepta diámetros únicos que crecen al bajar el puntaje, en cualquier orden de carga', () => {
    expect(hasZoneErrors(validateZones(ZONES, 200))).toBe(false);
    expect(hasZoneErrors(validateZones([...ZONES].reverse(), 200))).toBe(false);
  });

  it('rechaza diámetros repetidos', () => {
    const errors = validateZones(
      [
        { score: 10, diameterMm: 50 },
        { score: 9, diameterMm: 50 },
      ],
      200,
    );
    expect(errors).toEqual([{}, { diameter: 'Diámetro repetido' }]);
  });

  it('rechaza un diámetro que no crece al bajar el puntaje', () => {
    const errors = validateZones(
      [
        { score: 10, diameterMm: 100 },
        { score: 9, diameterMm: 80 },
        { score: 8, diameterMm: 150 },
      ],
      200,
    );
    expect(errors).toEqual([
      {},
      { diameter: 'Tiene que ser mayor que el de la zona 10 (100 mm)' },
      {},
    ]);
  });

  it('rechaza puntajes repetidos', () => {
    const errors = validateZones(
      [
        { score: 10, diameterMm: 50 },
        { score: 10, diameterMm: 100 },
      ],
      200,
    );
    expect(errors[1]).toEqual({ score: 'Puntaje repetido' });
  });

  it('ninguna zona puede ser mayor que la referencia (igual sí)', () => {
    expect(validateZones([{ score: 1, diameterMm: 200 }], 200)).toEqual([{}]);
    expect(validateZones([{ score: 1, diameterMm: 200.5 }], 200)).toEqual([
      { diameter: 'No puede superar el tamaño de referencia' },
    ]);
  });

  it('sin referencia válida no compara contra ella', () => {
    expect(validateZones([{ score: 1, diameterMm: 900 }])).toEqual([{}]);
  });

  it('rechaza puntajes vacíos, negativos o con decimales, y diámetros vacíos o en 0', () => {
    const errors = validateZones(
      [
        { score: undefined, diameterMm: 50 },
        { score: -1, diameterMm: 60 },
        { score: 9.5, diameterMm: 70 },
        { score: 8, diameterMm: 0 },
        { score: 7, diameterMm: undefined },
      ],
      200,
    );
    expect(errors.map((row) => row.score)).toEqual([
      'Ingresá un puntaje entero',
      'Ingresá un puntaje entero',
      'Ingresá un puntaje entero',
      undefined,
      undefined,
    ]);
    expect(errors[3]?.diameter).toBe('Ingresá un diámetro mayor que 0');
    expect(errors[4]?.diameter).toBe('Ingresá un diámetro mayor que 0');
  });

  it('el orden solo se revisa entre las filas válidas', () => {
    const errors = validateZones(
      [
        { score: 10, diameterMm: 50 },
        { score: 9, diameterMm: 300 },
        { score: 8, diameterMm: 150 },
      ],
      200,
    );
    // El 9 supera la referencia; el 8 se compara con el 10 y está bien.
    expect(errors).toEqual([{}, { diameter: 'No puede superar el tamaño de referencia' }, {}]);
  });
});

describe('generateZones', () => {
  it('genera N anillos uniformes: del puntaje N en el centro al 1 en el borde', () => {
    expect(generateZones(200, 4)).toEqual(
      ZONES.map((zone) => ({ ...zone, score: zone.score - 6 })),
    );
  });

  it('el anillo exterior mide la referencia y redondea a 0,1 mm', () => {
    const zones = generateZones(100, 3);
    expect(zones.map((zone) => zone.diameterMm)).toEqual([33.3, 66.7, 100]);
    expect(zones.map((zone) => zone.score)).toEqual([3, 2, 1]);
  });

  it('las zonas generadas son válidas', () => {
    expect(hasZoneErrors(validateZones(generateZones(500, 10), 500))).toBe(false);
  });
});

describe('zoneScore', () => {
  it('suma el puntaje de la zona más chica que contiene el centro del impacto', () => {
    expect(zoneScore(ZONES, { x: 0, y: 0 })).toBe(10);
    expect(zoneScore(ZONES, { x: 30, y: 40 })).toBe(9); // a 50 mm del centro
    expect(zoneScore(ZONES, { x: -60, y: 0 })).toBe(8);
  });

  it('el borde de la zona cuenta como adentro', () => {
    expect(zoneScore(ZONES, { x: 25, y: 0 })).toBe(10);
    expect(zoneScore(ZONES, { x: 0, y: -100 })).toBe(7);
  });

  it('fuera de todas las zonas vale 0', () => {
    expect(zoneScore(ZONES, { x: 100.1, y: 0 })).toBe(0);
    expect(zoneScore(ZONES, { x: 80, y: 80 })).toBe(0);
  });

  it('no depende del orden de las zonas', () => {
    expect(zoneScore([...ZONES].reverse(), { x: 10, y: 10 })).toBe(10);
  });

  it('sin zonas vale 0', () => {
    expect(zoneScore([], { x: 0, y: 0 })).toBe(0);
  });
});

describe('sortZones', () => {
  it('ordena de mayor a menor puntaje', () => {
    expect(sortZones([...ZONES].reverse()).map((zone) => zone.score)).toEqual([10, 9, 8, 7]);
  });
});
