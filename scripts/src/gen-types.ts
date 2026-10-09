import { spawnSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { assertDevTarget } from './target';

/**
 * pnpm db:types — gera packages/db/src/types.gen.ts a partir do schema `public`.
 *   sem flag: projeto chavi-dev (exige SUPABASE_ACCESS_TOKEN, gerado em
 *             supabase.com/dashboard/account/tokens, ou `supabase login`)
 *   --local:  Supabase local (CI)
 * Sem Docker na máquina do fundador; alternativa: tool `generate_typescript_types` do MCP.
 */

const SUPABASE_CLI = 'supabase@2.120.0';
const HEADER = '// Gerado por `pnpm db:types` a partir do chavi-dev. Não edite à mão.\n';

const local = process.argv.includes('--local');
const outFile = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../packages/db/src/types.gen.ts',
);

function main() {
  const target = local ? ['--local'] : ['--project-id', projectRef()];
  const result = spawnSync(
    'npx',
    ['-y', SUPABASE_CLI, 'gen', 'types', 'typescript', ...target, '--schema', 'public'],
    { encoding: 'utf8', shell: process.platform === 'win32', stdio: ['ignore', 'pipe', 'inherit'] },
  );
  if (result.status !== 0 || !result.stdout.includes('export type Database')) {
    throw new Error('supabase gen types falhou (veja a saída acima).');
  }
  writeFileSync(outFile, HEADER + result.stdout);

  // A CLI e o MCP formatam diferente; o Prettier do repo normaliza para o diff mostrar só schema.
  const format = spawnSync('pnpm', ['exec', 'prettier', '--write', outFile], {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    stdio: ['ignore', 'ignore', 'inherit'],
  });
  if (format.status !== 0) throw new Error('prettier falhou ao formatar types.gen.ts.');

  console.log(`db:types ok: ${path.relative(process.cwd(), outFile)}`);
}

function projectRef(): string {
  assertDevTarget();
  const ref = process.env.SUPABASE_DEV_PROJECT_REF;
  if (!ref) throw new Error('SUPABASE_DEV_PROJECT_REF não definido.');
  return ref;
}

try {
  main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
