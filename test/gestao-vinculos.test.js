import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  quemPodeAlterar, montarAlteracao, montarNovoVinculo, descreverMudanca, linhasDoHistorico, nomeParaMostrar,
  candidatosParaVincular, FUNCOES, idDoVinculo,
} from '../src/gestao/vinculos.js';

const funcionario = { pessoaUid: 'p1', setorId: 'fit-1', unidadeId: 'un-1', papel: 'funcionario', funcoes: ['pragueiro'], ativo: true, versao: 1 };
const gerente = { ...funcionario, pessoaUid: 'g2', papel: 'gerente', funcoes: [] };
const ator = (extra) => ({ uid: 'g1', ehAdminEmpresa: false, ehGerenteDoSetor: true, ...extra });

// ---------------------------------------------------------------- quem pode alterar quem

test('admin altera qualquer vínculo e é o único que muda o papel', () => {
  for (const alvo of [funcionario, gerente, { ...funcionario, pessoaUid: 'admin1' }]) {
    assert.deepEqual(quemPodeAlterar({ ator: ator({ uid: 'admin1', ehAdminEmpresa: true, ehGerenteDoSetor: false }), alvo }), { pode: true, podeMudarPapel: true, motivo: null });
  }
});

test('gerente altera só funcionário do próprio setor, sem mudar o papel', () => {
  assert.deepEqual(quemPodeAlterar({ ator: ator(), alvo: funcionario }), { pode: true, podeMudarPapel: false, motivo: null });
});

test('gerente não altera a si mesmo nem outro gerente', () => {
  const eu = quemPodeAlterar({ ator: ator(), alvo: { ...gerente, pessoaUid: 'g1' } });
  assert.equal(eu.pode, false);
  assert.match(eu.motivo, /próprio vínculo/);
  const outro = quemPodeAlterar({ ator: ator(), alvo: gerente });
  assert.equal(outro.pode, false);
  assert.match(outro.motivo, /administrador/);
  const eleMesmoFuncionario = quemPodeAlterar({ ator: ator({ uid: 'p1' }), alvo: funcionario });
  assert.equal(eleMesmoFuncionario.pode, false);
});

test('quem não é gerente nem admin não altera nada', () => {
  const r = quemPodeAlterar({ ator: ator({ ehGerenteDoSetor: false }), alvo: funcionario });
  assert.equal(r.pode, false);
  assert.match(r.motivo, /Só o gerente/);
});

// ---------------------------------------------------------------- alteração e histórico

test('desativar: sobe a versão e o histórico é cópia fiel do estado novo, no mesmo formato das regras', () => {
  const a = montarAlteracao({ atual: funcionario, mudancas: { ativo: false }, quem: 'g1', alteradoEm: 'T' });
  assert.equal(a.id, 'p1_fit-1');
  assert.equal(a.versao, 2);
  assert.deepEqual(a.vinculo, { ativo: false, funcoes: ['pragueiro'], papel: 'funcionario', versao: 2, alteradoPor: 'g1', alteradoEm: 'T' });
  assert.deepEqual(a.historico, { versao: 2, pessoaUid: 'p1', setorId: 'fit-1', ativo: false, funcoes: ['pragueiro'], papel: 'funcionario', alteradoPor: 'g1', alteradoEm: 'T' });
  // o documento do vínculo só leva os campos que as regras deixam alterar
  assert.deepEqual(Object.keys(a.vinculo).sort(), ['alteradoEm', 'alteradoPor', 'ativo', 'funcoes', 'papel', 'versao']);
});

test('funções: sem repetição, só as do módulo; papel: só gerente ou funcionário', () => {
  assert.deepEqual(FUNCOES, ['pragueiro', 'agronomo']);
  assert.deepEqual(montarAlteracao({ atual: funcionario, mudancas: { funcoes: ['agronomo', 'pragueiro', 'agronomo'] }, quem: 'g1', alteradoEm: 'T' }).vinculo.funcoes, ['agronomo', 'pragueiro']);
  assert.throws(() => montarAlteracao({ atual: funcionario, mudancas: { funcoes: ['diretor'] }, quem: 'g1', alteradoEm: 'T' }), /desconhecida/);
  assert.throws(() => montarAlteracao({ atual: funcionario, mudancas: { funcoes: 'pragueiro' }, quem: 'g1', alteradoEm: 'T' }), /inválidas/);
  assert.throws(() => montarAlteracao({ atual: funcionario, mudancas: { papel: 'dono' }, quem: 'g1', alteradoEm: 'T' }), /papel/);
  assert.equal(montarAlteracao({ atual: funcionario, mudancas: { papel: 'gerente' }, quem: 'adm', alteradoEm: 'T' }).vinculo.papel, 'gerente');
});

test('recusa alteração vazia, que não muda nada, ou com campo que não pode ser mexido', () => {
  const alt = (mudancas) => () => montarAlteracao({ atual: funcionario, mudancas, quem: 'g1', alteradoEm: 'T' });
  assert.throws(alt({}), /inválida/);
  assert.throws(alt({ ativo: true }), /nada mudou/);
  assert.throws(alt({ funcoes: ['pragueiro'] }), /nada mudou/);
  assert.throws(alt({ papel: 'funcionario' }), /nada mudou/);
  assert.throws(alt({ pessoaUid: 'outro' }), /inválida/); // a pessoa nunca muda
  assert.throws(alt({ setorId: 'outro' }), /inválida/);
  assert.throws(alt({ versao: 9 }), /inválida/);
  assert.throws(alt({ ativo: 'nao' }), /verdadeiro ou falso/);
  assert.throws(() => montarAlteracao({ atual: { ...funcionario, versao: undefined }, mudancas: { ativo: false }, quem: 'g', alteradoEm: 'T' }), /versão/);
});

