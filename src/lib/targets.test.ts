import { describe, expect, it } from 'vitest';
import { pendingPhoto } from './photos';
import {
  parseTargetClipboard,
  targetClipboardText,
  parseTarget,
  targetDraft,
  targetInput,
  targetSummary,
  targetZoneErrors,
  validateTarget,
  zoneDraft,
  type Target,
  type TargetDraft,
} from './targets';

const ISSF: Target = {
  id: 'issf',
  name: 'ISSF Pistola Precisión',
  photo: 'users/ana/targets/issf/a.jpg',
  scoring: 'rings',
  referenceSizeMm: 500,
  zones: [
    { score: 10, diameterMm: 50 },
    { score: 9, diameterMm: 100.5 },
  ],
  archived: false,
};

const IPSC: Target = {
  id: 'ipsc',
  name: 'IPSC Classic',
  photo: null,
  scoring: 'none',
  referenceSizeMm: 460,
  zones: [],
  archived: false,
};

function draft(overrides: Partial<TargetDraft> = {}): TargetDraft {
  return { ...targetDraft(ISSF), ...overrides };
}

const zones = (...rows: Array<[string, string]>) =>
  rows.map(([score, diameter]) => ({ ...zoneDraft(), score, diameter }));

describe('targetDraft', () => {
  it('nuevo: anillos, sin foto ni zonas', () => {
    expect(targetDraft()).toEqual({
      name: '',
      photos: [],
      scoring: 'rings',
      referenceSize: '',
      zones: [],
    });
  });

  it('edición: los números con coma decimal y la foto guardada', () => {
    const value = targetDraft(ISSF);
    expect(value.referenceSize).toBe('500');
    expect(value.photos).toEqual([{ status: 'stored', path: ISSF.photo }]);
    expect(value.zones.map(({ score, diameter }) => [score, diameter])).toEqual([
      ['10', '50'],
      ['9', '100,5'],
    ]);
  });
});

describe('validateTarget', () => {
  it('acepta un blanco de anillos completo', () => {
    expect(validateTarget(draft())).toEqual({});
  });

  it('pide el nombre y el tamaño de referencia', () => {
    expect(validateTarget(draft({ name: '  ', referenceSize: '' }))).toEqual({
      name: 'Ingresá el nombre',
      referenceSize: 'Ingresá el diámetro de la zona exterior',
    });
    expect(validateTarget(targetDraft(IPSC)).referenceSize).toBeUndefined();
    expect(validateTarget({ ...targetDraft(IPSC), referenceSize: '0' }).referenceSize).toBe(
      'Ingresá el ancho del blanco',
    );
  });

  it('acepta coma o punto decimal en la referencia y limita su tamaño', () => {
    expect(validateTarget(draft({ referenceSize: '500,5' }))).toEqual({});
    expect(validateTarget(draft({ referenceSize: '500.5' }))).toEqual({});
    expect(validateTarget(draft({ referenceSize: '10001' })).referenceSize).toBe('Hasta 10.000 mm');
  });

  it('con anillos pide al menos una zona', () => {
    expect(validateTarget(draft({ zones: [] })).zones).toBe(
      'Agregá al menos una zona o usá «Generar»',
    );
  });

  it('marca las zonas inválidas contra la referencia', () => {
    const value = draft({ referenceSize: '80', zones: zones(['10', '50'], ['9', '100']) });
    expect(validateTarget(value).zones).toBe('Revisá las zonas marcadas');
    expect(targetZoneErrors(value)).toEqual([
      {},
      { diameter: 'No puede superar el tamaño de referencia' },
    ]);
  });

  it('sin zonas no valida las zonas, aunque queden en el borrador', () => {
    const value = draft({ scoring: 'none', zones: zones(['x', '']) });
    expect(validateTarget(value)).toEqual({});
  });
});

