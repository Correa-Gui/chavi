import { describe, expectTypeOf, it } from 'vitest';
import type { Tables, MembershipRole } from './index';

// Garante, em tempo de typecheck, que os tipos gerados batem com o schema esperado.
describe('tipos gerados', () => {
  it('membership tem papel tipado', () => {
    expectTypeOf<Tables<'memberships'>['role']>().toEqualTypeOf<MembershipRole>();
    expectTypeOf<MembershipRole>().toEqualTypeOf<'admin' | 'gerente' | 'corretor' | 'financeiro'>();
  });

  it('audit_log.tenant_id é obrigatório', () => {
    expectTypeOf<Tables<'audit_log'>['tenant_id']>().toEqualTypeOf<string>();
  });
});