test('vínculo novo nasce na versão 1, com histórico, ativo, e a pessoa como está no id', () => {
  const n = montarNovoVinculo({ pessoaUid: 'p9', setorId: 'fit-1', unidadeId: 'un-1', papel: 'funcionario', funcoes: ['pragueiro'], quem: 'g1', alteradoEm: 'T' });
  assert.equal(n.id, 'p9_fit-1');
  assert.deepEqual(n.vinculo, { pessoaUid: 'p9', setorId: 'fit-1', unidadeId: 'un-1', papel: 'funcionario', funcoes: ['pragueiro'], ativo: true, versao: 1, alteradoPor: 'g1', alteradoEm: 'T' });
  assert.deepEqual(n.historico, { versao: 1, pessoaUid: 'p9', setorId: 'fit-1', papel: 'funcionario', funcoes: ['pragueiro'], ativo: true, alteradoPor: 'g1', alteradoEm: 'T' });
  assert.throws(() => montarNovoVinculo({ pessoaUid: '', setorId: 's', unidadeId: 'u', papel: 'funcionario', funcoes: [], quem: 'g', alteradoEm: 'T' }), /obrigatórios/);
  assert.throws(() => montarNovoVinculo({ pessoaUid: 'p', setorId: 's', unidadeId: 'u', papel: 'chefe', funcoes: [], quem: 'g', alteradoEm: 'T' }), /papel/);
  assert.throws(() => montarNovoVinculo({ pessoaUid: 'p', setorId: 's', unidadeId: 'u', papel: 'funcionario', funcoes: ['x'], quem: 'g', alteradoEm: 'T' }), /desconhecida/);
  assert.equal(idDoVinculo('p9', 'fit-1'), 'p9_fit-1');
});

// ---------------------------------------------------------------- história

test('frases sobre o que mudou entre dois registros', () => {
  const v1 = { versao: 1, papel: 'funcionario', funcoes: ['pragueiro'], ativo: true };
  assert.deepEqual(descreverMudanca(null, v1), ['Vínculo criado como Funcionário (funções: Pragueiro)']);
  assert.deepEqual(descreverMudanca(v1, { ...v1, ativo: false }), ['Desativado']);
  assert.deepEqual(descreverMudanca({ ...v1, ativo: false }, v1), ['Reativado']);
  assert.deepEqual(descreverMudanca(v1, { ...v1, papel: 'gerente' }), ['Promovido a gerente']);
  assert.deepEqual(descreverMudanca({ ...v1, papel: 'gerente' }, v1), ['Passou a funcionário']);
  assert.deepEqual(descreverMudanca(v1, { ...v1, funcoes: ['pragueiro', 'agronomo'] }), ['Funções: Pragueiro → Pragueiro, Agrônomo']);
  assert.deepEqual(descreverMudanca(v1, { ...v1, funcoes: [] }), ['Funções: Pragueiro → nenhuma']);
  assert.deepEqual(descreverMudanca(v1, { ...v1, ativo: false, funcoes: [] }), ['Desativado', 'Funções: Pragueiro → nenhuma']);
  assert.deepEqual(descreverMudanca(v1, { ...v1 }), ['Sem mudança de dados']);
});

test('linha do tempo: mais recente primeiro, cada uma com o que mudou em relação à anterior', () => {
  const base = { pessoaUid: 'p1', setorId: 'fit-1' };
  const registros = [
    { ...base, versao: 3, ativo: true, papel: 'funcionario', funcoes: ['pragueiro', 'agronomo'], alteradoPor: 'g1', alteradoEm: 'c' },
    { ...base, versao: 1, ativo: true, papel: 'funcionario', funcoes: ['pragueiro'], alteradoPor: 'adm', alteradoEm: 'a' },
    { ...base, versao: 2, ativo: false, papel: 'funcionario', funcoes: ['pragueiro'], alteradoPor: 'g1', alteradoEm: 'b' },
  ];
  const l = linhasDoHistorico(registros);
  assert.deepEqual(l.map((x) => x.versao), [3, 2, 1]);
  assert.deepEqual(l[0].mudancas, ['Reativado', 'Funções: Pragueiro → Pragueiro, Agrônomo']);
  assert.deepEqual(l[1].mudancas, ['Desativado']);
  assert.match(l[2].mudancas[0], /Vínculo criado/);
  assert.equal(l[0].quem, 'g1');
  assert.deepEqual(linhasDoHistorico([]), []);
});

test('nome para mostrar: o conhecido, ou um trecho do código quando as regras não deixam ler o nome', () => {
  assert.equal(nomeParaMostrar('abc123xyz', { abc123xyz: 'Paula' }), 'Paula');
  assert.equal(nomeParaMostrar('abc123xyz', {}), 'pessoa abc123…');
  assert.equal(nomeParaMostrar('abc123xyz'), 'pessoa abc123…');
});

test('candidatos: membros ativos sem vínculo no setor; quem tem vínculo desativado deve ser reativado', () => {
  const membros = [{ uid: 'a', ativo: true }, { uid: 'b', ativo: true }, { uid: 'c', ativo: false }, { uid: 'd', ativo: true }];
  const vinculos = [{ pessoaUid: 'b', ativo: true }, { pessoaUid: 'd', ativo: false }];
  assert.deepEqual(candidatosParaVincular(membros, vinculos).map((m) => m.uid), ['a']);
  assert.deepEqual(candidatosParaVincular([], vinculos), []);
});
