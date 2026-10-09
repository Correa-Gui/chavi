import { describe, expect, it } from 'vitest';
import { checkDevTarget } from './target';

const REF = 'vvdossmsqeiimhwousjf';

describe('checkDevTarget', () => {
  it('aceita o projeto chavi-dev', () => {
    expect(
      checkDevTarget({ SUPABASE_URL: `https://${REF}.supabase.co`, SUPABASE_DEV_PROJECT_REF: REF }),
    ).toMatchObject({ ok: true });
  });

  it('recusa outro projeto da organização', () => {
    expect(
      checkDevTarget({
        SUPABASE_URL: 'https://ugdlpkhmajjiyygavwpt.supabase.co',
        SUPABASE_DEV_PROJECT_REF: REF,
      }),
    ).toMatchObject({ ok: false });
  });

  it('recusa quando o ref esperado não está definido', () => {
    expect(checkDevTarget({ SUPABASE_URL: `https://${REF}.supabase.co` })).toMatchObject({
      ok: false,
    });
  });

  it('recusa domínio que só contém o ref', () => {
    expect(
      checkDevTarget({
        SUPABASE_URL: `https://${REF}.supabase.co.evil.example`,
        SUPABASE_DEV_PROJECT_REF: REF,
      }),
    ).toMatchObject({ ok: false });
  });

  it('aceita Supabase local só com CI=true', () => {
    expect(checkDevTarget({ SUPABASE_URL: 'http://127.0.0.1:54321' })).toMatchObject({
      ok: false,
    });
    expect(checkDevTarget({ SUPABASE_URL: 'http://127.0.0.1:54321', CI: 'true' })).toMatchObject({
      ok: true,
    });
  });
});
