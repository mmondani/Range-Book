import { describe, expect, it } from 'vitest';
import {
  accumulatedShots,
  accumulatedShotsDetail,
  caliberSuggestions,
  configurationModifications,
  configurationSessions,
  firearmConfigurations,
  firearmDraft,
  firearmInput,
  parseConfiguration,
  parseFirearm,
  parsePriorShots,
  parseSessionUsage,
  toggleModification,
  validateConfiguration,
  validateFirearm,
  validateModification,
  type Configuration,
  type Firearm,
  type FirearmDraft,
  type Modification,
  type SessionUsage,
} from './firearms';
import { pendingPhoto } from './photos';

const GLOCK: Firearm = {
  id: 'glock',
  brand: 'Glock',
  model: '17 Gen5',
  caliber: '9×19 mm',
  purchaseDate: '2023-03-14',
  purchasePlace: 'Armería Centro',
  priorShots: 1200,
  photos: ['users/ana/firearms/glock/a.jpg'],
  archived: false,
};

const mod = (id: string, brand: string, archived = false): Modification => ({
  id,
  brand,
  model: 'X',
  comments: '',
  archived,
});
const HOLOSUN = mod('holosun', 'Holosun');
const ZEV = mod('zev', 'Zev');
const TARAN = mod('taran', 'Taran', true);

const config = (
  id: string,
  name: string,
  modificationIds: string[],
  { firearmId = 'glock', archived = false } = {},
): Configuration => ({ id, name, firearmId, modificationIds, archived });
const IPSC = config('ipsc', 'Config. IPSC', ['zev', 'holosun']);
const NIGHT = config('night', 'Nocturna', ['holosun'], { archived: true });
const ACCURACY = config('accuracy', 'Precisión', ['scope'], { firearmId: 'ruger' });
const BULLSEYE = config('bullseye', 'Bullseye', ['taran']);

const USAGE: SessionUsage[] = [
  { firearmId: 'glock', configurationId: null, shots: 1000 },
  { firearmId: 'glock', configurationId: 'ipsc', shots: 1282 },
  { firearmId: 'ruger', configurationId: null, shots: 500 },
];

const TODAY = '2026-10-27';

function draft(overrides: Partial<FirearmDraft> = {}): FirearmDraft {
  return { ...firearmDraft(GLOCK), ...overrides };
}

describe('accumulatedShots', () => {
  it('suma los tiros previos y los disparos de todas las sesiones del arma', () => {
    expect(accumulatedShots(GLOCK, USAGE)).toEqual({
      total: 3482,
      prior: 1200,
      sessionShots: 2282,
      sessions: 2,
    });
  });

  it('sin sesiones son solo los previos', () => {
    expect(accumulatedShots(GLOCK, []).total).toBe(1200);
    expect(accumulatedShots({ id: 'nueva', priorShots: 0 }, USAGE).total).toBe(0);
  });

  it('cuenta las sesiones de cualquier configuración del arma', () => {
    const usage = [...USAGE, { firearmId: 'glock', configurationId: 'night', shots: 18 }];
    expect(accumulatedShots(GLOCK, usage).total).toBe(3500);
  });
});

describe('accumulatedShotsDetail', () => {
  it('desglosa previos y sesiones', () => {
    expect(accumulatedShotsDetail(accumulatedShots(GLOCK, USAGE))).toBe(
      '1.200 previos + 2.282 en 2 sesiones',
    );
    expect(accumulatedShotsDetail({ total: 50, prior: 0, sessionShots: 50, sessions: 1 })).toBe(
      'Todos en 1 sesión',
    );
  });

  it('sin sesiones lo aclara', () => {
    expect(accumulatedShotsDetail({ total: 300, prior: 300, sessionShots: 0, sessions: 0 })).toBe(
      'Todos previos al registro',
    );
    expect(accumulatedShotsDetail({ total: 0, prior: 0, sessionShots: 0, sessions: 0 })).toBe(
      'Todavía sin sesiones',
    );
  });
});

describe('firearmConfigurations', () => {
  const all = [IPSC, NIGHT, ACCURACY, BULLSEYE];

  it('"Stock" es implícita y va primero; después las del arma, por nombre', () => {
    const result = firearmConfigurations('glock', all);
    expect(result.map((c) => c.name)).toEqual(['Stock', 'Bullseye', 'Config. IPSC']);
    expect(result[0]).toEqual({
      kind: 'stock',
      id: null,
      name: 'Stock',
      firearmId: 'glock',
      modificationIds: [],
    });
  });

  it('un arma sin configuraciones igual tiene "Stock"', () => {
    expect(firearmConfigurations('cz', all).map((c) => c.id)).toEqual([null]);
  });

  it('las archivadas solo aparecen si se piden, al final', () => {
    expect(firearmConfigurations('glock', all, true).map((c) => c.name)).toEqual([
      'Stock',
      'Bullseye',
      'Config. IPSC',
      'Nocturna',
    ]);
  });
});

