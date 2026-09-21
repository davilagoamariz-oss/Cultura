import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { semanaISO, semanaAnterior, semanaSeguinte, intervaloDaSemana, rotuloDaSemana } from '../src/campo/semana.js';
import {
  montarDecisao, dadosExecucao, tdsDaFicha, tdsSugeridos, situacaoDaDecisao, prazoDeAplicacao, MAX_OBSERVACAO,
} from '../src/gestao/decisao.js';

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));
const av = { id: 't-01_2026-W39_u9', status: 'finalizada', talhaoId: 't-01', unidadeId: 'un-1', setorId: 'fit-1' };
const base = { ficha, avaliacao: av, uid: 'agro1', status: 'aprovada', tds: ['TD3'], decididoEm: 'CARIMBO' };

// ---------------------------------------------------------------- semanas

test('semana anterior e seguinte, inclusive na virada de ano e nas semanas 53', () => {
  assert.equal(semanaAnterior('2026-W39'), '2026-W38');
  assert.equal(semanaSeguinte('2026-W38'), '2026-W39');
  assert.equal(semanaAnterior('2026-W01'), '2025-W52');
  assert.equal(semanaSeguinte('2025-W52'), '2026-W01');
  assert.equal(semanaSeguinte('2026-W52'), '2026-W53'); // 2026 tem 53 semanas
  assert.equal(semanaSeguinte('2026-W53'), '2027-W01');
  assert.equal(semanaAnterior('2027-W01'), '2026-W53');
  assert.equal(semanaAnterior('2021-W01'), '2020-W53');
});

test('ida e volta: anterior de seguinte é a mesma semana, em vários pontos do calendário', () => {
  for (const s of ['2024-W01', '2024-W26', '2025-W52', '2026-W01', '2026-W27', '2026-W53', '2027-W01']) {
    assert.equal(semanaAnterior(semanaSeguinte(s)), s, s);
    assert.equal(semanaSeguinte(semanaAnterior(s)), s, s);
  }
});

test('intervalo da semana: segunda a domingo, coerente com a semana ISO', () => {
  assert.deepEqual(intervaloDaSemana('2026-W39'), { inicio: '2026-09-21', fim: '2026-09-27' });
  assert.deepEqual(intervaloDaSemana('2026-W01'), { inicio: '2025-12-29', fim: '2026-01-04' }); // começa no ano anterior
  assert.deepEqual(intervaloDaSemana('2026-W53'), { inicio: '2026-12-28', fim: '2027-01-03' });
  // todo dia do intervalo pertence à semana
  const { inicio, fim } = intervaloDaSemana('2026-W39');
  for (let d = new Date(2026, 8, 21); d <= new Date(2026, 8, 27); d.setDate(d.getDate() + 1)) assert.equal(semanaISO(d), '2026-W39');
  assert.equal(inicio < fim, true);
});

test('rótulo da semana e semana inválida', () => {
  assert.equal(rotuloDaSemana('2026-W39'), '21/09 a 27/09/2026');
  assert.equal(rotuloDaSemana('2026-W01'), '29/12/2025 a 04/01/2026');
  for (const ruim of ['2026-39', '2026-W00', '2026-W54', 'W39', '', undefined]) assert.throws(() => semanaAnterior(ruim), /inválida/, String(ruim));
});

// ---------------------------------------------------------------- decisão

test('decisão aprovada: exatamente os campos que as regras aceitam', () => {
  const d = montarDecisao({ ...base, tds: ['TD3', 'TD3', 'TD2'], observacao: '  aplicar amanhã cedo ', motivos: [{ id: 'tripes_flor', nome: 'Tripes', ni: 0.23, limite: 0.2, td: 'TD3', nivel: 'padrao' }] });
  assert.deepEqual(d, {
    avaliacaoId: 't-01_2026-W39_u9', talhaoId: 't-01', unidadeId: 'un-1', setorId: 'fit-1', tds: ['TD3', 'TD2'],
    motivos: [{ id: 'tripes_flor', nivel: 'padrao', td: 'TD3' }], status: 'aprovada', decididoPor: 'agro1', decididoEm: 'CARIMBO',
    observacao: 'aplicar amanhã cedo',
  });
  assert.equal('observacao' in montarDecisao({ ...base }), false);
  assert.deepEqual(Object.keys(montarDecisao({ ...base })).sort(), ['avaliacaoId', 'decididoEm', 'decididoPor', 'motivos', 'setorId', 'status', 'talhaoId', 'tds', 'unidadeId']);
});

test('só se decide avaliação finalizada', () => {
  assert.throws(() => montarDecisao({ ...base, avaliacao: { ...av, status: 'rascunho' } }), /finalizada/);
  assert.throws(() => montarDecisao({ ...base, avaliacao: undefined }), /finalizada/);
});

test('tomadas de decisão: ao menos uma, só as da ficha, e "não pulverizar" não combina', () => {
  assert.deepEqual(tdsDaFicha(ficha), ['TD1', 'TD2', 'TD3', 'TD4', 'TD5', 'TD6']);
  assert.throws(() => montarDecisao({ ...base, tds: [] }), /ao menos uma/);
  assert.throws(() => montarDecisao({ ...base, tds: ['REVISAR'] }), /desconhecida/); // REVISAR não é uma decisão
  assert.throws(() => montarDecisao({ ...base, tds: ['TD9'] }), /desconhecida/);
  assert.throws(() => montarDecisao({ ...base, tds: ['TD1', 'TD3'] }), /não combina/);
  assert.deepEqual(montarDecisao({ ...base, tds: ['TD1'] }).tds, ['TD1']);
  assert.deepEqual(montarDecisao({ ...base, tds: ['TD2', 'TD5', 'TD6'] }).tds, ['TD2', 'TD5', 'TD6']);
});

