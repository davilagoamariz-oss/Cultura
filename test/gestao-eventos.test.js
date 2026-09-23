import { test } from 'node:test';
import assert from 'node:assert/strict';
import { montarEvento } from '../src/gestao/eventos.js';

test('evento mínimo: só uid e ação', () => {
  assert.deepEqual(montarEvento({ uid: 'u1', acao: 'decisao_criada' }), { uid: 'u1', acao: 'decisao_criada' });
});

test('evento completo: alvo, setor e detalhe entram; vazios não entram', () => {
  const e = montarEvento({ uid: 'u1', acao: 'vinculo_alterado', alvo: 'u2_fit-1', setorId: 'fit-1', detalhe: 'promovido a gerente' });
  assert.deepEqual(e, { uid: 'u1', acao: 'vinculo_alterado', alvo: 'u2_fit-1', setorId: 'fit-1', detalhe: 'promovido a gerente' });
  assert.deepEqual(montarEvento({ uid: 'u1', acao: 'x', alvo: '', setorId: '', detalhe: '' }), { uid: 'u1', acao: 'x' });
});

test('recusa sem uid ou sem ação', () => {
  assert.throws(() => montarEvento({ acao: 'x' }), /uid/);
  assert.throws(() => montarEvento({ uid: 'u1', acao: '' }), /ação/);
  assert.throws(() => montarEvento({ uid: 'u1' }), /ação/);
});

test('corta textos longos demais (mesmo limite das regras)', () => {
  const e = montarEvento({ uid: 'u1', acao: 'a'.repeat(100), alvo: 'b'.repeat(300), detalhe: 'c'.repeat(600) });
  assert.equal(e.acao.length, 40);
  assert.equal(e.alvo.length, 200);
  assert.equal(e.detalhe.length, 500);
});
