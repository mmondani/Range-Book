import { describe, expect, it } from 'vitest';
import { syntheticTarget } from '@/test/synthetic-target';
import type { Pixel } from './calibration';
import { centerDetectionScale, detectCenterInPhoto, detectTargetCenter } from './target-center';

function expectCenter(found: Pixel | null, expected: Pixel) {
  expect(found).not.toBeNull();
  expect(Math.hypot(found!.x - expected.x, found!.y - expected.y)).toBeLessThanOrEqual(1);
}

describe('detectTargetCenter', () => {
  it('encuentra el centro de un blanco con centro negro y anillos', () => {
    const center = { x: 170, y: 110 };
    const target = syntheticTarget({ width: 300, height: 240, center })
      .blackDisk(40)
      .ringLine(60)
      .ringLine(80)
      .ringLine(100);
    expectCenter(detectTargetCenter(target.image()), center);
  });

  it('con solo anillos finos, sin centro negro', () => {
    const center = { x: 100, y: 130 };
    const target = syntheticTarget({ center }).ringLine(20).ringLine(45).ringLine(70);
    expectCenter(detectTargetCenter(target.image()), center);
  });

  it('tolera agujeros, números impresos, el fondo detrás de la hoja y ruido', () => {
    const center = { x: 125, y: 115 };
    const target = syntheticTarget({ center })
      .background(12)
      .blackDisk(35)
      .ringLine(55)
      .ringLine(75)
      .ringLine(95)
      .line(30, 60, 90)
      .hole({ x: 130, y: 100 }, 200)
      .hole({ x: 110, y: 125 }, 200)
      .hole({ x: 175, y: 60 }, 40)
      .noise(12);
    expectCenter(detectTargetCenter(target.image()), center);
  });

  it('con el centro cerca del borde y los anillos cortados', () => {
    const center = { x: 60, y: 180 };
    const target = syntheticTarget({ center }).blackDisk(30).ringLine(55).ringLine(80);
    expectCenter(detectTargetCenter(target.image()), center);
  });

  it('una hoja sin anillos no tiene centro', () => {
    expect(detectTargetCenter(syntheticTarget().image())).toBeNull();
    const sheet = syntheticTarget().background(20).line(60, 40, 200).line(180, 40, 200).noise(12);
    expect(detectTargetCenter(sheet.image())).toBeNull();
  });
});

describe('centerDetectionScale', () => {
  it('reduce la foto a 400 px de lado mayor, sin agrandarla', () => {
    expect(centerDetectionScale({ width: 4000, height: 3000 })).toBe(0.1);
    expect(centerDetectionScale({ width: 600, height: 800 })).toBe(0.5);
    expect(centerDetectionScale({ width: 300, height: 200 })).toBe(1);
  });
});

describe('detectCenterInPhoto', () => {
  it('devuelve el centro en píxeles de la foto original', () => {
    const center = { x: 100, y: 130 };
    const target = syntheticTarget({ center }).ringLine(20).ringLine(45).ringLine(70);
    // La foto original mide el doble que la reducida.
    const found = detectCenterInPhoto(target.image(), { width: 480, height: 480 });
    expect(found).not.toBeNull();
    expect(Math.hypot(found!.x - 201, found!.y - 261)).toBeLessThanOrEqual(2);
  });

  it('sin centro claro devuelve null', () => {
    expect(detectCenterInPhoto(syntheticTarget().image(), { width: 480, height: 480 })).toBeNull();
  });
});