test('status inválido; rejeitar exige explicação', () => {
  assert.throws(() => montarDecisao({ ...base, status: 'executada' }), /aprovar ou rejeitar/);
  assert.throws(() => montarDecisao({ ...base, status: undefined }), /aprovar ou rejeitar/);
  assert.throws(() => montarDecisao({ ...base, status: 'rejeitada' }), /explique o motivo/);
  assert.throws(() => montarDecisao({ ...base, status: 'rejeitada', observacao: 'não' }), /explique o motivo/);
  const r = montarDecisao({ ...base, status: 'rejeitada', tds: ['TD3'], observacao: 'aguardar a próxima semana' });
  assert.equal(r.status, 'rejeitada');
  assert.deepEqual(r.tds, ['TD3']); // fica o registro do que o cálculo sugeria
  assert.throws(() => montarDecisao({ ...base, observacao: 'x'.repeat(MAX_OBSERVACAO + 1) }), /observação/);
});

test('sugestão: o REVISAR não vira decisão, então o agrônomo tem que escolher', () => {
  assert.deepEqual(tdsSugeridos({ tds: [{ codigo: 'REVISAR' }] }), []);
  assert.deepEqual(tdsSugeridos({ tds: [{ codigo: 'TD2' }, { codigo: 'TD4' }] }), ['TD2', 'TD4']);
  assert.deepEqual(tdsSugeridos({ tds: [{ codigo: 'TD1' }] }), ['TD1']);
});

// ---------------------------------------------------------------- execução e situação

test('execução: só os campos que o gerente pode gravar', () => {
  assert.deepEqual(dadosExecucao({ uid: 'ger1', executadoEm: 'T' }), { status: 'executada', executadoPor: 'ger1', executadoEm: 'T' });
  assert.deepEqual(dadosExecucao({ uid: 'ger1', executadoEm: 'T', observacao: ' feito às 6h ' }), { status: 'executada', executadoPor: 'ger1', executadoEm: 'T', observacaoExecucao: 'feito às 6h' });
  assert.throws(() => dadosExecucao({ uid: 'g', executadoEm: 'T', observacao: 'x'.repeat(1001) }), /observação/);
});

test('situação da decisão: o que cada pessoa pode fazer em cada momento', () => {
  const fim = { status: 'finalizada' };
  assert.deepEqual(situacaoDaDecisao({ avaliacao: null }), { fase: 'carregando' });
  assert.deepEqual(situacaoDaDecisao({ avaliacao: { status: 'rascunho' } }), { fase: 'em_andamento' });
  assert.deepEqual(situacaoDaDecisao({ avaliacao: fim, decisao: null, podeDecidir: true }), { fase: 'aguardando_decisao', podeDecidir: true });
  assert.deepEqual(situacaoDaDecisao({ avaliacao: fim, decisao: null, podeDecidir: false }), { fase: 'aguardando_decisao', podeDecidir: false });
  assert.deepEqual(situacaoDaDecisao({ avaliacao: fim, decisao: { status: 'aprovada' }, ehGerente: true }), { fase: 'aprovada', podeExecutar: true });
  assert.deepEqual(situacaoDaDecisao({ avaliacao: fim, decisao: { status: 'aprovada' }, ehGerente: false }), { fase: 'aprovada', podeExecutar: false });
  assert.deepEqual(situacaoDaDecisao({ avaliacao: fim, decisao: { status: 'rejeitada' } }), { fase: 'rejeitada' });
  assert.deepEqual(situacaoDaDecisao({ avaliacao: fim, decisao: { status: 'executada' } }), { fase: 'executada' });
});

// ---------------------------------------------------------------- prazo de 3 dias

test('prazo entre a inspeção e a aplicação: até 3 dias é normal; depois disso avisa', () => {
  const hoje = new Date(2026, 8, 25); // 25/09/2026
  assert.deepEqual(prazoDeAplicacao('2026-09-25', hoje), { dias: 0, atrasado: false, texto: 'Inspeção hoje (o recomendado é aplicar em até 3 dias).' });
  assert.equal(prazoDeAplicacao('2026-09-24', hoje).texto, 'Inspeção há 1 dia (o recomendado é aplicar em até 3 dias).');
  assert.equal(prazoDeAplicacao('2026-09-22', hoje).atrasado, false); // 3 dias: ainda no prazo
  const passou = prazoDeAplicacao('2026-09-21', hoje);
  assert.equal(passou.dias, 4);
  assert.equal(passou.atrasado, true);
  assert.match(passou.texto, /passou do prazo recomendado de 3 dias/);
});

test('prazo: não quebra com data no futuro, data inválida, virada de mês e horário tardio', () => {
  assert.equal(prazoDeAplicacao('2026-09-30', new Date(2026, 8, 25)).atrasado, false);
  assert.equal(prazoDeAplicacao('2026-09-30', new Date(2026, 8, 25)).dias, 0);
  assert.equal(prazoDeAplicacao('ontem', new Date()), null);
  assert.equal(prazoDeAplicacao(undefined, new Date()), null);
  assert.equal(prazoDeAplicacao('2026-08-30', new Date(2026, 8, 2)).dias, 3); // 30/08 -> 02/09
  // 23h59 do mesmo dia continua sendo "hoje" (conta dias do calendário, não horas)
  assert.equal(prazoDeAplicacao('2026-09-25', new Date(2026, 8, 25, 23, 59)).dias, 0);
});
