import { describe, expect, it } from 'vitest';
import {
  IDENTITY,
  invert,
  localScale,
  multiply,
  project,
  projectCircle,
  scaling,
  type Ellipse,
  type Matrix3,
} from './homography';

/** Una homografía con perspectiva (la última fila no es 0, 0, 1). */
const PERSPECTIVE: Matrix3 = [2, 0.3, 40, -0.2, 1.8, 60, 0.001, 0.002, 1];

/** `1` si el punto está sobre la elipse. */
function onEllipse({ center, rx, ry, angle }: Ellipse, point: { x: number; y: number }) {
  const a = (-angle * Math.PI) / 180;
  const dx = point.x - center.x;
  const dy = point.y - center.y;
  const u = dx * Math.cos(a) - dy * Math.sin(a);
  const v = dx * Math.sin(a) + dy * Math.cos(a);
  return (u / rx) ** 2 + (v / ry) ** 2;
}

describe('homografías', () => {
  it('la inversa deshace la homografía', () => {
    multiply(PERSPECTIVE, invert(PERSPECTIVE)).forEach((value, index) =>
      expect(value).toBeCloseTo(IDENTITY[index]!),
    );
    const point = project(invert(PERSPECTIVE), project(PERSPECTIVE, { x: 12, y: -7 }));
    expect(point.x).toBeCloseTo(12);
    expect(point.y).toBeCloseTo(-7);
  });

  it('la escala local de una ampliación es su factor', () => {
    expect(localScale(scaling(3), { x: 5, y: 5 })).toBeCloseTo(3);
  });
});

describe('projectCircle', () => {
  it('sin perspectiva, un círculo sigue siendo un círculo con el mismo centro', () => {
    const ellipse = projectCircle(scaling(2), { x: 10, y: 5 }, 4);
    expect(ellipse.center.x).toBeCloseTo(20);
    expect(ellipse.center.y).toBeCloseTo(10);
    expect(ellipse.rx).toBeCloseTo(8);
    expect(ellipse.ry).toBeCloseTo(8);
  });

  it('con perspectiva, la elipse pasa por todos los puntos del círculo proyectados', () => {
    const center = { x: 30, y: -20 };
    const ellipse = projectCircle(PERSPECTIVE, center, 50);
    for (let k = 0; k < 24; k++) {
      const t = (k * Math.PI) / 12;
      const point = project(PERSPECTIVE, {
        x: center.x + 50 * Math.cos(t),
        y: center.y + 50 * Math.sin(t),
      });
      expect(onEllipse(ellipse, point)).toBeCloseTo(1, 6);
    }
    // Y su centro ya no es la imagen del centro del círculo.
    const projected = project(PERSPECTIVE, center);
    expect(
      Math.hypot(ellipse.center.x - projected.x, ellipse.center.y - projected.y),
    ).toBeGreaterThan(0.1);
  });
});
