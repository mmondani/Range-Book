import { describe, expect, it } from 'vitest';
import EXAMPLE from '../../docs/features/003-mantisx/ejemplos/mantisx-2026-10-15_2026-11-15.json?raw';
import { mantisExport, MANTIS_EXPORT } from '@/test/mantis-fixture';
import { parseMantisFile, type MantisFile } from './mantis-import';

function parsed(data: unknown): MantisFile {
  const result = parseMantisFile(JSON.stringify(data));
  if (!result.ok) throw new Error(result.error);
  return result.file;
}

describe('parseMantisFile', () => {
  it('lee las sesiones con sus datos, los números como números y la fecha en UTC', () => {
    const { sessions, omitted } = parsed(MANTIS_EXPORT);
    expect(sessions.map((item) => item.summary.sessionPk)).toEqual([36042015, 36042043, 36042499]);
    expect(omitted).toEqual({ count: 0, trainings: [] });

    const { summary, trace } = sessions[2]!;
    expect(summary).toMatchObject({
      date: '2026-11-15T14:04:04.000Z',
      hardware: 'X10',
      rightHanded: false,
      firearm: { make: 'Glock', model: 'G17', caliber: '9x19mm' },
      distance: { value: 6, metric: false },
    });
    expect(summary.shots[1]).toEqual({
      pk: 452249271,
      score: 91.31,
      split: 3.9,
      problem: 'SLAPPING TRIGGER',
      angle: 313.17,
      triggerHold: 0.15,
      triggerPull: 0.08,
      cant: 0.9611723,
    });
    expect(trace.sampleRate).toBeCloseTo(400 / 30);
    expect(trace.shots[0]).toMatchObject({
      pk: 452249270,
      holdIndex: 0,
      pullIndex: 8,
      shotIndex: 10,
      absolutePitch: -2.0776556,
    });
    expect(trace.shots[0]!.pitch).toHaveLength(15);
    expect(trace.shots[0]!.yaw).toHaveLength(15);
  });

  it('no guarda bullseye, session_pk ni extras.iteration', () => {
    const { summary, trace } = parsed(MANTIS_EXPORT).sessions[0]!;
    for (const shot of [summary.shots[0], trace.shots[0]]) {
      expect(shot).not.toHaveProperty('bullseye');
      expect(shot).not.toHaveProperty('session_pk');
      expect(shot).not.toHaveProperty('extras');
    }
  });

  it('lee el archivo de ejemplo completo', () => {
    const { sessions } = parsed(JSON.parse(EXAMPLE));
    expect(sessions).toHaveLength(20);
    expect(sessions.every((item) => item.trace.sampleRate === 400)).toBe(true);
    expect(sessions[0]!.trace.shots[0]!.pitch).toHaveLength(305);
  });

  it('omite los otros entrenamientos y cuenta cuáles fueron', () => {
    const data = mantisExport();
    const [base] = data.sessions;
    data.sessions.push(
      { ...base, pk: 1, fire_type: 0, drill_name: 'Open Training' },
      { ...base, pk: 2, fire_type: 0, drill_name: 'Open Training' },
      { ...base, pk: 3, drill_id: 7, drill_name: 'Holster Draw Analysis' },
    );
    const file = parsed(data);
    expect(file.sessions).toHaveLength(3);
    expect(file.omitted).toEqual({
      count: 3,
      trainings: ['tiro en seco', 'Holster Draw Analysis'],
    });
  });

  it('descarta las sesiones y los disparos borrados', () => {
    const data = mantisExport();
    data.sessions[0]!.deleted = true;
    const shots = data.sessions[1]!.shots as Record<string, unknown>[];
    shots[0]!.deleted = true;
    const { sessions } = parsed(data);
    expect(sessions.map((item) => item.summary.sessionPk)).toEqual([36042043, 36042499]);
    expect(sessions[0]!.summary.shots).toHaveLength(3);
    expect(sessions[0]!.trace.shots).toHaveLength(3);
  });

  it('distingue un archivo que no es de MantisX, uno más nuevo y uno dañado', () => {
    expect(parseMantisFile('{"sessions": []}')).toEqual({ ok: false, error: 'not-mantis' });
    expect(parseMantisFile('[1, 2]')).toEqual({ ok: false, error: 'not-mantis' });
    expect(parseMantisFile(JSON.stringify({ ...MANTIS_EXPORT, formatVersion: 2 }))).toEqual({
      ok: false,
      error: 'newer-version',
    });
    expect(parseMantisFile('{"source": "mantisx", "formatVe')).toEqual({
      ok: false,
      error: 'unreadable',
    });

    const broken = mantisExport();
    (broken.sessions[0]!.shots as Record<string, unknown>[])[0]!.score = 'mucho';
    expect(parseMantisFile(JSON.stringify(broken))).toEqual({ ok: false, error: 'unreadable' });

    const badIndex = mantisExport();
    (badIndex.sessions[0]!.shots as Record<string, unknown>[])[0]!.shot_index = 99;
    expect(parseMantisFile(JSON.stringify(badIndex))).toEqual({ ok: false, error: 'unreadable' });
  });

  it('avisa si no queda ninguna sesión de fuego real de Open Training', () => {
    const data = mantisExport();
    data.sessions = data.sessions.map((item) => ({ ...item, fire_type: 0 }));
    expect(parseMantisFile(JSON.stringify(data))).toEqual({ ok: false, error: 'no-sessions' });
  });
});
