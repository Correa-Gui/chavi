/** Dinheiro é sempre inteiro em centavos (ADR-004). Nunca float. */
export type Cents = number;

export function assertCents(value: number): asserts value is Cents {
  if (!Number.isSafeInteger(value)) {
    throw new RangeError(`Valor em centavos deve ser inteiro seguro: ${value}`);
  }
}

/** Formata centavos como moeda brasileira, só para exibição. */
export function formatBRL(cents: Cents): string {
  assertCents(cents);
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cents / 100);
}
