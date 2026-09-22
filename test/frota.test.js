import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lerCombustivel, textoCombustivel, montarMaquina, montarEdicaoMaquina } from '../src/frota/cadastro.js';
import { montarInicioDeUso, montarFimDeUso, montarSugestaoDeManutencao, montarMudancaDeStatusPeloAdmin, ordenarHistorico } from '../src/frota/uso.js';

// ---------------------------------------------------------------- combustível

test('combustível: % de 0 a 100 vira fração; vazio ou fora da faixa é recusado', () => {
  assert.equal(lerCombustivel('80'), 0.8);
  assert.equal(lerCombustivel('12,5'), 0.125);
  assert.equal(lerCombustivel('0'), 0);
  assert.equal(lerCombustivel('100'), 1);
  for (const ruim of ['', '-1', '101', 'abc']) assert.throws(() => lerCombustivel(ruim), /Combustível/, ruim);
  assert.equal(textoCombustivel(0.8), '80%');
  assert.equal(textoCombustivel(0), '0%');
  assert.equal(textoCombustivel(undefined), '0%');
});

// ---------------------------------------------------------------- cadastro

test('máquina nova nasce disponível, operacional e ativa', () => {
  const m = montarMaquina({ unidadeId: 'un-1', nome: ' Trator 01 ', modelo: ' Massey ', tipo: 'Trator', documento: '', combustivel: '80' });
  assert.deepEqual(m, { unidadeId: 'un-1', nome: 'Trator 01', ativo: true, disponibilidade: 'disponivel', status: 'operacional', combustivel: 0.8, modelo: 'Massey', tipo: 'Trator' });
  assert.equal('documento' in m, false);
  assert.throws(() => montarMaquina({ unidadeId: '', nome: 'X', combustivel: '10' }), /unidade/);
  assert.throws(() => montarMaquina({ unidadeId: 'u', nome: '', combustivel: '10' }), /preencha/);
  assert.throws(() => montarMaquina({ unidadeId: 'u', nome: 'X', combustivel: '' }), /Combustível/);
  assert.throws(() => montarMaquina({ unidadeId: 'u', nome: 'x'.repeat(121), combustivel: '10' }), /no máximo 120/);
});

test('editar máquina: só o cadastro, nunca o dia a dia', () => {
  assert.deepEqual(montarEdicaoMaquina({ nome: 'T1', ativo: false }), { nome: 'T1', ativo: false });
  assert.deepEqual(Object.keys(montarEdicaoMaquina({ nome: 'T1', modelo: 'M', tipo: 'Tipo', documento: 'Doc' })).sort(), ['ativo', 'documento', 'modelo', 'nome', 'tipo']);
});

// ---------------------------------------------------------------- uso

const disponivel = { unidadeId: 'un-1', ativo: true, disponibilidade: 'disponivel', status: 'operacional', combustivel: 0.5 };
const emUso = { ...disponivel, disponibilidade: 'em_uso', usoAtual: { usoId: 'u1', operadorUid: 'op-1', setorId: 'fit-1' } };

test('iniciar uso: só se estiver disponível e ativa; o id do uso liga a máquina ao registro', () => {
  const r = montarInicioDeUso({ maquina: disponivel, uid: 'op-1', setorId: 'fit-1', usoId: 'u1' });
  assert.deepEqual(r, { naMaquina: { disponibilidade: 'em_uso', usoAtual: { usoId: 'u1', operadorUid: 'op-1', setorId: 'fit-1' } }, noUso: { operadorUid: 'op-1', setorId: 'fit-1', unidadeId: 'un-1' } });
  assert.throws(() => montarInicioDeUso({ maquina: emUso, uid: 'op-1', setorId: 'fit-1', usoId: 'u2' }), /já está em uso/);
  assert.throws(() => montarInicioDeUso({ maquina: { ...disponivel, ativo: false }, uid: 'op-1', setorId: 'fit-1', usoId: 'u2' }), /desativada/);
  assert.throws(() => montarInicioDeUso({ maquina: disponivel, uid: 'op-1', setorId: '', usoId: 'u2' }), /setor/);
});

