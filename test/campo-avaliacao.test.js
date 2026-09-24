import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  montarCabecalho, dadosDaPlanta, progresso, plantasIncompletas, proximaIncompleta, dadosParaFinalizar,
  avisoDeAvaliacaoExistente, opcoesDeFase, totalDePlantas, plantasPendentes,
} from '../src/campo/avaliacao.js';
import { montarResumo, formatarPercentual, textoDoLimite } from '../src/campo/resumo.js';
import { agruparPorOrgao, definirGrupo, definirValor, definirItem, obsParaGravar } from '../src/campo/ficha-campo.js';
import { avaliar } from '../src/dominio/motor/index.js';

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));
const item = (id) => ficha.itens.find((i) => i.id === id);
const talhao = { unidadeId: 'un-1', nome: 'T', culturaId: 'limao-tahiti', atributos: { tipoPomar: 'adulto', citrosVizinhos: false }, ativo: true };
const base = { ficha, talhaoId: 't-01', talhao, setorId: 'fit-1', unidadeId: 'un-1', uid: 'u9', data: '2026-09-22', semana: '2026-W39', criadoEm: 'CARIMBO' };

const tudoAusente = () => agruparPorOrgao(ficha).reduce((o, g) => definirGrupo(o, g, 0), {});

// ---------------------------------------------------------------- cabeçalho

test('cabeçalho: id, ficha vigente e atributos do talhão, como as regras exigem', () => {
  const { id, dados } = montarCabecalho({ ...base, faseCultura: ['chumbinho', 'azeitona'] });
  assert.equal(id, 't-01_2026-W39_u9');
  assert.deepEqual(dados, {
    talhaoId: 't-01', unidadeId: 'un-1', setorId: 'fit-1', fichaId: 'limao-tahiti', fichaVersao: 1,
    atributosTalhao: { tipoPomar: 'adulto', citrosVizinhos: false }, responsavelUid: 'u9', data: '2026-09-22',
    semanaISO: '2026-W39', status: 'rascunho', faseCultura: ['chumbinho', 'azeitona'], criadoEm: 'CARIMBO',
  });
  assert.equal('finalizadaEm' in dados, false);
});

test('cabeçalho: recusa talhão inativo, de outra unidade ou de outra cultura, fase e data inválidas', () => {
  assert.throws(() => montarCabecalho({ ...base, talhao: { ...talhao, ativo: false } }), /inativo/);
  assert.throws(() => montarCabecalho({ ...base, talhao: undefined }), /inativo|inexistente/);
  assert.throws(() => montarCabecalho({ ...base, talhao: { ...talhao, unidadeId: 'un-2' } }), /unidade/);
  assert.throws(() => montarCabecalho({ ...base, talhao: { ...talhao, culturaId: 'manga' } }), /cultura/);
  assert.throws(() => montarCabecalho({ ...base, faseCultura: ['fase-inventada'] }), /fase/);
  assert.throws(() => montarCabecalho({ ...base, data: '22/09/2026' }), /data/);
  assert.throws(() => montarCabecalho({ ...base, talhaoId: 't_01' }), /talhaoId/); // "_" quebraria o id composto
  assert.deepEqual(montarCabecalho({ ...base, faseCultura: ['chumbinho', 'chumbinho'] }).dados.faseCultura, ['chumbinho']);
});

test('as fases da ficha viram opções simples', () => {
  const opcoes = opcoesDeFase(ficha);
  assert.equal(opcoes.length, 11);
  assert.deepEqual(opcoes[0], { id: 'crescimento_vegetativo', nome: 'Crescimento vegetativo', grupo: 'Crescimento' });
});

// ---------------------------------------------------------------- planta

test('planta: só grava o respondido; notas e fotos só quando existem', () => {
  const obs = definirItem({}, item('tripes_flor'), 1);
  const d = dadosDaPlanta({ ficha, n: 3, obs, notas: '  foco perto da cerca  ', fotos: [{ itemId: null, quadrante: null, caminho: 'local:abc' }], atualizadoEm: 'T' });
  assert.deepEqual(d, { n: 3, obs: { tripes_flor: { A: 1, B: 1, C: 1 } }, notas: 'foco perto da cerca', fotos: [{ itemId: null, quadrante: null, caminho: 'local:abc' }], atualizadoEm: 'T' });
  const vazia = dadosDaPlanta({ ficha, n: 1, obs: {}, notas: '   ', atualizadoEm: 'T' });
  assert.deepEqual(vazia, { n: 1, obs: {}, atualizadoEm: 'T' });
});

