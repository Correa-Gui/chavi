import { describe, expect, it } from 'vitest';
import { detectHumanRequest, detectOptOut } from './intents';

describe('detectOptOut', () => {
  it.each(['Sair', 'PARAR!', ' parar ', 'pare', 'Não quero mais receber mensagens', 'stop'])(
    '"%s" é opt-out',
    (text) => expect(detectOptOut(text)).toBe(true),
  );

  it.each(['quero sair do aluguel', 'não posso parar de pagar o aluguel', 'sair de casa', 'oi'])(
    '"%s" não é opt-out (frase comum na conversa)',
    (text) => expect(detectOptOut(text)).toBe(false),
  );
});

describe('detectHumanRequest', () => {
  it.each([
    'Quero falar com uma pessoa',
    'posso falar com um corretor?',
    'prefiro atendente',
    'não quero falar com robô',
    'quero conversar com alguém',
  ])('"%s" pede humano', (text) => expect(detectHumanRequest(text)).toBe(true));

  it.each(['meu corretor de seguros disse', 'tenho renda de 3 mil', 'sim, pode seguir'])(
    '"%s" não pede humano',
    (text) => expect(detectHumanRequest(text)).toBe(false),
  );
});
