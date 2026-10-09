import { base, nextApp } from '@chavi/config/eslint';

export default [
  {
    ignores: ['**/node_modules/**', '**/.next/**', '**/.turbo/**', '**/dist/**', '**/coverage/**'],
  },
  ...base,
  ...nextApp.map((c) => ({
    ...c,
    files: ['apps/web/**/*.{ts,tsx}'],
    settings: { ...c.settings, next: { rootDir: 'apps/web' } },
  })),
];
