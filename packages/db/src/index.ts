// Acesso a banco só por aqui (CLAUDE.md). Este ponto de entrada exporta só tipos e helpers
// puros; os clientes ficam em subcaminhos para o bundler nunca puxar a chave secret para o web:
//   @chavi/db/browser  componentes client do Next (chave publishable, RLS)
//   @chavi/db/server   server components, server actions e route handlers (publishable + cookies, RLS)
//   @chavi/db/secret   worker e scripts (chave secret, ignora RLS). Proibido em apps/web (ADR-007).
export type { Database, Json, Tables, TablesInsert, TablesUpdate, Enums } from './types.gen';
export { Constants } from './types.gen';
export type { ChaviClient, MembershipRole, JobOutboxStatus } from './types';
export { enqueue, JOB_NAMES } from './enqueue';
export type { EnqueueInput, EnqueueResult, JobName } from './enqueue';
