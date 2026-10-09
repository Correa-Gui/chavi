/**
 * Intenções que não dependem do LLM e valem antes de qualquer resposta da IA:
 * opt-out (CLAUDE.md regra 3, critério 2.6) e pedido de atendimento humano (critério 2.5).
 */

function normalize(text: string): string {
  // NFD separa os acentos em marcas combinantes (\p{M}), que então são removidas.
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const OPT_OUT =
  /^(sair|parar|pare|stop|cancelar|descadastrar|nao quero mais( receber)?( mensagens?)?)[\s.!]*$/;

/** A mensagem inteira é um pedido de saída ("Sair", "PARAR!", "não quero mais mensagens"). */
export function detectOptOut(text: string): boolean {
  return OPT_OUT.test(normalize(text));
}

const HUMAN_REQUEST = [
  /\b(falar|conversar|atendimento) com (um |uma |o |a )?(pessoa|humano|atendente|corretor|corretora|alguem)\b/,
  /\b(quero|prefiro|posso) (um |uma )?(atendente|corretor|corretora|pessoa|humano)\b/,
  /\bnao (quero|gosto de) (falar com )?(robo|bot|ia|maquina)\b/,
];

/** Pede para falar com uma pessoa ("quero falar com um corretor", "não quero falar com robô"). */
export function detectHumanRequest(text: string): boolean {
  const normalized = normalize(text);
  return HUMAN_REQUEST.some((pattern) => pattern.test(normalized));
}
