import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODULOS, moduloConhecido, nomeDaFuncao } from '../src/modulos/registro.js';
import { decidirEmpresa, ehAdminDaEmpresa } from '../src/nucleo/empresas.js';
import { montarMenu, escolherSetorDoModulo } from '../src/nucleo/menu.js';
import { podeAvaliar, podeDecidir, podeAcompanhar, ehGerenteDoSetor } from '../src/nucleo/permissoes.js';

const m = (empresaId, papelEmpresa = 'membro', ativo = true) => ({ empresaId, papelEmpresa, ativo });
const v = (setorId, papel = 'funcionario', funcoes = [], ativo = true, unidadeId = 'un-1') => ({ setorId, unidadeId, papel, funcoes, ativo });
const setor = (modulos, extra = {}) => ({ nome: 'Setor', unidadeId: 'un-1', modulos, ativo: true, ...extra });

// ---------------------------------------------------------------- registro

test('só a Fitossanidade é um módulo conhecido; os futuros não aparecem', () => {
  assert.deepEqual(Object.keys(MODULOS), ['fitossanidade']);
  assert.equal(moduloConhecido('fitossanidade'), true);
  for (const futuro of ['frota', 'manutencao', 'colheita', 'aplicacoes', 'insumos', 'constructor', '__proto__', 'toString']) {
    assert.equal(moduloConhecido(futuro), false, futuro);
  }
  assert.equal(nomeDaFuncao('agronomo'), 'Agrônomo');
  assert.equal(nomeDaFuncao('desconhecida'), 'desconhecida');
});

// ---------------------------------------------------------------- empresa

test('empresa: um vínculo ativo entra direto', () => {
  const r = decidirEmpresa({ membros: [m('A')] });
  assert.equal(r.status, 'ok');
  assert.equal(r.empresaId, 'A');
});

test('empresa: nenhum registro é sem_empresa; só desativados é acesso_desativado', () => {
  assert.equal(decidirEmpresa({ membros: [] }).status, 'sem_empresa');
  assert.equal(decidirEmpresa({}).status, 'sem_empresa');
  assert.equal(decidirEmpresa({ membros: [m('A', 'membro', false)] }).status, 'acesso_desativado');
  assert.equal(decidirEmpresa({ membros: [m('A', 'dono')] }).status, 'acesso_desativado'); // papel desconhecido
  assert.equal(decidirEmpresa({ membros: [{ empresaId: 'A', papelEmpresa: 'admin', ativo: 'true' }] }).status, 'acesso_desativado');
  assert.equal(decidirEmpresa({ membros: [{ empresaId: 'A', papelEmpresa: 'admin', ativo: 1 }] }).status, 'acesso_desativado');
});

test('empresa: várias pedem a escolha, salvo se a última ainda valer', () => {
  const membros = [m('A'), m('B')];
  assert.equal(decidirEmpresa({ membros }).status, 'escolher_empresa');
  assert.equal(decidirEmpresa({ membros, empresaSalva: 'B' }).empresaId, 'B');
  assert.equal(decidirEmpresa({ membros, empresaSalva: 'Z' }).status, 'escolher_empresa');
  const comInativa = [m('A'), m('B', 'membro', false), m('C')];
  const r = decidirEmpresa({ membros: comInativa, empresaSalva: 'B' });
  assert.equal(r.status, 'escolher_empresa');
  assert.deepEqual(r.ativos.map((x) => x.empresaId), ['A', 'C']);
});

test('empresa: dono da plataforma sem empresa vai para a plataforma; com empresa segue nela', () => {
  assert.equal(decidirEmpresa({ membros: [], ehPlataforma: true }).status, 'plataforma_apenas');
  assert.equal(decidirEmpresa({ membros: [m('A', 'admin')], ehPlataforma: true }).status, 'ok');
});

test('admin da empresa: só com papelEmpresa admin e ativo', () => {
  assert.equal(ehAdminDaEmpresa(m('A', 'admin')), true);
  assert.equal(ehAdminDaEmpresa(m('A', 'membro')), false);
  assert.equal(ehAdminDaEmpresa(m('A', 'admin', false)), false);
  assert.equal(ehAdminDaEmpresa(null), false);
});

// ---------------------------------------------------------------- menu

test('menu: um vínculo em setor com Fitossanidade mostra Fitossanidade', () => {
  const menu = montarMenu({ vinculos: [v('fit-1')], setores: { 'fit-1': setor(['fitossanidade']) }, unidades: { 'un-1': { nome: 'Fazenda 1' } } });
  assert.equal(menu.length, 1);
  assert.equal(menu[0].modulo.id, 'fitossanidade');
  assert.equal(menu[0].setores[0].unidadeNome, 'Fazenda 1');
});