test('planta: fora de 1 a 30, notas ou fotos demais: recusa', () => {
  for (const n of [0, 31, 1.5, '2', undefined]) assert.throws(() => dadosDaPlanta({ ficha, n, obs: {}, atualizadoEm: 'T' }), /fora de/, String(n));
  assert.throws(() => dadosDaPlanta({ ficha, n: 1, obs: {}, notas: 'x'.repeat(1001), atualizadoEm: 'T' }), /notas/);
  assert.throws(() => dadosDaPlanta({ ficha, n: 1, obs: {}, fotos: Array(21).fill({ caminho: 'x' }), atualizadoEm: 'T' }), /fotos/);
  assert.equal(totalDePlantas(ficha), 30);
});

// ---------------------------------------------------------------- progresso

test('progresso: conta completas, parciais e vazias; só finaliza com todas completas', () => {
  const plantas = {};
  for (let n = 1; n <= 28; n += 1) plantas[n] = tudoAusente();
  plantas[29] = definirItem({}, item('tripes_flor'), 0); // parcial; a 30 nem começou
  const p = progresso(ficha, plantas);
  assert.deepEqual([p.completas, p.parciais, p.vazias, p.total], [28, 1, 1, 30]);
  assert.equal(p.podeFinalizar, false);
  assert.equal(p.porPlanta[29], 'parcial');
  assert.equal(p.porPlanta[30], 'vazia');

  plantas[29] = tudoAusente();
  plantas[30] = tudoAusente();
  assert.equal(progresso(ficha, plantas).podeFinalizar, true);
  assert.equal(progresso(ficha, {}).completas, 0);
});

test('plantas incompletas dizem quantos itens faltam; a próxima incompleta dá a volta', () => {
  const plantas = { 1: tudoAusente(), 2: definirItem({}, item('tripes_flor'), 0) };
  for (let n = 3; n <= 30; n += 1) plantas[n] = tudoAusente();
  const inc = plantasIncompletas(ficha, plantas);
  assert.deepEqual(inc.map((x) => x.n), [2]);
  assert.equal(inc[0].faltam, 29);
  assert.equal(inc[0].status, 'parcial');
  assert.equal(proximaIncompleta(ficha, plantas, 5), 2); // dá a volta
  assert.equal(proximaIncompleta(ficha, plantas, 1), 2);
  for (let n = 1; n <= 30; n += 1) plantas[n] = tudoAusente();
  assert.equal(proximaIncompleta(ficha, plantas, 1), null);
});

// ---------------------------------------------------------------- finalização e duplicada

test('finalizar: só campos permitidos; armadilha é informativa e validada', () => {
  assert.deepEqual(dadosParaFinalizar({ finalizadaEm: 'F' }), { status: 'finalizada', finalizadaEm: 'F' });
  assert.deepEqual(
    dadosParaFinalizar({ notas: ' ok ', outrasPragas: 'broca no talhão vizinho', adultosArmadilha: '4', finalizadaEm: 'F' }),
    { status: 'finalizada', finalizadaEm: 'F', notas: 'ok', outrasPragas: 'broca no talhão vizinho', armadilha: { adultos: 4 } },
  );
  for (const ruim of [-1, 1.5, 'muitos', 1001]) assert.throws(() => dadosParaFinalizar({ adultosArmadilha: ruim, finalizadaEm: 'F' }), /armadilha/, String(ruim));
  assert.equal('armadilha' in dadosParaFinalizar({ adultosArmadilha: '', finalizadaEm: 'F' }), false);
  assert.throws(() => dadosParaFinalizar({ notas: 'x'.repeat(2001), finalizadaEm: 'F' }), /notas/);
  assert.equal(dadosParaFinalizar({ resumoCor: 'laranja', finalizadaEm: 'F' }).resumoCor, 'laranja');
  assert.equal('resumoCor' in dadosParaFinalizar({ finalizadaEm: 'F' }), false); // opcional
  assert.throws(() => dadosParaFinalizar({ resumoCor: 'roxo', finalizadaEm: 'F' }), /resumoCor/);
});

test('aviso de avaliação já existente na semana', () => {
  assert.deepEqual(avisoDeAvaliacaoExistente(null), { tipo: 'nenhuma' });
  assert.equal(avisoDeAvaliacaoExistente({ status: 'rascunho' }).tipo, 'continuar');
  assert.match(avisoDeAvaliacaoExistente({ status: 'rascunho' }).texto, /em andamento/);
  assert.equal(avisoDeAvaliacaoExistente({ status: 'finalizada' }).tipo, 'finalizada');
  assert.match(avisoDeAvaliacaoExistente({ status: 'finalizada' }).texto, /não pode ser refeita/);
});

// ---------------------------------------------------------------- resumo

function plantasDoCenario({ tripes = 0, ferrugem = 0, joaninha = 0 } = {}) {
  return Array.from({ length: 30 }, (_, i) => {
    let obs = tudoAusente();
    if (i < tripes) obs = definirValor(obs, item('tripes_flor'), 'A', 2);
    if (i < ferrugem) obs = definirValor(obs, item('ferrugem_bgude'), 'A', 1);
    if (i < joaninha) obs = definirValor(obs, item('joaninha'), 'A', 1);
    return { n: i + 1, obs: obsParaGravar(ficha, obs) };
  });
}
const resumoDe = (cenario) => montarResumo(avaliar({ ficha, plantas: plantasDoCenario(cenario), atributos: talhao.atributos }), ficha);

