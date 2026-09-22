import { test } from 'node:test';
import assert from 'node:assert/strict';
import { csvDaSemana, nomeDoArquivo } from '../src/gestao/exportar-semana.js';

const linha = (extra) => ({ talhaoNome: 'Talhão 01', pragueiro: 'Paulo', dataTexto: '22/09/2026', status: 'finalizada', decisaoStatus: null, tds: [], ...extra });

test('CSV: cabeçalho e uma linha por avaliação, separado por ";"', () => {
  const csv = csvDaSemana([linha({ decisaoStatus: 'aprovada', tds: ['TD3'] })]);
  const [cab, l1] = csv.split('\r\n');
  assert.equal(cab, 'Talhão;Pragueiro;Data da inspeção;Situação;Tomadas de decisão');
  assert.equal(l1, 'Talhão 01;Paulo;22/09/2026;Aprovada;TD3');
});

test('situação sem decisão ainda: rascunho é "Em andamento", finalizada sem decisão é "Aguardando decisão"', () => {
  assert.match(csvDaSemana([linha({ status: 'rascunho' })]), /Em andamento/);
  assert.match(csvDaSemana([linha({ status: 'finalizada', decisaoStatus: null })]), /Aguardando decisão/);
  assert.match(csvDaSemana([linha({ decisaoStatus: 'rejeitada' })]), /Rejeitada/);
  assert.match(csvDaSemana([linha({ decisaoStatus: 'executada' })]), /Executada/);
});

test('mais de um TD aparece separado por espaço', () => {
  assert.match(csvDaSemana([linha({ tds: ['TD2', 'TD5'] })]), /TD2 TD5/);
});

test('CSV escapa campo com ";", aspas ou quebra de linha', () => {
  const csv = csvDaSemana([linha({ talhaoNome: 'Talhão; dos fundos' }), linha({ pragueiro: 'Ana "apelido" Silva' }), linha({ talhaoNome: 'Com\nquebra' })]);
  assert.match(csv, /"Talhão; dos fundos"/);
  assert.match(csv, /"Ana ""apelido"" Silva"/);
  assert.match(csv, /"Com\nquebra"/);
});

test('lista vazia: só o cabeçalho', () => {
  assert.equal(csvDaSemana([]), 'Talhão;Pragueiro;Data da inspeção;Situação;Tomadas de decisão');
});

test('nome do arquivo inclui a semana', () => {
  assert.equal(nomeDoArquivo('2026-W39'), 'acompanhamento-2026-W39.csv');
});
