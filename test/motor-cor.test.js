// Cor de severidade derivada do resultado do motor (verde/azul/amarelo/laranja/vermelho +
// informativo/revisar/indefinido). As faixas são múltiplos do limite já configurado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avaliar, corDoResultado, piorCor } from '../src/dominio/motor/index.js';

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));
const ADULTO = { tipoPomar: 'adulto' };

// n de 30 plantas com presença em `qtd` delas.
function plantas(itemId, qtd) {
  return Array.from({ length: 30 }, (_, i) => ({
    n: i + 1,
    obs: { [itemId]: { A: i < qtd ? 1 : 0, B: 0 } },
  }));
}
const resultado = (r, id) => r.resultados.find((x) => x.id === id);
const avaliarItem = (itemId, qtd) => resultado(avaliar({ ficha, atributos: ADULTO, plantas: plantas(itemId, qtd) }), itemId);

// acaro_branco_chumbinho: limite fixo de 10% na ficha (não depende de ajuste da empresa).
const ITEM = 'acaro_branco_chumbinho';
const LIMITE = ficha.regras.find((r) => r.itemId === ITEM).niveis[0].limite;
assert.equal(LIMITE, 0.1);

test('sem nenhuma planta positiva: verde', () => {
  const r = avaliarItem(ITEM, 0);
  assert.equal(r.status, 'abaixo');
  assert.deepEqual(corDoResultado(r), { cor: 'verde', rotulo: 'Nenhuma presença encontrada' });
});

test('presente, bem abaixo do limite (<0,5x): azul', () => {
  const qtd = Math.max(1, Math.round(30 * LIMITE * 0.2));
  const r = avaliarItem(ITEM, qtd);
  assert.equal(r.status, 'abaixo');
  assert.equal(corDoResultado(r).cor, 'azul');
});

test('se aproximando do limite (>=0,5x, ainda abaixo): amarelo', () => {
  const qtd = Math.max(1, Math.round(30 * LIMITE * 0.7));
  const r = avaliarItem(ITEM, qtd);
  assert.equal(r.status, 'abaixo');
  assert.equal(corDoResultado(r).cor, 'amarelo');
});

test('nível de ação atingido (>=1x, <2x): laranja', () => {
  const qtd = Math.round(30 * LIMITE * 1.3);
  const r = avaliarItem(ITEM, qtd);
  assert.equal(r.status, 'acao');
  assert.equal(corDoResultado(r).cor, 'laranja');
});

test('muito acima do limite (>=2x): vermelho', () => {
  const qtd = 30; // 100% infestado, bem acima de qualquer limite razoável
  const r = avaliarItem(ITEM, qtd);
  assert.equal(r.status, 'acao');
  assert.equal(corDoResultado(r).cor, 'vermelho');
});

test('inimigo natural presente: informativo, nunca entra na escala verde/vermelho', () => {
  const r = avaliarItem('acaros_predadores', 10);
  assert.equal(r.status, 'informativo');
  assert.deepEqual(corDoResultado(r), { cor: 'informativo', rotulo: 'Presente' });
});

test('inimigo natural ausente: informativo, não é "ruim"', () => {
  const r = avaliarItem('acaros_predadores', 0);
  assert.deepEqual(corDoResultado(r), { cor: 'informativo', rotulo: 'Não observado' });
});

test('praga com proposta desativada (sem limite) e presença: revisar, nunca um veredito automático', () => {
  const r = avaliarItem('ortezia_folha', 3);
  assert.equal(r.status, 'limite_nao_definido');
  assert.equal(corDoResultado(r).cor, 'revisar');
});

test('não aplicável no estágio fenológico: indefinido', () => {
  const r = avaliarItem('leprose_fruto', 0); // regra com aplicaSe: citrosVizinhos
  assert.equal(r.status, 'nao_aplicavel');
  assert.equal(corDoResultado(r).cor, 'indefinido');
});

test('praga em contagem de plantas (não percentual) usa a mesma régua de múltiplos', () => {
  // ortezia_folha com o "foco" ativado usa métrica plantas_positivas, limite 1 planta.
  const f = structuredClone(ficha);
  const regra = f.regras.find((r) => r.itemId === 'ortezia_folha');
  for (const n of regra.niveis) n.limite = n.proposta.limite;
  const r0 = resultado(avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('ortezia_folha', 0) }), 'ortezia_folha');
  const r1 = resultado(avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('ortezia_folha', 1) }), 'ortezia_folha');
  const r3 = resultado(avaliar({ ficha: f, atributos: ADULTO, plantas: plantas('ortezia_folha', 3) }), 'ortezia_folha');
  assert.equal(corDoResultado(r0).cor, 'verde');
  assert.equal(corDoResultado(r1).cor, 'laranja'); // 1 planta = já atingiu o limite (1), <2x
  assert.equal(corDoResultado(r3).cor, 'vermelho'); // 3 plantas = 3x o limite
});

test('piorCor: ignora informativo/indefinido e respeita a ordem de gravidade', () => {
  assert.equal(piorCor(['verde', 'azul', 'informativo']), 'azul');
  assert.equal(piorCor(['verde', 'laranja', 'vermelho']), 'vermelho');
  assert.equal(piorCor(['informativo', 'indefinido']), 'indefinido');
  assert.equal(piorCor(['revisar', 'amarelo']), 'revisar');
  assert.equal(piorCor([]), 'indefinido');
});
