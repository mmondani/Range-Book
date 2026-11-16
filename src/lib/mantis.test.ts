import { describe, expect, it } from 'vitest';
import { MANTIS_EXPORT } from '@/test/mantis-fixture';
import { parseMantisTrace, parseRoundMantis } from './mantis';
import { parseMantisFile } from './mantis-import';

const result = parseMantisFile(JSON.stringify(MANTIS_EXPORT));
if (!result.ok) throw new Error(result.error);
const [{ summary, trace }] = result.file.sessions as [
  (typeof result.file.sessions)[number],
  ...unknown[],
];

describe('lectura de Firestore', () => {
  it('lee el resumen y la trayectoria tal como se guardan', () => {
    // Firestore devuelve lo mismo que se escribió (sin `undefined`).
    const stored = JSON.parse(JSON.stringify({ summary, trace })) as {
      summary: Record<string, unknown>;
      trace: Record<string, unknown>;
    };
    expect(parseRoundMantis(stored.summary)).toEqual(summary);
    expect(parseMantisTrace(stored.trace)).toEqual(trace);
  });

  it('tolera datos faltantes o dañados', () => {
    expect(parseRoundMantis(undefined)).toBeNull();
    expect(parseRoundMantis({ sessionPk: 1, date: '2026-11-15T13:07:36Z', shots: [] })).toBeNull();
    expect(
      parseRoundMantis({
        sessionPk: 1,
        date: '2026-11-15T13:07:36Z',
        shots: [{ pk: 1, score: 90, split: 0 }, { pk: 'x' }],
      }),
    ).toMatchObject({
      hardware: '',
      rightHanded: true,
      distance: null,
      shots: [{ pk: 1, score: 90, split: 0, problem: '', cant: null }],
    });
    expect(parseMantisTrace(undefined)).toBeNull();
    expect(parseMantisTrace({ sampleRate: 0, shots: [] })).toBeNull();
    expect(
      parseMantisTrace({
        sampleRate: 400,
        shots: [
          { pk: 1, pitch: [1, 2, 3], yaw: [1, 2, 3], holdIndex: 0, pullIndex: 9, shotIndex: 1 },
          { pk: 2, pitch: [1, 2], yaw: [1] },
        ],
      }),
    ).toEqual({
      sampleRate: 400,
      shots: [
        {
          pk: 1,
          pitch: [1, 2, 3],
          yaw: [1, 2, 3],
          holdIndex: 0,
          // Fuera de rango: la presión del gatillo arranca con el apuntado.
          pullIndex: 0,
          shotIndex: 1,
          absolutePitch: null,
        },
      ],
    });
  });
});
