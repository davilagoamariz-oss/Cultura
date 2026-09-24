// Tamanho da amostra por área/espaçamento (Manual Embrapa Doc. 183, p.11-14).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { densidadePorHa, totalDePlantasDoTalhao, calcularTamanhoAmostra } from '../src/campo/amostragem.js';

test('densidade por hectare vem do espaçamento (10.000m² / (entre plantas x entre linhas))', () => {
  assert.equal(densidadePorHa({ entrePlantas: 4, entreLinhas: 5 }), 500); // 10000/20
  assert.equal(densidadePorHa(null), null);
  assert.equal(densidadePorHa({ entrePlantas: 0, entreLinhas: 5 }), null);
  assert.equal(densidadePorHa({ entrePlantas: 4 }), null);
});

test('total de plantas = área x densidade; falta de dado dá null', () => {
  assert.equal(totalDePlantasDoTalhao(5, { entrePlantas: 4, entreLinhas: 5 }), 2500); // 5 x 500
  assert.equal(totalDePlantasDoTalhao(null, { entrePlantas: 4, entreLinhas: 5 }), null);
  assert.equal(totalDePlantasDoTalhao(5, null), null);
});

test('menos de 5 ha: 10 plantas, como manda o manual (p.14)', () => {
  assert.equal(calcularTamanhoAmostra(2, { entrePlantas: 6, entreLinhas: 4 }), 10);
  assert.equal(calcularTamanhoAmostra(4.9, { entrePlantas: 6, entreLinhas: 4 }), 10);
});

test('5 ha na densidade de referência (~300/ha, espaçamento 6x5,5m) dá 15 plantas — bate com o manual', () => {
  // 10000/(6*5.55) ≈ 300,3 plantas/ha; 5ha ≈ 1501,5 plantas; 1% ≈ 15
  const tamanho = calcularTamanhoAmostra(5, { entrePlantas: 6, entreLinhas: 5.55 });
  assert.equal(tamanho, 15);
});

test('mais de 5 ha: 1% do total, nunca menos que o piso de 10', () => {
  assert.equal(calcularTamanhoAmostra(10, { entrePlantas: 6, entreLinhas: 4 }), 42); // 10*416,67=4166,67 -> 1%=41,67 -> 42
  assert.equal(calcularTamanhoAmostra(20, { entrePlantas: 6, entreLinhas: 4 }), 83); // 1% de 8333 ~ 83
});

test('sem área ou sem espaçamento cadastrado: cai no piso do manual (15), documentado como padrão', () => {
  assert.equal(calcularTamanhoAmostra(null, null), 15);
  assert.equal(calcularTamanhoAmostra(12, null), 15); // tem área, mas sem espaçamento não dá pra calcular o total
  assert.equal(calcularTamanhoAmostra(undefined, undefined), 15);
});
