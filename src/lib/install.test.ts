import { describe, expect, it } from 'vitest';
import { installMethod, isIos } from './install';

const IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID =
  'Mozilla/5.0 (Linux; Android 15; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';
const MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15';

describe('isIos', () => {
  it('reconoce el iPhone', () => {
    expect(isIos({ userAgent: IPHONE, platform: 'iPhone', maxTouchPoints: 5 })).toBe(true);
  });

  it('reconoce el iPad que se presenta como Mac', () => {
    expect(isIos({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 5 })).toBe(true);
  });

  it('no confunde una Mac ni un Android', () => {
    expect(isIos({ userAgent: MAC, platform: 'MacIntel', maxTouchPoints: 0 })).toBe(false);
    expect(isIos({ userAgent: ANDROID, platform: 'Linux armv8l', maxTouchPoints: 5 })).toBe(false);
  });
});

describe('installMethod', () => {
  it('usa el diálogo del navegador si llegó beforeinstallprompt', () => {
    expect(installMethod({ standalone: false, ios: false, canPrompt: true })).toBe('prompt');
  });

  it('en iOS muestra instrucciones', () => {
    expect(installMethod({ standalone: false, ios: true, canPrompt: false })).toBe('ios');
  });

  it('no ofrece nada si ya está instalada', () => {
    expect(installMethod({ standalone: true, ios: true, canPrompt: false })).toBeNull();
    expect(installMethod({ standalone: true, ios: false, canPrompt: true })).toBeNull();
  });

  it('no ofrece nada si el navegador no la puede instalar', () => {
    expect(installMethod({ standalone: false, ios: false, canPrompt: false })).toBeNull();
  });
});
