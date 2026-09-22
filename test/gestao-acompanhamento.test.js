import { test } from 'node:test';
import assert from 'node:assert/strict';
import { grupoDaLinha, resumirSemana } from '../src/gestao/acompanhamento.js';

const linha = (status, decisaoStatus = null) => ({ status, decisaoStatus });

test('grupo da linha: não finalizada é "em andamento"; finalizada depende da decisão', () => {
  assert.equal(grupoDaLinha(linha('rascunho')), 'em_andamento');
  assert.equal(grupoDaLinha(linha('finalizada')), 'aguardando_decisao');
  assert.equal(grupoDaLinha(linha('finalizada', 'aprovada')), 'aprovada');
  assert.equal(grupoDaLinha(linha('finalizada', 'rejeitada')), 'concluida');
  assert.equal(grupoDaLinha(linha('finalizada', 'executada')), 'concluida');
});

test('resumo da semana: conta cada situação e o total', () => {
  const linhas = [linha('rascunho'), linha('finalizada'), linha('finalizada'), linha('finalizada', 'aprovada'), linha('finalizada', 'rejeitada')];
  assert.deepEqual(resumirSemana(linhas), { total: 5, em_andamento: 1, aguardando_decisao: 2, aprovada: 1, concluida: 1 });
});

test('resumo da semana vazia: tudo zero', () => {
  assert.deepEqual(resumirSemana([]), { total: 0, em_andamento: 0, aguardando_decisao: 0, aprovada: 0, concluida: 0 });
});
