import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paraData, formatarQuando, formatarDia } from '../src/gestao/formato.js';

test('data e hora no fuso do aparelho, com zeros à esquerda', () => {
  assert.equal(formatarQuando(new Date(2026, 8, 5, 7, 3)), '05/09/2026 07:03');
  assert.equal(formatarQuando(new Date(2026, 11, 31, 23, 59)), '31/12/2026 23:59');
});

test('aceita Timestamp do Firestore, milissegundos e Date; o resto vira vazio', () => {
  const d = new Date(2026, 8, 22, 14, 5);
  assert.equal(formatarQuando({ toDate: () => d }), '22/09/2026 14:05');
  assert.equal(formatarQuando({ toMillis: () => d.getTime() }), '22/09/2026 14:05');
  assert.equal(formatarQuando(d.getTime()), '22/09/2026 14:05');
  for (const nada of [null, undefined, 'ontem', {}, NaN, new Date('x')]) assert.equal(formatarQuando(nada), '', String(nada));
  assert.equal(paraData(null), null);
});

test('dia a partir de AAAA-MM-DD', () => {
  assert.equal(formatarDia('2026-09-22'), '22/09/2026');
  assert.equal(formatarDia('22/09/2026'), '');
  assert.equal(formatarDia(undefined), '');
});
