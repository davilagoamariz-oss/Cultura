import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { avaliar, calcularNI, aplicarOverrides, valorPlanta } from '../src/motor-regras.js';

const carregar = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), 'utf8'));
const { regras } = carregar('../regras/regras-iniciais.json');
const ficha = carregar('./ficha-exemplo.json');

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
  const plantas = plantasDe(Object.fromEntries(Object.entries(ficha).map(([id, f]) => [id, f.valores])));
  for (const [id, f] of Object.entries(ficha)) {
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

test('ferrugem: sem limite escolhido não decide; com override de 10% dispara TD2', () => {
  const plantas = plantasDe({ ferrugem_bgude: ficha.ferrugem_bgude.valores }); // NI = 13,3%

  const sem = avaliar({ tipoPomar: 'adulto', plantas }, regras);
  const r1 = sem.resultados.find((r) => r.id === 'ferrugem_bgude');
  assert.equal(r1.status, 'limite_nao_definido');
  assert.deepEqual(sem.decisao.tds, ['REVISAR']); // nunca TD1 com praga detectada e sem regra

  const com = avaliar({ tipoPomar: 'adulto', plantas }, aplicarOverrides(regras, { ferrugem_bgude: 0.10 }));
  assert.deepEqual(com.decisao.tds, ['TD2']);
  assert.equal(com.decisao.precisaAplicacao, true);

  const alto = avaliar({ tipoPomar: 'adulto', plantas }, aplicarOverrides(regras, { ferrugem_bgude: 0.15 }));
  assert.equal(alto.resultados.find((r) => r.id === 'ferrugem_bgude').status, 'abaixo');
});

test('larva minadora: limite depende do tipo de pomar (adulto 40%, novo 10%)', () => {
  const plantas = plantasDe({ larva_minadora_broto: comPresenca(6) }); // 20%
  assert.deepEqual(avaliar({ tipoPomar: 'adulto', plantas }, regras).decisao.tds, ['TD1']);
  assert.deepEqual(avaliar({ tipoPomar: 'novo', plantas }, regras).decisao.tds, ['TD3']);
});

test('tripes usa "maior que 20%": exatamente 20% não dispara, acima dispara', () => {
  const em20 = plantasDe({ tripes_flor: comPresenca(6) }); // 6/30 = 20%
  const acima = plantasDe({ tripes_flor: comPresenca(7) }); // 23,3%
  assert.deepEqual(avaliar({ tipoPomar: 'adulto', plantas: em20 }, regras).decisao.tds, ['TD1']);
  assert.deepEqual(avaliar({ tipoPomar: 'adulto', plantas: acima }, regras).decisao.tds, ['TD3']);
});

test('podridão floral 5%: 2 de 30 plantas (6,7%) dispara TD4', () => {
  const plantas = plantasDe({ podridao_floral_flor: comPresenca(2) });
  assert.deepEqual(avaliar({ tipoPomar: 'adulto', plantas }, regras).decisao.tds, ['TD4']);
});

test('leprose só conta com citros vizinhos', () => {
  const plantas = plantasDe({ leprose_fruto: comPresenca(5) });
  const sem = avaliar({ tipoPomar: 'adulto', plantas }, regras);
  assert.equal(sem.resultados.find((r) => r.id === 'leprose_fruto').status, 'nao_aplicavel');
  const com = avaliar({ tipoPomar: 'adulto', contexto: { citrosVizinhos: true }, plantas }, regras);
  assert.deepEqual(com.decisao.tds, ['TD2']);
});

test('vários alvos no mesmo talhão geram vários TDs; inimigos naturais pedem produto seletivo', () => {
  const plantas = plantasDe({
    acaro_branco_azeitona: comPresenca(4), // 13,3% -> TD2
    podridao_floral_flor: comPresenca(3), // 10% -> TD4
    joaninha: comPresenca(10),
  });
  const { decisao } = avaliar({ tipoPomar: 'adulto', plantas }, regras);
  assert.deepEqual(decisao.tds, ['TD2', 'TD4']);
  assert.equal(decisao.usarProdutoSeletivo, true);
});

test('tudo abaixo do limite e sem pendências: TD1 (não pulverizar)', () => {
  const plantas = plantasDe({ acaro_branco_azeitona: semPraga(), tripes_flor: semPraga() });
  const { decisao } = avaliar({ tipoPomar: 'adulto', plantas }, regras);
  assert.deepEqual(decisao.tds, ['TD1']);
  assert.equal(decisao.precisaAplicacao, false);
});

test('bicho-furão sem limite definido pede revisão manual quando há captura', () => {
  const plantas = Array.from({ length: 30 }, (_, i) => ({
    n: i + 1,
    obs: { bicho_furao: { A: null, B: i < 3 ? 1 : 0 } },
  }));
  const { decisao } = avaliar({ tipoPomar: 'adulto', plantas }, regras);
  assert.deepEqual(decisao.tds, ['REVISAR']);
  assert.equal(decisao.revisarManual[0].id, 'bicho_furao');
});
