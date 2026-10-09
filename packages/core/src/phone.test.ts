import { describe, expect, it } from 'vitest';
import { jidToPhone, maskPhone, normalizePhoneBR } from './phone';

describe('normalizePhoneBR', () => {
  // Critério 1.1
  it.each(['(16) 99812-4410', '16998124410', '+55 16 99812-4410'])(
    '"%s" vira +5516998124410',
    (input) => {
      expect(normalizePhoneBR(input)).toEqual({ ok: true, e164: '+5516998124410' });
    },
  );

  it('aceita outros formatos comuns', () => {
    for (const input of ['5516998124410', '0 16 99812-4410', '16 99812.4410']) {
      expect(normalizePhoneBR(input)).toEqual({ ok: true, e164: '+5516998124410' });
    }
  });

  it('acrescenta o 9º dígito em celular que veio sem ele', () => {
    expect(normalizePhoneBR('551698124410')).toEqual({ ok: true, e164: '+5516998124410' });
  });

  it('mantém fixo com 8 dígitos', () => {
    expect(normalizePhoneBR('(16) 3322-1100')).toEqual({ ok: true, e164: '+551633221100' });
  });

  // Critério 1.2: inválido volta com motivo, sem exceção.
  it.each([
    ['', 'vazio'],
    ['abc', 'caracteres_invalidos'],
    ['12345', 'tamanho_invalido'],
    ['(20) 99812-4410', 'ddd_invalido'],
    ['(16) 89812-4410', 'numero_invalido'],
    ['(16) 1322-1100', 'numero_invalido'],
  ])('"%s" é recusado com motivo %s', (input, reason) => {
    expect(normalizePhoneBR(input)).toEqual({ ok: false, reason });
  });

  it('um lote com números inválidos não quebra', () => {
    const results = ['16998124410', 'lixo', '(16) 99812-4410'].map(normalizePhoneBR);
    expect(results.map((r) => r.ok)).toEqual([true, false, true]);
  });
});

describe('jidToPhone', () => {
  it('converte JID individual brasileiro, com e sem o 9º dígito', () => {
    expect(jidToPhone('5516998124410@s.whatsapp.net')).toEqual({
      ok: true,
      e164: '+5516998124410',
    });
    expect(jidToPhone('551698124410@s.whatsapp.net')).toEqual({ ok: true, e164: '+5516998124410' });
  });

  it('recusa grupos e @lid', () => {
    expect(jidToPhone('120363025246125486@g.us').ok).toBe(false);
    expect(jidToPhone('123456789012345@lid').ok).toBe(false);
  });

  it('aceita número estrangeiro sem reformatar', () => {
    expect(jidToPhone('14155550123@s.whatsapp.net')).toEqual({ ok: true, e164: '+14155550123' });
  });
});

describe('maskPhone', () => {
  it('não mostra o número completo', () => {
    expect(maskPhone('+5516998124410')).toBe('+5516****10');
  });
});
