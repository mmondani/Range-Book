import { afterEach, describe, expect, it, vi } from 'vitest';
import { compressImage, fitWithin } from './image-compression';

describe('fitWithin', () => {
  it('reduce una foto apaisada a 2000 px de ancho', () => {
    expect(fitWithin({ width: 4000, height: 3000 })).toEqual({ width: 2000, height: 1500 });
  });

  it('reduce una foto vertical a 2000 px de alto', () => {
    expect(fitWithin({ width: 3024, height: 4032 })).toEqual({ width: 1500, height: 2000 });
  });

  it('no agranda las fotos más chicas', () => {
    expect(fitWithin({ width: 1200, height: 900 })).toEqual({ width: 1200, height: 900 });
    expect(fitWithin({ width: 2000, height: 2000 })).toEqual({ width: 2000, height: 2000 });
  });

  it('redondea al píxel más cercano y nunca deja un lado en 0', () => {
    expect(fitWithin({ width: 4001, height: 3001 })).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin({ width: 10000, height: 2 })).toEqual({ width: 2000, height: 1 });
  });

  it('acepta otro lado máximo', () => {
    expect(fitWithin({ width: 800, height: 600 }, 400)).toEqual({ width: 400, height: 300 });
  });

  it('rechaza dimensiones inválidas', () => {
    expect(() => fitWithin({ width: 0, height: 100 })).toThrow();
    expect(() => fitWithin({ width: Number.NaN, height: 100 })).toThrow();
  });
});

describe('compressImage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('dibuja la imagen reducida y la codifica como JPEG al 80 %', async () => {
    const close = vi.fn();
    vi.stubGlobal(
      'createImageBitmap',
      vi.fn().mockResolvedValue({ width: 4032, height: 3024, close }),
    );
    const drawImage = vi.fn();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage,
    } as unknown as CanvasRenderingContext2D);
    const output = new Blob(['jpeg'], { type: 'image/jpeg' });
    const toBlob = vi
      .spyOn(HTMLCanvasElement.prototype, 'toBlob')
      .mockImplementation((callback) => callback(output));

    const result = await compressImage(new Blob(['foto'], { type: 'image/heic' }));

    expect(result).toEqual({ blob: output, width: 2000, height: 1500 });
    expect(drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 2000, 1500);
    expect(toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/jpeg', 0.8);
    expect(close).toHaveBeenCalled();
  });

  it('libera la imagen aunque falle la codificación', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue({ width: 10, height: 10, close }));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      drawImage: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.spyOn(HTMLCanvasElement.prototype, 'toBlob').mockImplementation((callback) =>
      callback(null),
    );

    await expect(compressImage(new Blob(['x']))).rejects.toThrow();
    expect(close).toHaveBeenCalled();
  });
});
