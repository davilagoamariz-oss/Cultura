import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { agruparPorOrgao, definirGrupo, definirValor, obsParaGravar } from '../src/campo/ficha-campo.js';
import { montarResumo } from '../src/campo/resumo.js';
import { avaliar } from '../src/dominio/motor/index.js';
import { linhasComparativas, resumoPorItem } from '../src/gestao/comparativo.js';

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));
const item = (id) => ficha.itens.find((i) => i.id === id);
const tudoAusente = () => agruparPorOrgao(ficha).reduce((o, g) => definirGrupo(o, g, 0), {});

function resumoDoCenario({ tripes = 0, ferrugem = 0 } = {}) {
  const plantas = Array.from({ length: 30 }, (_, i) => {
    let obs = tudoAusente();
    if (i < tripes) obs = definirValor(obs, item('tripes_flor'), 'A', 2);
    if (i < ferrugem) obs = definirValor(obs, item('ferrugem_bgude'), 'A', 1);
    return { n: i + 1, obs: obsParaGravar(ficha, obs) };
  });
  return montarResumo(avaliar({ ficha, plantas, atributos: { tipoPomar: 'adulto' } }), ficha);
}

test('junta os itens em ação ou revisar de vários talhões, ordenado do NI mais alto para o mais baixo', () => {
  const linhas = linhasComparativas([
    { talhaoNome: 'Talhão 02', resumo: resumoDoCenario({ tripes: 9 }) }, // 30%, acima do nível de ação
    { talhaoNome: 'Talhão 01', resumo: resumoDoCenario({ tripes: 21 }) }, // 70%, mais grave
    { talhaoNome: 'Talhão 03', resumo: resumoDoCenario({}) }, // nada
  ]);
  assert.deepEqual(linhas.map((l) => l.talhaoNome), ['Talhão 01', 'Talhão 02']);
  assert.equal(linhas[0].itemNome, 'Tripes');
  assert.equal(linhas[0].status, 'acao');
  assert.match(linhas[0].niTexto, /70/);
});

test('itens "revisar" (sem limite definido, mas detectados) entram, mesmo sem NI que dispara TD', () => {
  const linhas = linhasComparativas([{ talhaoNome: 'Talhão 01', resumo: resumoDoCenario({ ferrugem: 3 }) }]);
  assert.ok(linhas.some((l) => l.itemNome.includes('Ácaro da ferrugem') && l.status === 'limite_nao_definido'));
});

test('um talhão sem nada em ação nem revisar não aparece em linha nenhuma', () => {
  assert.deepEqual(linhasComparativas([{ talhaoNome: 'Talhão Limpo', resumo: resumoDoCenario({}) }]), []);
});

test('lista vazia não quebra', () => {
  assert.deepEqual(linhasComparativas([]), []);
});

test('resumo por item: em quantos talhões cada item apareceu, do mais recorrente para o menos', () => {
  const linhas = linhasComparativas([
    { talhaoNome: 'T1', resumo: resumoDoCenario({ tripes: 21 }) },
    { talhaoNome: 'T2', resumo: resumoDoCenario({ tripes: 21 }) },
    { talhaoNome: 'T3', resumo: resumoDoCenario({ tripes: 21, ferrugem: 3 }) },
  ]);
  const porItem = resumoPorItem(linhas);
  assert.equal(porItem[0].itemNome, 'Tripes');
  assert.deepEqual(porItem[0].talhoes.sort(), ['T1', 'T2', 'T3']);
  assert.ok(porItem.find((p) => p.itemNome.includes('ferrugem')).talhoes.length === 1);
});
