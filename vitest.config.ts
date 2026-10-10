import { defineConfig } from 'vitest/config';

import path from 'path';

export default defineConfig({
  test: {
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    exclude: ['**/node_modules/**', '**/dist/**'],
    env: {
      JWT_SECRET: 'test-secret',
    }
  },
});
