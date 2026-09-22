import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { lerCsv, prepararImportacaoDeTalhoes, validos, invalidos } from '../src/admin/importar-talhoes.js';

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));

// ---------------------------------------------------------------- CSV

test('lê CSV separado por vírgula ou por ponto e vírgula (Excel pt-BR)', () => {
  assert.deepEqual(lerCsv('nome,variedade\nTalhão 01,Tahiti'), [['nome', 'variedade'], ['Talhão 01', 'Tahiti']]);
  assert.deepEqual(lerCsv('nome;variedade\nTalhão 01;Tahiti'), [['nome', 'variedade'], ['Talhão 01', 'Tahiti']]);
});

test('CSV: aspas para campo com o separador dentro, linhas em branco ignoradas, BOM do Excel removido', () => {
  assert.deepEqual(lerCsv('nome;obs\n"Talhão, dos fundos";"5 ""boas"" plantas"\n\n'), [['nome', 'obs'], ['Talhão, dos fundos', '5 "boas" plantas']]);
  assert.deepEqual(lerCsv('﻿nome\nA')[0], ['nome']);
  assert.deepEqual(lerCsv(''), []);
  assert.deepEqual(lerCsv('   \n  \n'), []);
});

// ---------------------------------------------------------------- importação

const cabecalho = 'nome;variedade;areaha;tipoPomar;citrosVizinhos';
const csv = (linhas) => [cabecalho, ...linhas].join('\n');

test('linha válida vira os mesmos dados do cadastro manual, com id sem colidir', () => {
  const r = prepararImportacaoDeTalhoes({
    ficha, unidadeId: 'un-1', culturaId: 'limao-tahiti',
    texto: csv(['Talhão 01;Tahiti CPB;7,5;adulto;sim', 'Talhão 02;;;novo;não']),
  });
  assert.equal(r.length, 2);
  assert.deepEqual(validos(r).map((l) => l.id), ['talhao-01', 'talhao-02']);
  assert.deepEqual(r[0].dados, { unidadeId: 'un-1', nome: 'Talhão 01', culturaId: 'limao-tahiti', atributos: { tipoPomar: 'adulto', citrosVizinhos: true }, ativo: true, variedade: 'Tahiti CPB', areaHa: 7.5 });
  assert.deepEqual(r[1].dados.atributos, { tipoPomar: 'novo', citrosVizinhos: false });
  assert.equal('variedade' in r[1].dados, false);
  assert.equal('areaHa' in r[1].dados, false);
});

test('id não colide nem com o que já existe nem com outra linha do mesmo arquivo', () => {
  const r = prepararImportacaoDeTalhoes({
    ficha, unidadeId: 'un-1', culturaId: 'limao-tahiti',
    texto: csv(['Talhão 01;;;adulto;sim', 'Talhão 01;;;novo;sim']),
    existentes: ['talhao-01'],
  });
  assert.deepEqual(r.map((l) => l.id), ['talhao-01-2', 'talhao-01-3']);
});

test('linha inválida vem com o erro do cadastro manual, e não trava as outras linhas', () => {
  const r = prepararImportacaoDeTalhoes({
    ficha, unidadeId: 'un-1', culturaId: 'limao-tahiti',
    texto: csv(['Talhão 01;;;adulto;sim', ';;;adulto;sim', 'Talhão 03;;;;sim']),
  });
  assert.equal(validos(r).length, 1);
  assert.equal(invalidos(r).length, 2);
  assert.equal(invalidos(r)[0].numero, 3); // linha 3 da planilha (cabeçalho é a 1)
  assert.match(invalidos(r)[0].erro, /preencha/);
  assert.match(r[2].erro, /Tipo de pomar/);
});

test('cabeçalho fora de ordem e em maiúsculas funciona; coluna que falta vira campo vazio', () => {
  const texto = 'TIPOPOMAR;NOME;CITROSVIZINHOS\nadulto;Talhão X;sim';
  const r = prepararImportacaoDeTalhoes({ ficha, unidadeId: 'un-1', culturaId: 'limao-tahiti', texto });
  assert.equal(r[0].nome, 'Talhão X');
  assert.equal('areaHa' in r[0].dados, false);
});

test('arquivo vazio (só cabeçalho, ou nada) não dá nenhuma linha', () => {
  assert.deepEqual(prepararImportacaoDeTalhoes({ ficha, unidadeId: 'u', culturaId: 'limao-tahiti', texto: cabecalho }), []);
  assert.deepEqual(prepararImportacaoDeTalhoes({ ficha, unidadeId: 'u', culturaId: 'limao-tahiti', texto: '' }), []);
});
