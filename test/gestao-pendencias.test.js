import { test } from 'node:test';
import assert from 'node:assert/strict';
import { contarPendencias } from '../src/gestao/pendencias.js';

const av = (id, status = 'finalizada') => ({ id, status });
const dec = (avaliacaoId, status) => ({ avaliacaoId, status });

test('agrônomo: conta as finalizadas sem decisão; quem não pode decidir sempre vê 0 aqui', () => {
  const avaliacoes = [av('a1'), av('a2'), av('a3', 'rascunho')];
  const decisoes = [dec('a1', 'aprovada')];
  assert.equal(contarPendencias({ avaliacoes, decisoes, podeDecidir: true }).aguardandoDecisao, 1); // só a2
  assert.equal(contarPendencias({ avaliacoes, decisoes, podeDecidir: false }).aguardandoDecisao, 0);
});

test('gerente: conta as decisões aprovadas (aguardando execução); rejeitada e executada não contam', () => {
  const decisoes = [dec('a1', 'aprovada'), dec('a2', 'rejeitada'), dec('a3', 'executada'), dec('a4', 'aprovada')];
  assert.equal(contarPendencias({ decisoes, ehGerente: true }).aguardandoExecucao, 2);
  assert.equal(contarPendencias({ decisoes, ehGerente: false }).aguardandoExecucao, 0);
});

test('quem acumula os dois papéis soma os dois; total é a soma', () => {
  const avaliacoes = [av('a1'), av('a2')];
  const decisoes = [dec('a1', 'aprovada')];
  const r = contarPendencias({ avaliacoes, decisoes, podeDecidir: true, ehGerente: true });
  assert.deepEqual(r, { aguardandoDecisao: 1, aguardandoExecucao: 1, total: 2 });
});

test('sem nada pendente: tudo zero, mesmo com os dois papéis', () => {
  assert.deepEqual(contarPendencias({ podeDecidir: true, ehGerente: true }), { aguardandoDecisao: 0, aguardandoExecucao: 0, total: 0 });
});
