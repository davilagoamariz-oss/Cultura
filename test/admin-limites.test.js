import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { linhasDeLimites, lerLimite, montarAjuste, metricaAjustavel, historicoDoNivel } from '../src/admin/limites.js';
import { avaliar } from '../src/dominio/motor/index.js';

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));
const linha = (ls, item, nivel) => ls.find((l) => l.itemId === item && l.nivelId === nivel);

test('uma linha por nível da ficha, com o limite que vale hoje', () => {
  const ls = linhasDeLimites(ficha, []);
  assert.equal(ls.length, ficha.regras.reduce((s, r) => s + r.niveis.length, 0));
  const adulto = linha(ls, 'larva_minadora_broto', 'pomar-adulto');
  assert.equal(adulto.textoVigente, '40%');
  assert.equal(adulto.origem, 'ficha');
  assert.equal(adulto.condicao, 'adulto');
  assert.equal(linha(ls, 'larva_minadora_broto', 'pomar-novo').textoVigente, '10%');
  const pend = linha(ls, 'ferrugem_bgude', 'padrao');
  assert.equal(pend.origem, 'pendente');
  assert.equal(pend.textoVigente, 'sem limite definido');
  assert.deepEqual(pend.opcoes.map((o) => o.texto), ['5%', '10%', '15%']);
});

test('o ajuste vigente aparece no lugar da ficha, e o futuro ainda não vale', () => {
  const agora = 2_000_000;
  const aj = [
    { culturaId: 'limao-tahiti', itemId: 'larva_minadora_broto', nivelId: 'pomar-adulto', limite: 0.3, vigenteDe: 1_000_000 },
    { culturaId: 'limao-tahiti', itemId: 'larva_minadora_broto', nivelId: 'pomar-novo', limite: 0.05, vigenteDe: 3_000_000 },
  ];
  const ls = linhasDeLimites(ficha, aj, agora);
  const a = linha(ls, 'larva_minadora_broto', 'pomar-adulto');
  assert.equal(a.textoVigente, '30%');
  assert.equal(a.textoFicha, '40%');
  assert.equal(a.origem, 'ajuste');
  assert.equal(linha(ls, 'larva_minadora_broto', 'pomar-novo').origem, 'ficha');
});

test('ler limite: % de 0 a 100 vira fração, plantas são inteiras de 1 a 30', () => {
  assert.equal(lerLimite('percent_plantas', '40'), 0.4);
  assert.equal(lerLimite('percent_plantas', '12,5'), 0.125);
  assert.equal(lerLimite('percent_plantas', '100'), 1);
  assert.equal(lerLimite('plantas_positivas', '3'), 3);
  for (const ruim of ['', '0', '-5', '101', 'abc', '1e2x']) assert.throws(() => lerLimite('percent_plantas', ruim), undefined, ruim);
  for (const ruim of ['0', '31', '2,5', 'x', '']) assert.throws(() => lerLimite('plantas_positivas', ruim), undefined, ruim);
  assert.throws(() => lerLimite('contagem_armadilha', '5'), /não pode ser ajustado/);
  assert.equal(metricaAjustavel('percent_plantas'), true);
  assert.equal(metricaAjustavel('contagem_armadilha'), false);
});

test('ajuste montado como as regras exigem (sem vigenteDe e criadoPor, que o repositório carimba)', () => {
  assert.deepEqual(montarAjuste({ ficha, itemId: 'larva_minadora_broto', nivelId: 'pomar-adulto', entrada: '30', motivo: '  safra seca ' }), {
    culturaId: 'limao-tahiti', itemId: 'larva_minadora_broto', nivelId: 'pomar-adulto', limite: 0.3, motivo: 'safra seca',
  });
  assert.equal('motivo' in montarAjuste({ ficha, itemId: 'larva_minadora_broto', nivelId: 'pomar-novo', entrada: '8' }), false);
  assert.throws(() => montarAjuste({ ficha, itemId: 'nao-existe', nivelId: 'padrao', entrada: '5' }), /não encontrado/);
  assert.throws(() => montarAjuste({ ficha, itemId: 'larva_minadora_broto', nivelId: 'nao-existe', entrada: '5' }), /não encontrado/);
  assert.throws(() => montarAjuste({ ficha, itemId: 'larva_minadora_broto', nivelId: 'pomar-novo', entrada: '5', motivo: 'x'.repeat(501) }), /Motivo/);
});

test('o ajuste montado muda o que o motor decide, sem alterar a ficha', () => {
  const plantas = Array.from({ length: 30 }, (_, i) => ({ n: i + 1, obs: { larva_minadora_broto: { A: i < 6 ? 1 : 0, B: 0 } } })); // 20%
  const base = avaliar({ ficha, plantas, atributos: { tipoPomar: 'adulto' } });
  assert.deepEqual(base.decisao.tds, ['TD1']);
  const aj = { ...montarAjuste({ ficha, itemId: 'larva_minadora_broto', nivelId: 'pomar-adulto', entrada: '15' }), vigenteDe: 1000 };
  const depois = avaliar({ ficha, plantas, atributos: { tipoPomar: 'adulto' }, ajustes: [aj] });
  assert.deepEqual(depois.decisao.tds, ['TD3']);
  assert.equal(ficha.regras.find((r) => r.itemId === 'larva_minadora_broto').niveis[0].limite, 0.4); // ficha intacta
});

test('limite pendente resolvido por ajuste deixa de ser REVISAR', () => {
  const plantas = Array.from({ length: 30 }, (_, i) => ({ n: i + 1, obs: { ferrugem_bgude: { A: i < 9 ? 1 : 0, B: 0 } } })); // 30%
  assert.ok(avaliar({ ficha, plantas, atributos: { tipoPomar: 'adulto' } }).decisao.tds.includes('REVISAR'));
  const aj = { ...montarAjuste({ ficha, itemId: 'ferrugem_bgude', nivelId: 'padrao', entrada: '10' }), vigenteDe: 1000 };
  const r = avaliar({ ficha, plantas, atributos: { tipoPomar: 'adulto' }, ajustes: [aj] });
  assert.ok(r.decisao.tds.includes('TD2'));
});

test('histórico do nível: mais novo primeiro', () => {
  const aj = [
    { itemId: 'a', nivelId: 'n', limite: 0.1, vigenteDe: 100 },
    { itemId: 'a', nivelId: 'n', limite: 0.2, vigenteDe: 300 },
    { itemId: 'a', nivelId: 'outro', limite: 0.9, vigenteDe: 200 },
    { itemId: 'b', nivelId: 'n', limite: 0.9, vigenteDe: 200 },
  ];
  assert.deepEqual(historicoDoNivel(aj, 'a', 'n').map((x) => x.limite), [0.2, 0.1]);
});
