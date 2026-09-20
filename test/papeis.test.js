import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAPEIS, papelValido, podeAcessar, rotaInicial } from '../src/nucleo/papeis.js';

test('só os quatro papéis por empresa das regras são válidos', () => {
  assert.deepEqual(PAPEIS, ['pragueiro', 'agronomo', 'gerente', 'admin_empresa']);
  assert.equal(papelValido('admin_empresa'), true);
  assert.equal(papelValido('admin'), false); // o antigo papel único não existe mais
  assert.equal(papelValido('gestor'), false);
  assert.equal(papelValido('plataforma'), false); // admin da plataforma não é papel de empresa
  assert.equal(papelValido(undefined), false);
});

test('cada papel começa na sua área', () => {
  assert.equal(rotaInicial('pragueiro'), '/campo');
  assert.equal(rotaInicial('agronomo'), '/gestao');
  assert.equal(rotaInicial('gerente'), '/gestao');
  assert.equal(rotaInicial('admin_empresa'), '/admin');
  assert.equal(rotaInicial('desconhecido'), '/sem-acesso');
});

test('as áreas seguem o que firestore.rules permite', () => {
  // Só o pragueiro grava avaliações: o campo é dele.
  assert.equal(podeAcessar('pragueiro', 'campo'), true);
  for (const papel of ['agronomo', 'gerente', 'admin_empresa']) assert.equal(podeAcessar(papel, 'campo'), false);

  for (const papel of ['agronomo', 'gerente', 'admin_empresa']) assert.equal(podeAcessar(papel, 'gestao'), true);
  assert.equal(podeAcessar('pragueiro', 'gestao'), false);

  assert.equal(podeAcessar('admin_empresa', 'admin'), true);
  for (const papel of ['pragueiro', 'agronomo', 'gerente']) assert.equal(podeAcessar(papel, 'admin'), false);

  assert.equal(podeAcessar('admin_empresa', 'inexistente'), false);
});
