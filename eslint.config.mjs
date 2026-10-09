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
  {
    // CLAUDE.md regra 1 e ADR-007: código que roda a pedido do usuário nunca usa a chave secret,
    // e o web só fala com o banco por @chavi/db (browser/server).
    files: ['apps/web/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: '@chavi/db/secret',
              message: 'Chave secret é proibida no web (ADR-007). Use @chavi/db/server.',
            },
            {
              name: '@supabase/supabase-js',
              message: 'Use os clientes de @chavi/db (browser/server).',
            },
            { name: '@supabase/ssr', message: 'Use os clientes de @chavi/db (browser/server).' },
          ],
        },
      ],
    },
  },
];
