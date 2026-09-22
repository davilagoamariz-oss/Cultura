import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caminhos, idAvaliacao, idVinculo, GRUPO_MEMBROS, GRUPO_VINCULOS } from '../src/nucleo/caminhos.js';

test('tudo o que é da empresa fica dentro de empresas/{id}', () => {
  const e = 'empresaA';
  const dentroDaEmpresa = [
    caminhos.empresa(e),
    caminhos.membros(e),
    caminhos.membro(e, 'u1'),
    caminhos.unidade(e, 'un1'),
    caminhos.setor(e, 'fit-a1'),
    caminhos.vinculo(e, 'u1', 'fit-a1'),
    caminhos.historicoVinculo(e, 'u1', 'fit-a1', 3),
    caminhos.historico(e, 'u1', 'fit-a1'),
    caminhos.safra(e, 's1'),
    caminhos.talhao(e, 't1'),
    caminhos.ajuste(e, 'aj1'),
    caminhos.maquina(e, 'm1'),
    caminhos.uso(e, 'm1', 'u1'),
    caminhos.manutencao(e, 'm1', 'mn1'),
    caminhos.avaliacoes(e),
    caminhos.avaliacao(e, 'a1'),
    caminhos.plantas(e, 'a1'),
    caminhos.planta(e, 'a1', 7),
    caminhos.decisao(e, 'a1'),
    caminhos.eventos(e),
  ];
  for (const c of dentroDaEmpresa) assert.deepEqual(c.slice(0, 2), ['empresas', e]);

  assert.deepEqual(caminhos.planta(e, 'a1', 30), ['empresas', e, 'avaliacoes', 'a1', 'plantas', '30']);
  assert.deepEqual(caminhos.historicoVinculo(e, 'u1', 'fit-a1', 3), ['empresas', e, 'vinculos', 'u1_fit-a1', 'historico', '3']);
  assert.deepEqual(caminhos.historico(e, 'u1', 'fit-a1'), ['empresas', e, 'vinculos', 'u1_fit-a1', 'historico']);
  assert.deepEqual(caminhos.uso(e, 'm1', 'u1'), ['empresas', e, 'maquinas', 'm1', 'usos', 'u1']);
  assert.deepEqual(caminhos.manutencao(e, 'm1', 'mn1'), ['empresas', e, 'maquinas', 'm1', 'manutencoes', 'mn1']);
  assert.equal(GRUPO_MEMBROS, 'membros');
  assert.equal(GRUPO_VINCULOS, 'vinculos');
});

test('catálogo fica fora das empresas e a ficha é uma versão por documento', () => {
  assert.deepEqual(caminhos.catalogoCultura('limao-tahiti'), ['catalogo_culturas', 'limao-tahiti']);
  assert.deepEqual(caminhos.catalogoAlvo('tripes'), ['catalogo_alvos', 'tripes']);
  assert.deepEqual(caminhos.catalogoFicha('limao-tahiti', 1), ['catalogo_fichas', 'limao-tahiti', 'versoes', '1']);
});

test('identificador com barra não escapa da empresa (path traversal)', () => {
  assert.throws(() => caminhos.empresa('empresaA/membros/u1'));
  assert.throws(() => caminhos.unidade('empresaA', '../empresaB/unidades/u1'));
  assert.throws(() => caminhos.avaliacao('empresaA', 'a1/plantas/1'));
  assert.throws(() => caminhos.membro('empresaA', 'u1/../../x'));
  assert.throws(() => caminhos.catalogoFicha('limao/../x', 1));
});

test('identificadores vazios, gigantes ou reservados são recusados', () => {
  assert.throws(() => caminhos.empresa(''));
  assert.throws(() => caminhos.empresa(undefined));
  assert.throws(() => caminhos.empresa(null));
  assert.throws(() => caminhos.empresa(42));
  assert.throws(() => caminhos.empresa('x'.repeat(201)));
  assert.throws(() => caminhos.empresa('..'));
  assert.throws(() => caminhos.empresa('__reservado__'));
});

test('planta só de 1 a 30 e inteira; versão do histórico é inteira >= 1', () => {
  for (const n of [0, 31, -1, 1.5, '3', NaN, undefined]) {
    assert.throws(() => caminhos.planta('e', 'a', n), undefined, String(n));
  }
  for (const v of [0, -1, 1.5, '2', undefined]) {
    assert.throws(() => caminhos.historicoVinculo('e', 'u', 'fit-a1', v), undefined, String(v));
  }
});

test('setor e talhão não aceitam "_": os ids compostos nunca colidem', () => {
  for (const ruim of ['fit_a1', 'Fit A', 'a/b', '', 'x'.repeat(61)]) {
    assert.throws(() => caminhos.setor('e', ruim), undefined, `setor ${ruim}`);
    assert.throws(() => caminhos.talhao('e', ruim), undefined, `talhão ${ruim}`);
  }
  assert.doesNotThrow(() => caminhos.setor('e', 'fit-a1'));
  assert.doesNotThrow(() => caminhos.talhao('e', 'aB3-9'));
});

test('id do vínculo: {uid}_{setorId}, sem ambiguidade', () => {
  assert.equal(idVinculo('u1', 'fit-a1'), 'u1_fit-a1');
  // "a" + "b-c" e "a_b" + "c" só colidiriam se o setor pudesse ter "_": ele não pode
  assert.notEqual(idVinculo('a', 'b-c'), idVinculo('a_b', 'c'));
  assert.throws(() => idVinculo('a', 'b_c'));
  assert.throws(() => idVinculo('u/1', 'fit-a1'));
});

test('id da avaliação: talhão_semana_uid, com semana no formato ISO', () => {
  assert.equal(idAvaliacao('t1', '2026-W38', 'u9'), 't1_2026-W38_u9');
  assert.throws(() => idAvaliacao('t/1', '2026-W38', 'u9'));
  assert.throws(() => idAvaliacao('t_1', '2026-W38', 'u9'));
  assert.throws(() => idAvaliacao('t1', '2026-38', 'u9'));
  assert.throws(() => idAvaliacao('t1', '2026-W3', 'u9'));
});
