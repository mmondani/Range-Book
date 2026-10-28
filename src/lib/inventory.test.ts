import { describe, expect, it } from 'vitest';
import {
  ammunitionName,
  cleanAmmunition,
  hasErrors,
  inventoryList,
  matchesSearch,
  parseAmmunition,
  parseCategory,
  parseRange,
  rangeName,
  selectableItems,
  validateAmmunition,
  validateRange,
  type Ammunition,
  type Range,
} from './inventory';

function ammo(id: string, brand: string, model: string, archived = false): Ammunition {
  return { id, brand, model, description: '', archived };
}

const MAGTECH = ammo('magtech', 'Magtech', '9mm FMJ');
const CCI = ammo('cci', 'CCI', 'Standard Velocity');
const SB = ammo('sb', 'Sellier & Bellot', '9mm', true);
const AGUILA = ammo('aguila', 'Águila', 'Super Extra', true);
const ITEMS = [MAGTECH, SB, CCI, AGUILA];

describe('parseCategory', () => {
  it('acepta las categorías de la URL y rechaza el resto', () => {
    expect(parseCategory('municiones')).toBe('municiones');
    expect(parseCategory('poligonos')).toBe('poligonos');
    expect(parseCategory('cohetes')).toBeUndefined();
    expect(parseCategory(undefined)).toBeUndefined();
  });
});

describe('inventoryList', () => {
  it('un archivado no aparece en la lista', () => {
    expect(inventoryList(ITEMS, ammunitionName, false)).toEqual([CCI, MAGTECH]);
  });

  it('con "Mostrar archivados" aparecen al final, ordenados por nombre', () => {
    expect(inventoryList(ITEMS, ammunitionName, true)).toEqual([CCI, MAGTECH, AGUILA, SB]);
  });

  it('ordena sin distinguir mayúsculas ni acentos', () => {
    const ranges: Range[] = [
      { id: 'b', name: 'club Norte', address: '', archived: false },
      { id: 'a', name: 'Álamos', address: '', archived: false },
      { id: 'c', name: 'Bahía', address: '', archived: false },
    ];
    expect(inventoryList(ranges, rangeName, false).map((range) => range.id)).toEqual([
      'a',
      'c',
      'b',
    ]);
  });
});

describe('selectableItems', () => {
  it('un archivado no se ofrece en los selects', () => {
    expect(selectableItems(ITEMS, ammunitionName)).toEqual([CCI, MAGTECH]);
  });

  it('si el valor elegido se archivó después, se sigue ofreciendo', () => {
    expect(selectableItems(ITEMS, ammunitionName, 'sb')).toEqual([CCI, MAGTECH, SB]);
  });

  it('al restaurarlo vuelve a ofrecerse', () => {
    const restored = ITEMS.map((item) => (item.id === 'sb' ? { ...item, archived: false } : item));
    expect(selectableItems(restored, ammunitionName).map((item) => item.id)).toEqual([
      'cci',
      'magtech',
      'sb',
    ]);
  });
});

describe('matchesSearch', () => {
  it('no distingue mayúsculas ni acentos', () => {
    expect(matchesSearch(['Club de Tiro Los Álamos'], 'alamos')).toBe(true);
    expect(matchesSearch(['Polígono Norte'], 'POLIGONO')).toBe(true);
  });

  it('cada palabra tiene que aparecer en algún campo', () => {
    expect(matchesSearch(['Magtech', '9mm FMJ', 'práctica'], 'magtech fmj')).toBe(true);
    expect(matchesSearch(['Magtech', '9mm FMJ'], 'magtech 22')).toBe(false);
  });

  it('sin texto, todo coincide', () => {
    expect(matchesSearch(['CCI'], '  ')).toBe(true);
  });
});

describe('parse', () => {
  it('completa los campos faltantes o inválidos', () => {
    expect(parseAmmunition('x', { brand: 'CCI', model: 3 })).toEqual({
      id: 'x',
      brand: 'CCI',
      model: '',
      description: '',
      archived: false,
    });
    expect(parseRange('y', { name: 'Club', archived: true })).toEqual({
      id: 'y',
      name: 'Club',
      address: '',
      archived: true,
    });
  });
});

describe('validación', () => {
  it('la munición necesita marca y modelo; la descripción es opcional', () => {
    const errors = validateAmmunition({ brand: '  ', model: '', description: '' });
    expect(errors).toEqual({ brand: 'Ingresá la marca', model: 'Ingresá el modelo' });
    expect(hasErrors(errors)).toBe(true);
    expect(hasErrors(validateAmmunition({ brand: 'CCI', model: 'SV', description: '' }))).toBe(
      false,
    );
  });

  it('el polígono necesita nombre; la dirección es opcional', () => {
    expect(validateRange({ name: ' ', address: 'Ruta 2' })).toEqual({ name: 'Ingresá el nombre' });
    expect(hasErrors(validateRange({ name: 'Club', address: '' }))).toBe(false);
  });

  it('se guarda sin espacios de más', () => {
    expect(cleanAmmunition({ brand: ' CCI ', model: 'SV ', description: ' 40 gr ' })).toEqual({
      brand: 'CCI',
      model: 'SV',
      description: '40 gr',
    });
  });
});
