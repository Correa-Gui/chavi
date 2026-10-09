import { describe, expect, it } from 'vitest';
import { assertCents, formatBRL } from './money';

describe('money', () => {
  it('rejeita valores que não são inteiros', () => {
    expect(() => assertCents(10.5)).toThrow(RangeError);
    expect(() => assertCents(Number.NaN)).toThrow(RangeError);
  });

  it('aceita centavos inteiros', () => {
    expect(() => assertCents(123456)).not.toThrow();
  });

  it('formata centavos em reais', () => {
    expect(formatBRL(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56');
  });
});