describe('configurationSessions', () => {
  it('cuenta las sesiones de cada configuración; null es "Stock"', () => {
    expect(configurationSessions(USAGE, 'glock', null)).toBe(1);
    expect(configurationSessions(USAGE, 'glock', 'ipsc')).toBe(1);
    expect(configurationSessions(USAGE, 'ruger', null)).toBe(1);
    expect(configurationSessions(USAGE, 'glock', 'night')).toBe(0);
  });
});

describe('configurationModifications', () => {
  it('respeta el orden elegido, mantiene las archivadas e ignora las que no existen', () => {
    const modifications = [HOLOSUN, ZEV, TARAN];
    expect(configurationModifications(IPSC, modifications)).toEqual([ZEV, HOLOSUN]);
    expect(configurationModifications(BULLSEYE, modifications)).toEqual([TARAN]);
    expect(configurationModifications(ACCURACY, modifications)).toEqual([]);
  });
});

describe('toggleModification', () => {
  it('agrega al final y quita sin repetir', () => {
    expect(toggleModification(['a'], 'b', true)).toEqual(['a', 'b']);
    expect(toggleModification(['a', 'b'], 'a', true)).toEqual(['b', 'a']);
    expect(toggleModification(['a', 'b'], 'a', false)).toEqual(['b']);
  });
});

describe('validateFirearm', () => {
  it('pide marca, modelo y calibre', () => {
    expect(validateFirearm(draft({ brand: ' ', model: '', caliber: '' }), TODAY)).toEqual({
      brand: 'Ingresá la marca',
      model: 'Ingresá el modelo',
      caliber: 'Ingresá el calibre',
    });
  });

  it('acepta un arma completa o solo con los campos obligatorios', () => {
    expect(validateFirearm(draft(), TODAY)).toEqual({});
    expect(
      validateFirearm(
        { ...firearmDraft(), brand: 'CZ', model: 'Shadow 2', caliber: '9×19 mm' },
        TODAY,
      ),
    ).toEqual({});
  });

  it('la fecha de compra tiene que ser válida y no futura', () => {
    expect(validateFirearm(draft({ purchaseDate: '2026-10-28' }), TODAY).purchaseDate).toBe(
      'La fecha no puede ser futura',
    );
    expect(validateFirearm(draft({ purchaseDate: '2023-02-30' }), TODAY).purchaseDate).toBe(
      'Ingresá una fecha válida',
    );
    expect(validateFirearm(draft({ purchaseDate: TODAY }), TODAY)).toEqual({});
  });

  it('los tiros previos son un entero no negativo', () => {
    const error = 'Ingresá un número entero, sin decimales';
    expect(validateFirearm(draft({ priorShots: '12,5' }), TODAY).priorShots).toBe(error);
    expect(validateFirearm(draft({ priorShots: '-3' }), TODAY).priorShots).toBe(error);
    expect(validateFirearm(draft({ priorShots: 'mil' }), TODAY).priorShots).toBe(error);
    expect(validateFirearm(draft({ priorShots: '' }), TODAY)).toEqual({});
  });

  it('hasta 20 fotos', () => {
    const photos = Array.from({ length: 21 }, (_, i) => pendingPhoto(new Blob(), `${i}.jpg`));
    expect(validateFirearm(draft({ photos }), TODAY).photos).toBe('Podés cargar hasta 20 fotos');
  });
});

describe('parsePriorShots', () => {
  it('acepta el separador de miles y vacío como 0', () => {
    expect(parsePriorShots('1200')).toBe(1200);
    expect(parsePriorShots(' 1.200 ')).toBe(1200);
    expect(parsePriorShots('1.000.000')).toBe(1_000_000);
    expect(parsePriorShots('')).toBe(0);
    expect(parsePriorShots('1.5')).toBeUndefined();
    expect(parsePriorShots('20000000')).toBeUndefined();
  });
});

