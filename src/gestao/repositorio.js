// Leitura e gravação do acompanhamento (agrônomo e gerente) e da gestão de vínculos. Toda função recebe o
// `db`, então o app e os scripts de verificação executam o mesmo código.
//
// Regras que moldam este arquivo (firestore.rules):
//  - agrônomo e gerente leem avaliações e decisões do setor, e a consulta PRECISA filtrar por setorId;
//  - ler por id um documento que ainda não existe (ex.: a decisão) é negado: use consulta, nunca getDoc;
//  - toda alteração de vínculo grava o documento E o histórico da nova versão no MESMO lote;
//  - só o admin lista os membros da empresa; cada pessoa lê o próprio registro.
import {
  collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where, writeBatch,
} from 'firebase/firestore';
import { caminhos } from '../nucleo/caminhos.js';
import { comId } from '../campo/repositorio.js';
import { montarDecisao, dadosExecucao } from './decisao.js';
import { montarAlteracao, montarNovoVinculo } from './vinculos.js';

// ---------------------------------------------------------------- avaliações do setor

export const consultaAvaliacoesDoSetor = (db, empresaId, setorId, semana) =>
  query(collection(db, ...caminhos.avaliacoes(empresaId)), where('setorId', '==', setorId), where('semanaISO', '==', semana));

/** Avaliações finalizadas do setor, de QUALQUER semana (para saber quantas ainda esperam decisão). */
export const consultaAvaliacoesFinalizadasDoSetor = (db, empresaId, setorId) =>
  query(collection(db, ...caminhos.avaliacoes(empresaId)), where('setorId', '==', setorId), where('status', '==', 'finalizada'));

/** Todas as avaliações de um talhão no setor (para ver a semana anterior, ex.: armadilha do bicho-furão). */
export const consultaAvaliacoesDoTalhao = (db, empresaId, setorId, talhaoId) =>
  query(collection(db, ...caminhos.avaliacoes(empresaId)), where('setorId', '==', setorId), where('talhaoId', '==', talhaoId));

export async function avaliacaoDaSemanaAnterior(db, empresaId, setorId, talhaoId, semanaAnterior) {
  const lista = (await getDocs(consultaAvaliacoesDoTalhao(db, empresaId, setorId, talhaoId))).docs.map(comId);
  return lista.find((a) => a.semanaISO === semanaAnterior && a.status === 'finalizada') ?? null;
}

// ---------------------------------------------------------------- decisões

const DE_30 = 30; // limite do operador "in"

/** Decisões das avaliações dadas: { [avaliacaoId]: decisao }. Sempre com o filtro de setor (exigência das regras). */
export async function decisoesDeAvaliacoes(db, empresaId, setorId, avaliacaoIds) {
  const mapa = {};
  for (let i = 0; i < avaliacaoIds.length; i += DE_30) {
    const bloco = avaliacaoIds.slice(i, i + DE_30);
    const snap = await getDocs(query(collection(db, ...caminhos.decisoes(empresaId)), where('setorId', '==', setorId), where('avaliacaoId', 'in', bloco)));
    for (const d of snap.docs) mapa[d.data().avaliacaoId] = comId(d);
  }
  return mapa;
}

/** Todas as decisões do setor (para a lista da semana). Com o filtro de setor que as regras exigem. */
export const consultaDecisoesDoSetor = (db, empresaId, setorId) =>
  query(collection(db, ...caminhos.decisoes(empresaId)), where('setorId', '==', setorId));

/** Ouve a decisão de UMA avaliação (consulta, não getDoc). Entrega o documento ou null. */
export function ouvirDecisao(db, empresaId, setorId, avaliacaoId, aoMudar, aoFalhar) {
  return onSnapshot(
    query(collection(db, ...caminhos.decisoes(empresaId)), where('setorId', '==', setorId), where('avaliacaoId', '==', avaliacaoId)),
    { includeMetadataChanges: true },
    (snap) => aoMudar(snap.empty ? null : { ...comId(snap.docs[0]), pendente: snap.docs[0].metadata.hasPendingWrites }),
    aoFalhar,
  );
}

