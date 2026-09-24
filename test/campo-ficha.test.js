import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { semanaISO, dataISO } from '../src/campo/semana.js';
import {
  agruparPorOrgao, quadrantesDoItem, proximoValor, definirValor, definirItem, definirGrupo, itemCompleto,
  itensPendentes, statusDaPlanta, obsParaGravar, pendenciasPorGrupo, grupoCompleto, copiarObs, VALORES, LADO_UNICO,
} from '../src/campo/ficha-campo.js';
import { avaliar } from '../src/dominio/motor/index.js';

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));
const item = (id) => ficha.itens.find((i) => i.id === id);

// ---------------------------------------------------------------- semana ISO

test('semana ISO: casos conhecidos, inclusive a virada de ano', () => {
  const s = (a, m, d) => semanaISO(new Date(a, m - 1, d));
  assert.equal(s(2026, 9, 15), '2026-W38'); // a data usada nos dados de demonstração
  assert.equal(s(2026, 1, 1), '2026-W01'); // quinta-feira
  assert.equal(s(2027, 1, 1), '2026-W53'); // sexta: ainda é a última semana de 2026
  assert.equal(s(2024, 12, 30), '2025-W01'); // segunda: já é a primeira semana de 2025
  assert.equal(s(2021, 1, 3), '2020-W53'); // domingo
  assert.equal(s(2026, 9, 21), '2026-W39'); // segunda-feira começa a semana
  assert.equal(s(2026, 9, 20), '2026-W38'); // domingo fecha a semana
  assert.match(semanaISO(), /^\d{4}-W\d{2}$/); // o formato que as regras exigem
});