describe('firearmDraft / firearmInput', () => {
  it('ida y vuelta: el borrador de un arma vuelve a dar el mismo documento', () => {
    const { id, archived, ...input } = GLOCK;
    void id;
    void archived;
    expect(firearmInput(firearmDraft(GLOCK), GLOCK.photos)).toEqual(input);
  });

  it('limpia espacios, guarda la fecha vacía como null y los tiros vacíos como 0', () => {
    expect(
      firearmInput(
        {
          brand: ' CZ ',
          model: 'Shadow 2 ',
          caliber: ' 9×19 mm',
          purchaseDate: '',
          purchasePlace: '  ',
          priorShots: '',
          photos: [],
        },
        [],
      ),
    ).toEqual({
      brand: 'CZ',
      model: 'Shadow 2',
      caliber: '9×19 mm',
      purchaseDate: null,
      purchasePlace: '',
      priorShots: 0,
      photos: [],
    });
  });

  it('un arma nueva arranca vacía y sin tiros previos', () => {
    expect(firearmDraft()).toEqual({
      brand: '',
      model: '',
      caliber: '',
      purchaseDate: '',
      purchasePlace: '',
      priorShots: '',
      photos: [],
    });
  });
});

describe('caliberSuggestions', () => {
  it('suma los calibres del usuario a los comunes, sin repetir', () => {
    const suggestions = caliberSuggestions([
      { caliber: '9×19 MM' },
      { caliber: '.44 Magnum' },
      { caliber: ' ' },
    ]);
    expect(suggestions).toContain('.44 Magnum');
    expect(suggestions).toContain('.22 LR');
    expect(suggestions.filter((c) => c.toLowerCase() === '9×19 mm')).toHaveLength(1);
    expect(suggestions).not.toContain('');
  });
});

describe('validateModification', () => {
  it('pide marca y modelo; los comentarios son opcionales', () => {
    expect(validateModification({ brand: '', model: ' ', comments: '' })).toEqual({
      brand: 'Ingresá la marca',
      model: 'Ingresá el modelo',
    });
    expect(validateModification({ brand: 'Zev', model: 'PRO', comments: '' })).toEqual({});
  });
});

describe('validateConfiguration', () => {
  const others = [IPSC, NIGHT, ACCURACY];
  const input = { name: 'Competencia', firearmId: 'glock', modificationIds: ['zev'] };

  it('pide nombre, arma y al menos una modificación', () => {
    expect(
      validateConfiguration({ name: ' ', firearmId: '', modificationIds: [] }, others),
    ).toEqual({
      name: 'Ingresá el nombre',
      firearmId: 'Elegí el arma',
      modificationIds: 'Elegí al menos una modificación',
    });
    expect(validateConfiguration(input, others)).toEqual({});
  });

  it('"Stock" está reservado para el arma sin modificaciones', () => {
    expect(validateConfiguration({ ...input, name: 'stock' }, others).name).toBe(
      '«Stock» es el arma sin modificaciones',
    );
  });

  it('no repite el nombre de otra configuración activa de la misma arma', () => {
    const error = 'Ya hay una configuración con ese nombre para esta arma';
    expect(validateConfiguration({ ...input, name: 'config. ipsc ' }, others).name).toBe(error);
    // Al editar, su propio nombre no cuenta.
    expect(validateConfiguration({ ...input, name: 'Config. IPSC' }, others, 'ipsc')).toEqual({});
    // Archivadas y de otras armas, tampoco.
    expect(validateConfiguration({ ...input, name: 'Nocturna' }, others)).toEqual({});
    expect(validateConfiguration({ ...input, name: 'Precisión' }, others)).toEqual({});
  });
});

describe('lectura de Firestore', () => {
  it('parseFirearm completa los faltantes con valores seguros', () => {
    expect(parseFirearm('x', { brand: 'CZ', priorShots: -4, photos: ['a', 3] })).toEqual({
      id: 'x',
      brand: 'CZ',
      model: '',
      caliber: '',
      purchaseDate: null,
      purchasePlace: '',
      priorShots: 0,
      photos: ['a'],
      archived: false,
    });
  });

  it('parseConfiguration', () => {
    expect(parseConfiguration('c', { name: 'IPSC', firearmId: 'g', archived: true })).toEqual({
      id: 'c',
      name: 'IPSC',
      firearmId: 'g',
      modificationIds: [],
      archived: true,
    });
  });

  it('parseSessionUsage suma los disparos de las rondas', () => {
    expect(
      parseSessionUsage({
        firearmId: 'glock',
        configurationId: 'ipsc',
        rounds: [{ shots: 10 }, { shots: 15 }, { shots: 'x' }, null],
      }),
    ).toEqual({ firearmId: 'glock', configurationId: 'ipsc', shots: 25 });
    expect(parseSessionUsage({ firearmId: 'glock' })).toEqual({
      firearmId: 'glock',
      configurationId: null,
      shots: 0,
    });
  });
});