test('menu: o motorista (só setor Frota) não vê Fitossanidade nem módulo nenhum', () => {
  const menu = montarMenu({ vinculos: [v('frota-1')], setores: { 'frota-1': setor(['frota']) } });
  assert.deepEqual(menu, []);
});

test('menu: é a soma dos módulos dos setores com vínculo; sem vínculo, sem menu', () => {
  const setores = { 'fit-1': setor(['fitossanidade']), 'frota-1': setor(['frota']), 'misto-1': setor(['frota', 'fitossanidade']) };
  assert.deepEqual(montarMenu({ vinculos: [], setores }), []);
  const soFrota = montarMenu({ vinculos: [v('frota-1')], setores });
  assert.deepEqual(soFrota, []);
  const misto = montarMenu({ vinculos: [v('frota-1'), v('misto-1')], setores });
  assert.equal(misto.length, 1); // só a Fitossanidade existe; a Frota do setor misto é ignorada
  assert.deepEqual(misto[0].setores.map((s) => s.setorId), ['misto-1']);
});

test('menu: vínculo desativado, setor desativado ou sem o módulo não mostram nada', () => {
  const ok = { 'fit-1': setor(['fitossanidade']) };
  assert.equal(montarMenu({ vinculos: [v('fit-1', 'funcionario', [], false)], setores: ok }).length, 0);
  assert.equal(montarMenu({ vinculos: [v('fit-1')], setores: { 'fit-1': setor(['fitossanidade'], { ativo: false }) } }).length, 0);
  assert.equal(montarMenu({ vinculos: [v('fit-1')], setores: { 'fit-1': setor([]) } }).length, 0);
  assert.equal(montarMenu({ vinculos: [v('fit-1')], setores: {} }).length, 0); // setor ainda não carregado
  assert.equal(montarMenu({ vinculos: [v('fit-1')], setores: { 'fit-1': { nome: 'X', ativo: true, modulos: 'fitossanidade' } } }).length, 0);
  assert.equal(montarMenu({ vinculos: [{ ...v('fit-1'), ativo: 'true' }], setores: ok }).length, 0);
});

test('menu: vários setores do mesmo módulo ficam agrupados e em ordem de nome', () => {
  const setores = { 'fit-b': setor(['fitossanidade'], { nome: 'Norte' }), 'fit-a': setor(['fitossanidade'], { nome: 'Ácaros' }) };
  const menu = montarMenu({ vinculos: [v('fit-b'), v('fit-a')], setores });
  assert.equal(menu.length, 1);
  assert.deepEqual(menu[0].setores.map((s) => s.nome), ['Ácaros', 'Norte']);
});

test('menu: setor ativo — o salvo, o único, ou pede escolha', () => {
  const setores = { a: setor(['fitossanidade'], { nome: 'A' }), b: setor(['fitossanidade'], { nome: 'B' }) };
  const dois = montarMenu({ vinculos: [v('a'), v('b')], setores })[0];
  assert.equal(escolherSetorDoModulo(dois), null);
  assert.equal(escolherSetorDoModulo(dois, 'b').setorId, 'b');
  assert.equal(escolherSetorDoModulo(dois, 'inexistente'), null);
  const um = montarMenu({ vinculos: [v('a')], setores })[0];
  assert.equal(escolherSetorDoModulo(um).setorId, 'a');
  assert.equal(escolherSetorDoModulo(undefined), null);
});

// ---------------------------------------------------------------- permissões

test('permissões: cada função abre só o que as regras abrem', () => {
  const pragueiro = v('s', 'funcionario', ['pragueiro']);
  const agronomo = v('s', 'funcionario', ['agronomo']);
  const gerente = v('s', 'gerente', []);
  const motorista = v('s', 'funcionario', []);

  assert.deepEqual([podeAvaliar(pragueiro), podeAvaliar(agronomo), podeAvaliar(gerente), podeAvaliar(motorista)], [true, false, false, false]);
  assert.deepEqual([podeDecidir(pragueiro), podeDecidir(agronomo), podeDecidir(gerente)], [false, true, false]);
  assert.deepEqual([ehGerenteDoSetor(pragueiro), ehGerenteDoSetor(agronomo), ehGerenteDoSetor(gerente)], [false, false, true]);
  assert.deepEqual([podeAcompanhar(pragueiro), podeAcompanhar(agronomo), podeAcompanhar(gerente), podeAcompanhar(motorista)], [false, true, true, false]);
});

test('permissões: vínculo desativado ou ausente não dá poder algum', () => {
  const desativado = v('s', 'gerente', ['pragueiro', 'agronomo'], false);
  for (const f of [podeAvaliar, podeDecidir, ehGerenteDoSetor, podeAcompanhar]) {
    assert.equal(f(desativado), false, f.name);
    assert.equal(f(null), false, f.name);
    assert.equal(f(undefined), false, f.name);
  }
  assert.equal(podeAvaliar({ ativo: true, funcoes: 'pragueiro' }), false); // não é lista
});
