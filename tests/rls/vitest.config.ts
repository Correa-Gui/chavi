import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Arquivo de ambiente na raiz (ADR-010): .env.local tem prioridade sobre .env, porque
// loadEnvFile não sobrescreve variável já definida. No CI as variáveis vêm do ambiente do job.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
for (const name of ['.env.local', '.env']) {
  const file = path.join(root, name);
  if (existsSync(file)) process.loadEnvFile(file);
}

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    // Os testes alteram estado compartilhado do banco: um arquivo por vez, em ordem.
    fileParallelism: false,
    sequence: { concurrent: false },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