test('encerrar uso: só quem começou, e o combustível fica registrado nos dois lugares', () => {
  const r = montarFimDeUso({ maquina: emUso, uid: 'op-1', combustivel: '65' });
  assert.deepEqual(r, { usoId: 'u1', naMaquina: { disponibilidade: 'disponivel', combustivel: 0.65 }, noUso: { combustivelFim: 0.65 } });
  assert.throws(() => montarFimDeUso({ maquina: emUso, uid: 'outro', combustivel: '65' }), /Só quem começou/);
  assert.throws(() => montarFimDeUso({ maquina: disponivel, uid: 'op-1', combustivel: '65' }), /não está em uso/);
  assert.throws(() => montarFimDeUso({ maquina: emUso, uid: 'op-1', combustivel: '' }), /Combustível/);
});

// ---------------------------------------------------------------- manutenção

test('sugerir manutenção: só de operacional para manutenção sugerida', () => {
  const r = montarSugestaoDeManutencao({ maquina: disponivel, uid: 'u9', descricao: ' correia solta ' });
  assert.deepEqual(r, { naMaquina: { status: 'manutencao_sugerida' }, log: { tipo: 'sugestao', criadoPor: 'u9', descricao: 'correia solta' } });
  assert.throws(() => montarSugestaoDeManutencao({ maquina: { ...disponivel, status: 'precisa_manutencao' }, uid: 'u9' }), /já está sinalizada/);
  assert.throws(() => montarSugestaoDeManutencao({ maquina: disponivel, uid: 'u9', descricao: 'x'.repeat(1001) }), /Descrição/);
  assert.equal('descricao' in montarSugestaoDeManutencao({ maquina: disponivel, uid: 'u9' }).log, false);
});

test('admin marca urgente ou conclui; concluir exige descrição do que foi feito', () => {
  const urgente = montarMudancaDeStatusPeloAdmin({ maquina: disponivel, uid: 'a1', novoStatus: 'precisa_manutencao', descricao: 'vazamento de óleo' });
  assert.deepEqual(urgente, { naMaquina: { status: 'precisa_manutencao' }, log: { tipo: 'sugestao', criadoPor: 'a1', descricao: 'vazamento de óleo' } });
  const concluida = montarMudancaDeStatusPeloAdmin({ maquina: { ...disponivel, status: 'precisa_manutencao' }, uid: 'a1', novoStatus: 'operacional', descricao: 'troca de óleo feita' });
  assert.deepEqual(concluida, { naMaquina: { status: 'operacional' }, log: { tipo: 'realizada', criadoPor: 'a1', descricao: 'troca de óleo feita' } });
  assert.throws(() => montarMudancaDeStatusPeloAdmin({ maquina: { ...disponivel, status: 'precisa_manutencao' }, uid: 'a1', novoStatus: 'precisa_manutencao' }), /já está em/);
  assert.throws(() => montarMudancaDeStatusPeloAdmin({ maquina: { ...disponivel, status: 'precisa_manutencao' }, uid: 'a1', novoStatus: 'operacional' }), /Descreva o que foi feito/);
  assert.throws(() => montarMudancaDeStatusPeloAdmin({ maquina: disponivel, uid: 'a1', novoStatus: 'nada' }), /Status inválido/);
});

test('histórico ordenado do mais novo para o mais antigo', () => {
  const itens = [{ id: 'a', inicioEm: 100 }, { id: 'b', inicioEm: 300 }, { id: 'c', inicioEm: 200 }];
  assert.deepEqual(ordenarHistorico(itens).map((i) => i.id), ['b', 'c', 'a']);
  assert.deepEqual(ordenarHistorico([{ id: 'x', criadoEm: 5 }, { id: 'y', criadoEm: 9 }], 'criadoEm').map((i) => i.id), ['y', 'x']);
});
