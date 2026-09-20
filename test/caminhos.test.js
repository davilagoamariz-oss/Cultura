import { test } from 'node:test';
import assert from 'node:assert/strict';
import { caminhos, idAvaliacao, GRUPO_MEMBROS } from '../src/nucleo/caminhos.js';

test('tudo o que é da empresa fica dentro de empresas/{id}', () => {
  const e = 'empresaA';
  const dentroDaEmpresa = [
    caminhos.empresa(e),
    caminhos.membros(e),
    caminhos.membro(e, 'u1'),
    caminhos.convite(e, 'codigo-longo'),
    caminhos.fazenda(e, 'f1'),
    caminhos.talhao(e, 't1'),
    caminhos.avaliacoes(e),
    caminhos.avaliacao(e, 'a1'),
    caminhos.plantas(e, 'a1'),
    caminhos.planta(e, 'a1', 7),
    caminhos.decisao(e, 'a1'),
    caminhos.eventos(e),
  ];
  for (const c of dentroDaEmpresa) assert.deepEqual(c.slice(0, 2), ['empresas', e]);

  assert.deepEqual(caminhos.planta(e, 'a1', 30), ['empresas', e, 'avaliacoes', 'a1', 'plantas', '30']);
  assert.equal(GRUPO_MEMBROS, 'membros');
});

test('identificador com barra não escapa da empresa (path traversal)', () => {
  assert.throws(() => caminhos.empresa('empresaA/membros/u1'));
  assert.throws(() => caminhos.talhao('empresaA', '../empresaB/talhoes/t1'));
  assert.throws(() => caminhos.avaliacao('empresaA', 'a1/plantas/1'));
  assert.throws(() => caminhos.membro('empresaA', 'u1/../../x'));
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

test('planta só de 1 a 30 e inteira', () => {
  for (const n of [0, 31, -1, 1.5, '3', NaN, undefined]) {
    assert.throws(() => caminhos.planta('e', 'a', n), undefined, String(n));
  }
});

test('id da avaliação segue o padrão exigido pelas regras', () => {
  assert.equal(idAvaliacao('t1', '2026-W38', 'u9'), 't1_2026-W38_u9');
  assert.throws(() => idAvaliacao('t/1', '2026-W38', 'u9'));
});
