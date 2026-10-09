import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';

/** Regras para todo o monorepo. */
export const base = tseslint.config(js.configs.recommended, ...tseslint.configs.recommended, {
  languageOptions: { globals: { ...globals.node } },
  rules: {
    // CLAUDE.md: sem `any` sem justificativa em comentário.
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/consistent-type-imports': 'error',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
  },
});

/** Regras extras só para apps/web (Next.js). */
export const nextApp = [...nextCoreWebVitals];
