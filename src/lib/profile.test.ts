import { describe, expect, it } from 'vitest';
import { parseProfile, profileSummary } from './profile';

describe('parseProfile', () => {
  it('lee un perfil válido tal cual', () => {
    expect(
      parseProfile({ displayName: 'Ana', photoURL: 'https://foto', units: 'in', theme: 'light' }),
    ).toEqual({ displayName: 'Ana', photoURL: 'https://foto', units: 'in', theme: 'light' });
  });

  it('completa los valores faltantes o inválidos con los de defecto', () => {
    expect(parseProfile({ units: 'cm', theme: 'azul' })).toEqual({
      displayName: '',
      photoURL: null,
      units: 'mm',
      theme: 'dark',
    });
  });
});

describe('profileSummary', () => {
  it('sin datos, todo en cero', () => {
    expect(profileSummary([], [])).toEqual({ sessions: 0, shots: 0, firearms: 0 });
  });

  it('suma los disparos de todas las rondas de todas las sesiones', () => {
    const sessions = [
      { rounds: [{ shots: 10 }, { shots: 5 }] },
      { rounds: [] },
      {},
      { rounds: [{ shots: 20 }] },
    ];
    expect(profileSummary(sessions, [])).toMatchObject({ sessions: 4, shots: 35 });
  });

  it('ignora disparos inválidos', () => {
    expect(
      profileSummary([{ rounds: [{ shots: -3 }, { shots: '7' }, {}, { shots: 4 }] }], []).shots,
    ).toBe(4);
  });

  it('no cuenta las armas archivadas', () => {
    const firearms = [{ archived: false }, { archived: true }, {}];
    expect(profileSummary([], firearms).firearms).toBe(2);
  });
});
