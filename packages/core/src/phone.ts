/**
 * Normalização de telefone para E.164 (critérios 1.1 e 1.2 de docs/VALIDATION.md).
 * Erro esperado volta como resultado tipado (CLAUDE.md), nunca exceção.
 */

export type PhoneResult = { ok: true; e164: string } | { ok: false; reason: PhoneErrorReason };

export type PhoneErrorReason =
  'vazio' | 'caracteres_invalidos' | 'tamanho_invalido' | 'ddd_invalido' | 'numero_invalido';

// DDDs em uso no Brasil (Anatel).
const VALID_DDDS = new Set([
  11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 24, 27, 28, 31, 32, 33, 34, 35, 37, 38, 41, 42, 43,
  44, 45, 46, 47, 48, 49, 51, 53, 54, 55, 61, 62, 63, 64, 65, 66, 67, 68, 69, 71, 73, 74, 75, 77,
  79, 81, 82, 83, 84, 85, 86, 87, 88, 89, 91, 92, 93, 94, 95, 96, 97, 98, 99,
]);

/**
 * Aceita formatos comuns: "(16) 99812-4410", "16998124410", "+55 16 99812-4410",
 * "0 16 99812-4410", "5516998124410". Celular sem o 9º dígito (como vem em JIDs antigos do
 * WhatsApp) ganha o 9, para o mesmo número não virar dois leads.
 */
export function normalizePhoneBR(input: string): PhoneResult {
  const trimmed = input.trim();
  if (trimmed === '') return { ok: false, reason: 'vazio' };
  if (!/^[\d\s()+.-]+$/.test(trimmed)) return { ok: false, reason: 'caracteres_invalidos' };

  let digits = trimmed.replace(/\D/g, '');
  if (digits.startsWith('55') && (digits.length === 12 || digits.length === 13)) {
    digits = digits.slice(2);
  } else if (digits.startsWith('0') && (digits.length === 11 || digits.length === 12)) {
    digits = digits.slice(1); // prefixo de discagem nacional
  }
  if (digits.length !== 10 && digits.length !== 11) {
    return { ok: false, reason: 'tamanho_invalido' };
  }

  const ddd = Number(digits.slice(0, 2));
  if (!VALID_DDDS.has(ddd)) return { ok: false, reason: 'ddd_invalido' };

  let subscriber = digits.slice(2);
  if (subscriber.length === 8 && /^[6-9]/.test(subscriber)) {
    subscriber = `9${subscriber}`; // celular sem o 9º dígito
  }
  if (subscriber.length === 9 && !subscriber.startsWith('9')) {
    return { ok: false, reason: 'numero_invalido' };
  }
  if (subscriber.length === 8 && !/^[2-5]/.test(subscriber)) {
    return { ok: false, reason: 'numero_invalido' };
  }

  return { ok: true, e164: `+55${ddd}${subscriber}` };
}

/**
 * Converte o JID de um contato individual do WhatsApp ("5516998124410@s.whatsapp.net") em E.164.
 * Grupos, listas e identificadores @lid não são telefones: voltam como erro.
 */
export function jidToPhone(jid: string): PhoneResult {
  const match = /^(\d{8,15})@s\.whatsapp\.net$/.exec(jid.trim());
  if (!match) return { ok: false, reason: 'numero_invalido' };
  const digits = match[1]!;
  if (digits.startsWith('55')) return normalizePhoneBR(digits);
  return { ok: true, e164: `+${digits}` };
}

/** Telefone para log: só DDI, DDD e os 2 últimos dígitos (CLAUDE.md: nunca logar completo). */
export function maskPhone(e164: string): string {
  if (e164.length < 7) return '***';
  return `${e164.slice(0, 5)}****${e164.slice(-2)}`;
}
