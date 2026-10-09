import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const tokensPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../../packages/config/tokens.css',
);
const css = readFileSync(tokensPath, 'utf8');

function color(name: string): string {
  const match = new RegExp(`--color-${name}: *(#[0-9a-f]{6});`, 'i').exec(css);
  if (!match?.[1]) throw new Error(`Token --color-${name} não encontrado em tokens.css`);
  return match[1];
}

function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

// Critério 0.7 / 4.5: texto ≥ 4.5:1 sobre o fundo em que aparece.
const pairs: [string, string][] = [
  ['ink', 'panel'],
  ['ink', 'surface'],
  ['ink', 'column'],
  ['ink-2', 'panel'],
  ['ink-2', 'surface'],
  ['ink-3', 'panel'],
  ['ink-3', 'surface'],
  ['nav-text', 'shell'],
  ['ink', 'accent'],
  ['hot-fg', 'hot-bg'],
  ['warm-fg', 'warm-bg'],
  ['cold-fg', 'cold-bg'],
  ['triage-fg', 'triage-bg'],
  ['out-fg', 'out-bg'],
  ['sla-fg', 'sla-bg'],
  ['won-fg', 'won-bg'],
];

describe('tokens.css', () => {
  it.each(pairs)('texto %s sobre %s tem contraste >= 4.5:1', (fg, bg) => {
    expect(contrast(color(fg), color(bg))).toBeGreaterThanOrEqual(4.5);
  });
});
