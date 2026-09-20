import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirSessao, veFazenda, escopoConsulta } from '../src/nucleo/vinculos.js';

const v = (empresaId, papel = 'pragueiro', ativo = true, fazendaIds = ['*']) => ({ empresaId, papel, ativo, fazendaIds });

test('um vínculo ativo: entra direto na empresa', () => {
  const r = decidirSessao({ vinculos: [v('A', 'agronomo')] });
  assert.equal(r.status, 'ok');
  assert.equal(r.empresaId, 'A');
  assert.equal(r.vinculo.papel, 'agronomo');
});

test('sem nenhum vínculo: sem_vinculo', () => {
  assert.equal(decidirSessao({ vinculos: [] }).status, 'sem_vinculo');
  assert.equal(decidirSessao({}).status, 'sem_vinculo');
});

test('só vínculos desativados: vinculo_inativo, sem acesso', () => {
  const r = decidirSessao({ vinculos: [v('A', 'pragueiro', false)] });
  assert.equal(r.status, 'vinculo_inativo');
  assert.equal(r.empresaId, null);
});

test('papel desconhecido não conta como vínculo ativo', () => {
  const r = decidirSessao({ vinculos: [v('A', 'root')] });
  assert.equal(r.status, 'vinculo_inativo');
});

test('ativo precisa ser exatamente true (não vale texto nem 1)', () => {
  assert.equal(decidirSessao({ vinculos: [{ empresaId: 'A', papel: 'gerente', ativo: 'true', fazendaIds: [] }] }).status, 'vinculo_inativo');
  assert.equal(decidirSessao({ vinculos: [{ empresaId: 'A', papel: 'gerente', ativo: 1, fazendaIds: [] }] }).status, 'vinculo_inativo');
});

test('várias empresas: pede a escolha, salvo se a última escolhida ainda for válida', () => {
  const vinculos = [v('A', 'agronomo'), v('B', 'agronomo')];
  assert.equal(decidirSessao({ vinculos }).status, 'escolher_empresa');
  assert.equal(decidirSessao({ vinculos, empresaSalva: 'B' }).empresaId, 'B');
  assert.equal(decidirSessao({ vinculos, empresaSalva: 'Z' }).status, 'escolher_empresa'); // empresa que ele não tem
});

test('empresa salva desativada não é reaproveitada', () => {
  const vinculos = [v('A', 'agronomo'), v('B', 'agronomo', false), v('C', 'agronomo')];
  const r = decidirSessao({ vinculos, empresaSalva: 'B' });
  assert.equal(r.status, 'escolher_empresa');
  assert.deepEqual(r.ativos.map((x) => x.empresaId), ['A', 'C']);
});

test('admin da plataforma sem empresa vai para a área da plataforma; com empresa, segue nela', () => {
  assert.equal(decidirSessao({ vinculos: [], ehPlataforma: true }).status, 'plataforma_apenas');
  const r = decidirSessao({ vinculos: [v('A', 'admin_empresa')], ehPlataforma: true });
  assert.equal(r.status, 'ok');
  assert.equal(r.empresaId, 'A');
});

test('veFazenda respeita o escopo e o curinga *', () => {
  assert.equal(veFazenda(v('A', 'gerente', true, ['f1']), 'f1'), true);
  assert.equal(veFazenda(v('A', 'gerente', true, ['f1']), 'f2'), false);
  assert.equal(veFazenda(v('A', 'agronomo', true, ['*']), 'qualquer'), true);
  assert.equal(veFazenda(null, 'f1'), false);
  assert.equal(veFazenda({ fazendaIds: 'f1' }, 'f1'), false); // não é lista
});

test('escopoConsulta: curinga consulta tudo; escopo específico vira blocos de até 30 ids', () => {
  assert.deepEqual(escopoConsulta(v('A', 'agronomo', true, ['*'])), { todas: true, blocos: [] });
  assert.deepEqual(escopoConsulta(v('A', 'gerente', true, ['f1', 'f2'])), { todas: false, blocos: [['f1', 'f2']] });
  assert.deepEqual(escopoConsulta(v('A', 'gerente', true, ['f1', 'f1'])), { todas: false, blocos: [['f1']] }); // sem repetição

  const muitas = Array.from({ length: 65 }, (_, i) => `f${i}`);
  const r = escopoConsulta(v('A', 'gerente', true, muitas));
  assert.deepEqual(r.blocos.map((b) => b.length), [30, 30, 5]);

  assert.deepEqual(escopoConsulta(null), { todas: false, blocos: [] });
  assert.deepEqual(escopoConsulta({ fazendaIds: 'f1' }), { todas: false, blocos: [] });
});
