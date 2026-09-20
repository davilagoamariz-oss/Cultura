import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PAPEIS, papelValido, podeAcessar, rotaInicial } from '../src/auth/papeis.js';

test('só os quatro papéis das regras são válidos', () => {
  assert.deepEqual(PAPEIS, ['pragueiro', 'gestor', 'agronomo', 'admin']);
  assert.equal(papelValido('admin'), true);
  assert.equal(papelValido('root'), false);
  assert.equal(papelValido(undefined), false);
});

test('cada papel começa na sua área', () => {
  assert.equal(rotaInicial('pragueiro'), '/campo');
  assert.equal(rotaInicial('gestor'), '/gestor');
  assert.equal(rotaInicial('agronomo'), '/gestor');
  assert.equal(rotaInicial('admin'), '/admin');
  assert.equal(rotaInicial('desconhecido'), '/sem-acesso');
});

test('as áreas seguem o que firestore.rules permite', () => {
  // Só o pragueiro grava avaliações: o campo é dele.
  assert.equal(podeAcessar('pragueiro', 'campo'), true);
  assert.equal(podeAcessar('admin', 'campo'), false);
  assert.equal(podeAcessar('gestor', 'campo'), false);

  assert.equal(podeAcessar('gestor', 'gestor'), true);
  assert.equal(podeAcessar('agronomo', 'gestor'), true);
  assert.equal(podeAcessar('admin', 'gestor'), true);
  assert.equal(podeAcessar('pragueiro', 'gestor'), false);

  assert.equal(podeAcessar('admin', 'admin'), true);
  assert.equal(podeAcessar('gestor', 'admin'), false);
  assert.equal(podeAcessar('pragueiro', 'admin'), false);

  assert.equal(podeAcessar('admin', 'inexistente'), false);
});
