import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach, vi } from 'vitest';
import { setDesktop, setSystemPrefersLight } from './match-media';

beforeEach(() => {
  // jsdom no lo implementa (y lo avisa por consola).
  window.scrollTo = vi.fn() as typeof window.scrollTo;
  setSystemPrefersLight(false);
  setDesktop(false);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