describe('targetInput', () => {
  it('guarda las zonas de mayor a menor puntaje', () => {
    const value = draft({
      name: ' NRA B-8 ',
      referenceSize: '140',
      zones: zones(['8', '90'], ['10', '30,5'], ['9', '60']),
    });
    expect(targetInput(value, null)).toEqual({
      name: 'NRA B-8',
      photo: null,
      scoring: 'rings',
      referenceSizeMm: 140,
      zones: [
        { score: 10, diameterMm: 30.5 },
        { score: 9, diameterMm: 60 },
        { score: 8, diameterMm: 90 },
      ],
    });
  });

  it('sin zonas descarta las filas que quedaron en el borrador', () => {
    const value = draft({ scoring: 'none', referenceSize: '460' });
    expect(targetInput(value, 'users/ana/targets/t/a.jpg')).toEqual({
      name: ISSF.name,
      photo: 'users/ana/targets/t/a.jpg',
      scoring: 'none',
      referenceSizeMm: 460,
      zones: [],
    });
  });

  it('la foto pendiente no se guarda: se pasa la ruta ya subida', () => {
    const value = draft({ photos: [pendingPhoto(new Blob(), 'a.jpg', 'p1')] });
    expect(targetInput(value, null).photo).toBeNull();
  });
});

describe('targetSummary', () => {
  it('resume la geometría', () => {
    expect(targetSummary(ISSF)).toBe('Anillos · Ø 500 mm · 2 zonas');
    expect(targetSummary({ ...ISSF, referenceSizeMm: 140.5, zones: ISSF.zones.slice(0, 1) })).toBe(
      'Anillos · Ø 140,5 mm · 1 zona',
    );
    expect(targetSummary(IPSC)).toBe('Sin zonas · puntaje manual');
  });
});

describe('parseTarget', () => {
  it('lee un documento válido y ordena las zonas', () => {
    const { id, ...data } = ISSF;
    expect(parseTarget(id, { ...data, zones: [...data.zones].reverse() })).toEqual(ISSF);
  });

  it('tolera campos faltantes o inválidos', () => {
    expect(
      parseTarget('x', { zones: [{ score: 10 }, null, { score: 9, diameterMm: 20 }] }),
    ).toEqual({
      id: 'x',
      name: '',
      photo: null,
      scoring: 'rings',
      referenceSizeMm: 0,
      zones: [{ score: 9, diameterMm: 20 }],
      archived: false,
    });
    expect(
      parseTarget('y', { scoring: 'none', zones: [{ score: 1, diameterMm: 2 }] }).zones,
    ).toEqual([]);
  });
});

describe('targetClipboardText y parseTargetClipboard', () => {
  const rings = {
    name: 'ISSF Pistola Precisión',
    scoring: 'rings' as const,
    referenceSizeMm: 500,
    zones: [
      { score: 10, diameterMm: 50 },
      { score: 9, diameterMm: 100 },
    ],
  };

  it('ida y vuelta, con anillos y sin zonas', () => {
    expect(parseTargetClipboard(targetClipboardText(rings))).toEqual(rings);
    const none = { name: 'IPSC', scoring: 'none' as const, referenceSizeMm: 460, zones: [] };
    expect(parseTargetClipboard(targetClipboardText(none))).toEqual(none);
  });

  it('solo copia los datos del blanco, no la foto ni el id', () => {
    const text = targetClipboardText({ ...rings, id: 'issf', photo: 'a.jpg' } as never);
    expect(text).not.toContain('"id"');
    expect(text).not.toContain('"photo"');
  });

  it('rechaza lo que no es un blanco copiado de la app', () => {
    const copied = JSON.parse(targetClipboardText(rings)) as Record<string, unknown>;
    const variant = (changes: Record<string, unknown>) =>
      parseTargetClipboard(JSON.stringify({ ...copied, ...changes }));
    expect(parseTargetClipboard('hola')).toBeNull();
    expect(parseTargetClipboard('null')).toBeNull();
    expect(variant({ rangebook: 'otra-cosa' })).toBeNull();
    expect(variant({ version: 2 })).toBeNull();
    expect(variant({ name: '  ' })).toBeNull();
    expect(variant({ scoring: 'puntos' })).toBeNull();
    expect(variant({ referenceSizeMm: 0 })).toBeNull();
    expect(variant({ zones: [] })).toBeNull();
    expect(variant({ zones: [{ score: 10, diameterMm: -1 }] })).toBeNull();
    expect(variant({ zones: [{ score: 1.5, diameterMm: 50 }] })).toBeNull();
  });

  it('ordena las zonas de mayor a menor puntaje', () => {
    const text = targetClipboardText({ ...rings, zones: [...rings.zones].reverse() });
    expect(parseTargetClipboard(text)?.zones).toEqual(rings.zones);
  });
});
