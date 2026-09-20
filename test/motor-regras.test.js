// Os 10 testes originais do motor. O comportamento é o mesmo; só mudou o formato de entrada:
// a ficha versionada (catalogo/fichas/limao-tahiti.v1.json) no lugar da lista de regras, os
// atributos do talhão no lugar de tipoPomar/contexto e os "ajustes" da empresa no lugar de
// aplicarOverrides.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avaliar, calcularNI, valorPlanta } from '../src/dominio/motor/index.js';

const carregar = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const ficha = carregar('../catalogo/fichas/limao-tahiti.v1.json');
const fichaExemplo = carregar('./ficha-exemplo.json');

const ADULTO = { tipoPomar: 'adulto' };
const NOVO = { tipoPomar: 'novo' };
const ajusteFerrugem = (limite) => [{ culturaId: 'limao-tahiti', itemId: 'ferrugem_bgude', limite, vigenteDe: 0 }];

// Monta 30 plantas a partir de { itemId: [30 valores] }
function plantasDe(itens) {
  return Array.from({ length: 30 }, (_, i) => ({
    n: i + 1,
    obs: Object.fromEntries(
      Object.entries(itens).map(([id, valores]) => [id, valores[i] === null ? null : { valor: valores[i] }]),
    ),
  }));
}
const semPraga = () => Array(30).fill(0);
const comPresenca = (qtd) => Array.from({ length: 30 }, (_, i) => (i < qtd ? 1 : 0));

test('NI bate com o que a planilha da ficha calcula (linhas de exemplo)', () => {
  const plantas = plantasDe(Object.fromEntries(Object.entries(fichaExemplo).map(([id, f]) => [id, f.valores])));
  for (const [id, f] of Object.entries(fichaExemplo)) {
    const { ni, avaliadas } = calcularNI(plantas, id);
    if (avaliadas === 0) {
      // Planilha mostra 0 para linha sem dados; o motor diferencia "sem dados" (null).
      assert.equal(ni, null, id);
      assert.equal(f.niPlanilha, 0, id);
    } else {
      assert.ok(Math.abs(ni - f.niPlanilha) < 1e-12, `${id}: motor ${ni} x planilha ${f.niPlanilha}`);
    }
  }
});

test('quadrantes A e B viram 0, 1 ou 2; lado único e não avaliável', () => {
  assert.equal(valorPlanta({ A: 0, B: 0 }), 0);
  assert.equal(valorPlanta({ A: 1, B: 0 }), 1);
  assert.equal(valorPlanta({ A: 1, B: 1 }), 2);
  assert.equal(valorPlanta({ A: null, B: 1 }), 1); // bicho-furão: só o lado da armadilha
  assert.equal(valorPlanta({ A: null, B: null }), null);
  assert.equal(valorPlanta(undefined), null);
});

test('ferrugem: sem limite escolhido não decide; com ajuste de 10% dispara TD2', () => {
  const plantas = plantasDe({ ferrugem_bgude: fichaExemplo.ferrugem_bgude.valores }); // NI = 13,3%

  const sem = avaliar({ ficha, atributos: ADULTO, plantas });
  const r1 = sem.resultados.find((r) => r.id === 'ferrugem_bgude');
  assert.equal(r1.status, 'limite_nao_definido');
  assert.deepEqual(sem.decisao.tds, ['REVISAR']); // nunca TD1 com praga detectada e sem regra

  const com = avaliar({ ficha, atributos: ADULTO, plantas, ajustes: ajusteFerrugem(0.10) });
  assert.deepEqual(com.decisao.tds, ['TD2']);
  assert.equal(com.decisao.precisaAplicacao, true);

  const alto = avaliar({ ficha, atributos: ADULTO, plantas, ajustes: ajusteFerrugem(0.15) });
  assert.equal(alto.resultados.find((r) => r.id === 'ferrugem_bgude').status, 'abaixo');
});

test('larva minadora: limite depende do tipo de pomar (adulto 40%, novo 10%)', () => {
  const plantas = plantasDe({ larva_minadora_broto: comPresenca(6) }); // 20%
  assert.deepEqual(avaliar({ ficha, atributos: ADULTO, plantas }).decisao.tds, ['TD1']);
  assert.deepEqual(avaliar({ ficha, atributos: NOVO, plantas }).decisao.tds, ['TD3']);
});

test('tripes usa "maior que 20%": exatamente 20% não dispara, acima dispara', () => {
  const em20 = plantasDe({ tripes_flor: comPresenca(6) }); // 6/30 = 20%
  const acima = plantasDe({ tripes_flor: comPresenca(7) }); // 23,3%
  assert.deepEqual(avaliar({ ficha, atributos: ADULTO, plantas: em20 }).decisao.tds, ['TD1']);
  assert.deepEqual(avaliar({ ficha, atributos: ADULTO, plantas: acima }).decisao.tds, ['TD3']);
});

test('podridão floral 5%: 2 de 30 plantas (6,7%) dispara TD4', () => {
  const plantas = plantasDe({ podridao_floral_flor: comPresenca(2) });
  assert.deepEqual(avaliar({ ficha, atributos: ADULTO, plantas }).decisao.tds, ['TD4']);
});

test('leprose só conta com citros vizinhos', () => {
  const plantas = plantasDe({ leprose_fruto: comPresenca(5) });
  const sem = avaliar({ ficha, atributos: ADULTO, plantas });
  assert.equal(sem.resultados.find((r) => r.id === 'leprose_fruto').status, 'nao_aplicavel');
  const com = avaliar({ ficha, atributos: { ...ADULTO, citrosVizinhos: true }, plantas });
  assert.deepEqual(com.decisao.tds, ['TD2']);
});

test('vários alvos no mesmo talhão geram vários TDs; inimigos naturais pedem produto seletivo', () => {
  const plantas = plantasDe({
    acaro_branco_azeitona: comPresenca(4), // 13,3% -> TD2
    podridao_floral_flor: comPresenca(3), // 10% -> TD4
    joaninha: comPresenca(10),
  });
  const { decisao } = avaliar({ ficha, atributos: ADULTO, plantas });
  assert.deepEqual(decisao.tds, ['TD2', 'TD4']);
  assert.equal(decisao.usarProdutoSeletivo, true);
});

test('tudo abaixo do limite e sem pendências: TD1 (não pulverizar)', () => {
  const plantas = plantasDe({ acaro_branco_azeitona: semPraga(), tripes_flor: semPraga() });
  const { decisao } = avaliar({ ficha, atributos: ADULTO, plantas });
  assert.deepEqual(decisao.tds, ['TD1']);
  assert.equal(decisao.precisaAplicacao, false);
});

test('bicho-furão sem limite definido pede revisão manual quando há captura', () => {
  const plantas = Array.from({ length: 30 }, (_, i) => ({
    n: i + 1,
    obs: { bicho_furao: { A: null, B: i < 3 ? 1 : 0 } },
  }));
  const { decisao } = avaliar({ ficha, atributos: ADULTO, plantas });
  assert.deepEqual(decisao.tds, ['REVISAR']);
  assert.equal(decisao.revisarManual[0].id, 'bicho_furao');
});