test('data ISO usa o calendário local (não o UTC)', () => {
  assert.equal(dataISO(new Date(2026, 8, 5)), '2026-09-05');
  assert.equal(dataISO(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  assert.equal(dataISO(new Date(2026, 0, 1, 0, 1)), '2026-01-01');
});

// ---------------------------------------------------------------- agrupamento

test('a tela é gerada da ficha: 6 órgãos, 30 itens, na ordem da ficha', () => {
  const grupos = agruparPorOrgao(ficha);
  assert.deepEqual(grupos.map((g) => g.orgao), ['fruto', 'folha', 'broto', 'flor', 'tronco', 'planta']);
  assert.deepEqual(grupos.map((g) => g.itens.length), [11, 6, 1, 3, 4, 5]);
  assert.equal(grupos.reduce((n, g) => n + g.itens.length, 0), 30);
  assert.equal(grupos[5].rotulo, 'Planta inteira');
});

test('órgão sem item não aparece; ficha de outra cultura gera outra tela', () => {
  const outra = { orgaos: ['fruto', 'folha'], itens: [{ id: 'x', orgao: 'fruto', tipo: 'presenca_quadrante', nome: 'X' }] };
  assert.deepEqual(agruparPorOrgao(outra).map((g) => g.orgao), ['fruto']);
});

// ---------------------------------------------------------------- quadrantes e valores

test('quadrantes: A, B e C (copa em 3 setores, Manual Embrapa p.11), exceto o lado único (bicho-furão)', () => {
  assert.deepEqual(quadrantesDoItem(item('tripes_flor')), ['A', 'B', 'C']);
  assert.deepEqual(quadrantesDoItem(item('bicho_furao')), [LADO_UNICO]);
  assert.equal(LADO_UNICO, 'B');
});

test('o toque cicla 0 → 1 → 2 → 3 → 0; vazio e "-" vão para 0 (ausente)', () => {
  assert.deepEqual([undefined, null, 0, 1, 2, 3].map(proximoValor), [0, 0, 1, 2, 3, 0]);
  assert.deepEqual(VALORES, [null, 0, 1, 2, 3]);
});

test('definirValor não altera o original e recusa quadrante ou valor inválido', () => {
  const obs = {};
  const novo = definirValor(obs, item('tripes_flor'), 'A', 2);
  assert.deepEqual(obs, {});
  assert.deepEqual(novo, { tripes_flor: { A: 2 } });
  assert.throws(() => definirValor(obs, item('bicho_furao'), 'A', 1), /não vale/);
  assert.throws(() => definirValor(obs, item('tripes_flor'), 'A', 4), /inválido/);
  assert.throws(() => definirValor(obs, item('tripes_flor'), 'A', '1'), /inválido/);
  assert.throws(() => definirValor(obs, item('tripes_flor'), 'D', 1));
});

test('ações em bloco: "tudo ausente" e "sem o órgão" (não avaliável) por grupo', () => {
  const fruto = agruparPorOrgao(ficha)[0];
  const ausentes = definirGrupo({}, fruto, 0);
  assert.equal(Object.keys(ausentes).length, 11);
  assert.deepEqual(ausentes.tripes_flor, undefined);
  assert.deepEqual(ausentes.ferrugem_bgude, { A: 0, B: 0, C: 0 });
  assert.deepEqual(ausentes.bicho_furao, { B: 0 }); // lado único: só B
  assert.equal(grupoCompleto(fruto, ausentes), true);

  const semFruto = definirGrupo({}, fruto, null);
  assert.deepEqual(semFruto.ferrugem_bgude, { A: null, B: null, C: null });
  assert.equal(grupoCompleto(fruto, semFruto), true); // "não avaliável" é uma resposta
  assert.equal(definirItem({}, item('tripes_flor'), 1).tripes_flor.B, 1);
});

// ---------------------------------------------------------------- completude

test('planta: vazia, parcial e completa; null conta como respondido, undefined não', () => {
  assert.equal(statusDaPlanta(ficha, {}), 'vazia');
  assert.equal(itensPendentes(ficha, {}).length, 30);

  let obs = definirItem({}, item('tripes_flor'), 0);
  assert.equal(statusDaPlanta(ficha, obs), 'parcial');
  assert.equal(itemCompleto(item('tripes_flor'), obs.tripes_flor), true);
  obs = definirValor({}, item('tripes_flor'), 'A', 1); // só um quadrante
  assert.equal(itemCompleto(item('tripes_flor'), obs.tripes_flor), false);

  let todos = {};
  for (const g of agruparPorOrgao(ficha)) todos = definirGrupo(todos, g, 0);
  assert.equal(statusDaPlanta(ficha, todos), 'completa');
  assert.equal(itensPendentes(ficha, todos).length, 0);
});

test('pendências por órgão dizem onde falta responder', () => {
  const fruto = agruparPorOrgao(ficha)[0];
  const obs = definirGrupo({}, fruto, 0);
  const p = pendenciasPorGrupo(ficha, obs);
  assert.deepEqual(p.map((g) => g.orgao), ['folha', 'broto', 'flor', 'tronco', 'planta']);
  assert.equal(p.find((g) => g.orgao === 'flor').pendentes.length, 3);
});

// ---------------------------------------------------------------- gravação

test('obsParaGravar: sem undefined, valores conferidos e os lados não usados do lado único fixados em null', () => {
  const obs = { tripes_flor: { A: 1, B: undefined }, ferrugem_bgude: { A: null, B: 0 }, bicho_furao: { B: 2 }, joaninha: {} };
  const g = obsParaGravar(ficha, obs);
  assert.deepEqual(g.tripes_flor, { A: 1 });
  assert.deepEqual(g.ferrugem_bgude, { A: null, B: 0 });
  assert.deepEqual(g.bicho_furao, { A: null, B: 2, C: null }); // só B é o lado da armadilha; A e C não se aplicam
  assert.equal('joaninha' in g, false);
  assert.equal(JSON.stringify(g).includes('undefined'), false);
  assert.throws(() => obsParaGravar(ficha, { tripes_flor: { A: 7 } }), /inválido/);
  assert.throws(() => obsParaGravar(ficha, { tripes_flor: { A: '1' } }), /inválido/);
  assert.deepEqual(obsParaGravar(ficha, {}), {});
  assert.deepEqual(obsParaGravar(ficha, undefined), {});
});

test('o que a tela grava é exatamente o que o motor lê (A ou B positivo conta a planta uma vez)', () => {
  // 30 plantas: tripes com intensidade 2 em A nas 7 primeiras; bicho-furão só no lado da armadilha
  const plantas = Array.from({ length: 30 }, (_, i) => {
    let obs = {};
    for (const g of agruparPorOrgao(ficha)) obs = definirGrupo(obs, g, 0);
    if (i < 7) obs = definirValor(obs, item('tripes_flor'), 'A', 2);
    if (i < 3) obs = definirValor(obs, item('bicho_furao'), 'B', 1);
    return { n: i + 1, obs: obsParaGravar(ficha, obs) };
  });
  const r = avaliar({ ficha, plantas, atributos: { tipoPomar: 'adulto' } });
  const tripes = r.resultados.find((x) => x.id === 'tripes_flor');
  assert.equal(tripes.avaliadas, 30);
  assert.equal(tripes.positivas, 7);
  assert.equal(tripes.status, 'acao');
  assert.deepEqual(r.decisao.tds, ['TD3']);
  const furao = r.resultados.find((x) => x.id === 'bicho_furao');
  assert.equal(furao.positivas, 3);
  assert.equal(r.decisao.revisarManual.some((x) => x.id === 'bicho_furao'), true); // limite pendente: REVISAR
});

test('"sem o órgão" (null) fica fora da conta: NI usa só as plantas avaliadas', () => {
  const plantas = Array.from({ length: 30 }, (_, i) => {
    let obs = {};
    for (const g of agruparPorOrgao(ficha)) obs = definirGrupo(obs, g, 0);
    if (i >= 20) obs = definirItem(obs, item('acaro_branco_azeitona'), null); // 10 plantas sem fruto azeitona
    else if (i < 4) obs = definirItem(obs, item('acaro_branco_azeitona'), 1);
    return { n: i + 1, obs: obsParaGravar(ficha, obs) };
  });
  const r = avaliar({ ficha, plantas, atributos: { tipoPomar: 'adulto' } }).resultados.find((x) => x.id === 'acaro_branco_azeitona');
  assert.equal(r.avaliadas, 20);
  assert.equal(r.positivas, 4);
  assert.equal(r.ni, 0.2);
});

// ---------------------------------------------------------------- copiar planta anterior

test('copiar planta anterior: reproduz as respostas, só com o que existe nesta ficha', () => {
  let origem = definirGrupo({}, agruparPorOrgao(ficha)[0], 0); // tudo ausente no primeiro órgão
  origem = definirValor(origem, item('tripes_flor'), 'A', 2);
  const copia = copiarObs(ficha, origem);
  assert.deepEqual(copia, origem);
  assert.notEqual(copia, origem); // é uma cópia nova, não a mesma referência
});

test('copiar planta anterior: ignora item que não existe mais na ficha e quadrante ainda não respondido', () => {
  const origem = { ...definirValor({}, item('tripes_flor'), 'A', 1), 'item-fantasma': { A: 3, B: 3 } };
  assert.deepEqual(copiarObs(ficha, origem), { tripes_flor: { A: 1 } }); // B do tripes ainda não respondido: não copia undefined
});

test('copiar planta anterior: origem vazia ou ausente vira obs vazio', () => {
  assert.deepEqual(copiarObs(ficha, {}), {});
  assert.deepEqual(copiarObs(ficha, undefined), {});
  assert.deepEqual(copiarObs(ficha, null), {});
});
