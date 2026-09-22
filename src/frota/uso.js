// O dia a dia da máquina: começar e encerrar um uso (com o combustível ao encerrar) e o status de
// manutenção (sugerir, marcar urgente, concluir). Funções puras: decidem SE a ação vale e montam os
// dados; quem grava (o repositório) carimba a hora do servidor e faz as duas escritas no mesmo lote.
import { lerCombustivel } from './cadastro.js';

export const ROTULO_DISPONIBILIDADE = { disponivel: 'Disponível', em_uso: 'Em uso' };
export const ROTULO_STATUS = { operacional: 'Operacional', precisa_manutencao: 'Precisa de manutenção', manutencao_sugerida: 'Manutenção sugerida' };

const exigirAtiva = (maquina) => {
  if (!maquina.ativo) throw new Error('Esta máquina está desativada.');
};

/**
 * Início de um uso: a máquina precisa estar disponível. `usoId` é gerado por quem chama (o
 * repositório), para o mesmo id nomear o documento do histórico e o campo `usoAtual` da máquina —
 * é o que garante, nas regras, que as duas escritas do lote combinam.
 */
export function montarInicioDeUso({ maquina, uid, setorId, usoId }) {
  exigirAtiva(maquina);
  if (maquina.disponibilidade !== 'disponivel') throw new Error('Esta máquina já está em uso.');
  if (!setorId) throw new Error('Escolha o setor');
  return {
    naMaquina: { disponibilidade: 'em_uso', usoAtual: { usoId, operadorUid: uid, setorId } },
    noUso: { operadorUid: uid, setorId, unidadeId: maquina.unidadeId },
  };
}

/** Fim de um uso: só quem começou encerra, e o combustível é obrigatório para poder ficar "disponível" de novo. */
export function montarFimDeUso({ maquina, uid, combustivel }) {
  if (maquina.disponibilidade !== 'em_uso' || !maquina.usoAtual) throw new Error('Esta máquina não está em uso.');
  if (maquina.usoAtual.operadorUid !== uid) throw new Error('Só quem começou o uso pode encerrá-lo.');
  const fracao = lerCombustivel(combustivel);
  return {
    usoId: maquina.usoAtual.usoId,
    naMaquina: { disponibilidade: 'disponivel', combustivel: fracao },
    noUso: { combustivelFim: fracao },
  };
}

const TRANSICOES_ADMIN = {
  precisa_manutencao: ['operacional', 'manutencao_sugerida'],
  operacional: ['precisa_manutencao', 'manutencao_sugerida'],
};

/** Qualquer membro ativo sinaliza um problema leve: só sai de "operacional" para "manutenção sugerida". */
export function montarSugestaoDeManutencao({ maquina, uid, descricao = '' }) {
  if (maquina.status !== 'operacional') throw new Error('Esta máquina já está sinalizada.');
  const d = String(descricao ?? '').trim();
  if (d.length > 1000) throw new Error('Descrição: no máximo 1000 caracteres');
  return { naMaquina: { status: 'manutencao_sugerida' }, log: { tipo: 'sugestao', criadoPor: uid, ...(d ? { descricao: d } : {}) } };
}

/** Admin marca urgente (de qualquer estado, menos já urgente) ou conclui (some para "operacional"). */
export function montarMudancaDeStatusPeloAdmin({ maquina, uid, novoStatus, descricao = '' }) {
  const validas = TRANSICOES_ADMIN[novoStatus];
  if (!validas) throw new Error('Status inválido');
  if (!validas.includes(maquina.status)) throw new Error(`Esta máquina já está em "${ROTULO_STATUS[maquina.status]}".`);
  const d = String(descricao ?? '').trim();
  if (d.length > 1000) throw new Error('Descrição: no máximo 1000 caracteres');
  if (novoStatus === 'operacional' && d.length === 0) throw new Error('Descreva o que foi feito na manutenção');
  return {
    naMaquina: { status: novoStatus },
    log: { tipo: novoStatus === 'operacional' ? 'realizada' : 'sugestao', criadoPor: uid, ...(d ? { descricao: d } : {}) },
  };
}

/** Linha do histórico (uso ou manutenção), mais novo primeiro, para a tela. */
export function ordenarHistorico(itens, campoData = 'inicioEm') {
  const ms = (v) => (typeof v?.toMillis === 'function' ? v.toMillis() : Number(v) || 0);
  return [...itens].sort((a, b) => ms(b[campoData]) - ms(a[campoData]));
}
