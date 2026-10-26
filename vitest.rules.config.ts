import { defineConfig } from 'vitest/config';

// Tests de reglas de Firestore y Storage. Se corren con `pnpm test:rules`,
// que levanta los emuladores antes de ejecutarlos.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/rules/**/*.test.ts'],
    passWithNoTests: true,
    fileParallelism: false,
  },
});