test('resumo: nível de ação atingido aparece primeiro, com NI, limite e TD', () => {
  const r = resumoDe({ tripes: 7, ferrugem: 4, joaninha: 5 });
  assert.equal(r.manchete.tipo, 'acao');
  assert.deepEqual(r.tds, [{ codigo: 'TD3', texto: 'Pulverizar com inseticida' }]);
  assert.equal(r.precisaAplicacao, true);
  assert.match(r.avisoSeletivo, /produto seletivo/);
  assert.equal(r.secoes[0].chave, 'acao');
  const tripes = r.secoes[0].itens[0];
  assert.deepEqual([tripes.id, tripes.niTexto, tripes.limiteTexto, tripes.td, tripes.positivas, tripes.avaliadas], ['tripes_flor', '23,3%', '> 20,0%', 'TD3', 7, 30]);
  assert.equal(tripes.cor.cor, 'laranja'); // 23,3% / 20% ≈ 1,17x o limite: atingiu, mas não em dobro
  const joaninha = r.secoes.find((s) => s.chave === 'informativo').itens.find((i) => i.id === 'joaninha');
  assert.deepEqual(joaninha.cor, { cor: 'informativo', rotulo: 'Presente' }); // inimigo natural nunca é "ruim"
  assert.equal(r.piorCor, 'laranja'); // pior entre os itens: laranja vence (a joaninha é só informativa)
  assert.equal(r.revisar[0].id, 'ferrugem_bgude'); // detectada sem limite
  // só a ferrugem (detectada) pede revisão; os outros itens pendentes, sem detecção, ficam à parte
  assert.deepEqual(r.secoes.find((s) => s.chave === 'limite_nao_definido').itens.map((i) => i.id), ['ferrugem_bgude']);
  assert.equal(r.secoes.find((s) => s.chave === 'sem_limite_nada').itens.some((i) => i.id === 'ferrugem_bgude'), false);
});

test('resumo: só REVISAR deixa claro que NÃO é "não pulverizar"', () => {
  const r = resumoDe({ ferrugem: 4 });
  assert.equal(r.manchete.tipo, 'revisar');
  assert.match(r.manchete.texto, /NÃO significa "não pulverizar"/);
  assert.deepEqual(r.tds.map((t) => t.codigo), ['REVISAR']);
  assert.equal(r.precisaAplicacao, false);
  assert.equal(r.piorCor, 'revisar');
});

test('resumo: nada atingido e nada pendente é TD1; itens sem praga não viram REVISAR', () => {
  const r = resumoDe({});
  assert.equal(r.piorCor, 'verde');
  assert.equal(r.manchete.tipo, 'nenhuma_acao');
  assert.deepEqual(r.tds, [{ codigo: 'TD1', texto: 'Não pulverizar' }]);
  assert.equal(r.revisar.length, 0);
  assert.equal(r.secoes.some((s) => s.chave === 'acao'), false);
  // itens com limite pendente e SEM praga não pedem revisão: ficam numa seção discreta e não bloqueiam o TD1
  assert.equal(r.secoes.some((s) => s.chave === 'limite_nao_definido'), false);
  const discreta = r.secoes.find((s) => s.chave === 'sem_limite_nada');
  assert.ok(discreta.itens.length >= 15);
  assert.equal(discreta.itens.every((i) => i.ni === 0), true);
});

test('resumo: formatação em português e textos de limite', () => {
  assert.equal(formatarPercentual(0.2333), '23,3%');
  assert.equal(formatarPercentual(0), '0,0%');
  assert.equal(formatarPercentual(1), '100,0%');
  assert.equal(formatarPercentual(null), '—');
  assert.equal(textoDoLimite({ limite: 0.1, operador: '>=' }), '≥ 10,0%');
  assert.equal(textoDoLimite({ limite: 0.2, operador: '>' }), '> 20,0%');
  assert.equal(textoDoLimite({ limite: null }), 'sem limite definido');
  assert.equal(textoDoLimite(undefined), 'sem limite definido');
});

// ---------------------------------------------------------------- pendentes de envio

test('plantas pendentes: só as que ainda não foram confirmadas pelo servidor', () => {
  const porN = { 1: { pendente: true }, 2: { pendente: false }, 3: { pendente: true }, 4: {} };
  assert.deepEqual(plantasPendentes(porN), { 1: true, 3: true });
  assert.deepEqual(plantasPendentes({}), {});
  assert.deepEqual(plantasPendentes(undefined), {});
});