/** O agrônomo decide. O id do documento é o da avaliação (uma decisão por avaliação). */
export function criarDecisao(db, empresaId, { ficha, avaliacao, uid, status, tds, motivos, observacao }) {
  const dados = montarDecisao({ ficha, avaliacao, uid, status, tds, motivos, observacao, decididoEm: serverTimestamp() });
  return setDoc(doc(db, ...caminhos.decisao(empresaId, avaliacao.id)), dados);
}

/** O gerente marca a decisão aprovada como executada. */
export function executarDecisao(db, empresaId, avaliacaoId, { uid, observacao }) {
  return updateDoc(doc(db, ...caminhos.decisao(empresaId, avaliacaoId)), dadosExecucao({ uid, observacao, executadoEm: serverTimestamp() }));
}

// ---------------------------------------------------------------- vínculos

export const consultaVinculosDoSetor = (db, empresaId, setorId) =>
  query(collection(db, ...caminhos.vinculos(empresaId)), where('setorId', '==', setorId));

/**
 * Histórico de um vínculo. A consulta declara o setorId porque a regra de leitura o usa (resource.data.setorId):
 * sem o filtro, listar o histórico é negado ao gerente.
 */
export const colecaoHistorico = (db, empresaId, pessoaUid, setorId) =>
  query(collection(db, ...caminhos.historico(empresaId, pessoaUid, setorId)), where('setorId', '==', setorId));

/** Altera um vínculo: documento + histórico da nova versão, no mesmo lote (as regras exigem os dois). */
export async function alterarVinculo(db, empresaId, { atual, mudancas, uid }) {
  const alt = montarAlteracao({ atual, mudancas, quem: uid, alteradoEm: serverTimestamp() });
  const lote = writeBatch(db);
  lote.update(doc(db, ...caminhos.vinculo(empresaId, atual.pessoaUid, atual.setorId)), alt.vinculo);
  lote.set(doc(db, ...caminhos.historicoVinculo(empresaId, atual.pessoaUid, atual.setorId, alt.versao)), alt.historico);
  await lote.commit();
  return alt;
}

/** Liga uma pessoa (membro ativo da empresa) a um setor: vínculo na versão 1 + histórico, no mesmo lote. */
export async function criarVinculo(db, empresaId, { pessoaUid, setorId, unidadeId, papel, funcoes, uid }) {
  const novo = montarNovoVinculo({ pessoaUid, setorId, unidadeId, papel, funcoes, quem: uid, alteradoEm: serverTimestamp() });
  const lote = writeBatch(db);
  lote.set(doc(db, ...caminhos.vinculo(empresaId, pessoaUid, setorId)), novo.vinculo);
  lote.set(doc(db, ...caminhos.historicoVinculo(empresaId, pessoaUid, setorId, 1)), novo.historico);
  await lote.commit();
  return novo;
}

// ---------------------------------------------------------------- nomes das pessoas

/**
 * Nomes que as regras deixam ler: { [uid]: nome }. Hoje só o admin lê o registro de outros membros (e cada um
 * o próprio); para os demais o resultado vem vazio e a tela mostra um trecho do código.
 */
export async function resolverNomes(db, empresaId, uids) {
  const unicos = [...new Set(uids)];
  const lidos = await Promise.allSettled(unicos.map((uid) => getDoc(doc(db, ...caminhos.membro(empresaId, uid)))));
  const nomes = {};
  lidos.forEach((r, i) => {
    if (r.status === 'fulfilled' && r.value.exists() && r.value.data().nome) nomes[unicos[i]] = r.value.data().nome;
  });
  return nomes;
}

/** Membros da empresa, para escolher quem ligar a um setor. Só o admin lista; para os demais devolve `permitido: false`. */
export async function listarMembros(db, empresaId) {
  try {
    const snap = await getDocs(collection(db, ...caminhos.membros(empresaId)));
    return { permitido: true, membros: snap.docs.map((d) => ({ ...d.data(), uid: d.id })) };
  } catch (e) {
    if (e.code === 'permission-denied') return { permitido: false, membros: [] };
    throw e;
  }
}
