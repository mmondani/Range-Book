import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach, beforeEach } from 'vitest';
import { setDesktop, setSystemPrefersLight } from './match-media';

beforeEach(() => {
  setSystemPrefersLight(false);
  setDesktop(false);
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
});
