// Leitura e gravação do módulo de campo no Firestore. Toda função recebe o `db`, então o app e os
// scripts de verificação (emuladores) executam exatamente o mesmo código.
//
// Regras que moldam este arquivo (firestore.rules):
//  - o pragueiro só lê as próprias avaliações e a consulta PRECISA filtrar por setorId E responsavelUid;
//  - ler por id uma avaliação que ainda não existe é negado (a regra usa resource.data): para saber se já
//    existe, use as consultas abaixo, nunca getDoc;
//  - o cabeçalho e as plantas nunca vão no mesmo lote (get() enxerga o estado anterior ao lote).
import {
  collection, doc, getDoc, getDocs, onSnapshot, query, serverTimestamp, setDoc, updateDoc, where,
} from 'firebase/firestore';
import { caminhos } from '../nucleo/caminhos.js';
import { montarCabecalho, dadosDaPlanta, dadosParaFinalizar } from './avaliacao.js';
import { ouvirComRetentativa } from './retentativa.js';

// ---------------------------------------------------------------- catálogo e cadastros (legíveis por membros)

export async function carregarFichaDaCultura(db, culturaId) {
  const cultura = (await getDoc(doc(db, ...caminhos.catalogoCultura(culturaId)))).data();
  if (!cultura?.fichaAtual) throw new Error(`cultura ${culturaId} sem ficha vigente`);
  const { fichaId, versao } = cultura.fichaAtual;
  const ficha = (await getDoc(doc(db, ...caminhos.catalogoFicha(fichaId, versao)))).data();
  if (!ficha) throw new Error(`ficha ${fichaId} v${versao} não encontrada`);
  return { cultura, ficha };
}

/** Uma ficha específica (a versão que a avaliação usou), para reabrir avaliações antigas. */
export async function carregarFicha(db, fichaId, versao) {
  const ficha = (await getDoc(doc(db, ...caminhos.catalogoFicha(fichaId, versao)))).data();
  if (!ficha) throw new Error(`ficha ${fichaId} v${versao} não encontrada`);
  return ficha;
}

export const consultaTalhoes = (db, empresaId, unidadeId) =>
  query(collection(db, ...caminhos.talhoes(empresaId)), where('unidadeId', '==', unidadeId), where('ativo', '==', true));

export const colecaoAjustes = (db, empresaId) => collection(db, ...caminhos.ajustes(empresaId));

// ---------------------------------------------------------------- avaliações do pragueiro (sempre com os dois filtros)

const minhas = (db, empresaId, setorId, uid) => [
  collection(db, ...caminhos.avaliacoes(empresaId)),
  where('setorId', '==', setorId),
  where('responsavelUid', '==', uid),
];

export const consultaMinhasDaSemana = (db, empresaId, setorId, uid, semana) =>
  query(...minhas(db, empresaId, setorId, uid), where('semanaISO', '==', semana));

export const consultaMeusRascunhos = (db, empresaId, setorId, uid) =>
  query(...minhas(db, empresaId, setorId, uid), where('status', '==', 'rascunho'));

export const comId = (docSnap) => ({ ...docSnap.data(), id: docSnap.id });

/** As minhas avaliações da semana, por talhão: { [talhaoId]: { id, status, ... } }. */
export async function avaliacoesDaSemanaPorTalhao(db, empresaId, setorId, uid, semana) {
  const snap = await getDocs(consultaMinhasDaSemana(db, empresaId, setorId, uid, semana));
  return Object.fromEntries(snap.docs.map((d) => [d.data().talhaoId, comId(d)]));
}

// ---------------------------------------------------------------- escrita

/**
 * Cria a avaliação (rascunho). Não guarda "criadoEm": assim repetir a chamada (toque duplo, reenvio
 * depois de ficar offline) é só uma atualização sem mudanças, que as regras aceitam.
 * Devolve { id, promessa }: o id já serve para navegar; a promessa só resolve quando o servidor confirma.
 */
export function iniciarAvaliacao(db, empresaId, params) {
  const { id, dados } = montarCabecalho(params);
  return { id, promessa: setDoc(doc(db, ...caminhos.avaliacao(empresaId, id)), dados) };
}

/** Grava a planta inteira (substitui o documento). Não espera o servidor: o SDK guarda no aparelho e envia depois. */
export function salvarPlanta(db, empresaId, aid, { ficha, n, obs, notas, fotos }) {
  const dados = dadosDaPlanta({ ficha, n, obs, notas, fotos, atualizadoEm: serverTimestamp() });
  return setDoc(doc(db, ...caminhos.planta(empresaId, aid, n)), dados);
}

export function finalizarAvaliacao(db, empresaId, aid, campos = {}) {
  const dados = dadosParaFinalizar({ ...campos, finalizadaEm: serverTimestamp() });
  return updateDoc(doc(db, ...caminhos.avaliacao(empresaId, aid)), dados);
}

// ---------------------------------------------------------------- ouvir mudanças (inclui o que ainda não foi enviado)

/**
 * As 30 plantas de uma avaliação. `pendentes` conta os documentos gravados no aparelho que o servidor
 * ainda não confirmou (alimenta o "N itens aguardando envio"). Reinscreve sozinho se a avaliação foi criada
 * sem rede e o servidor ainda não a conhece (ver retentativa.js).
 */
export function ouvirPlantas(db, empresaId, aid, aoMudar, aoFalhar, opcoes) {
  return ouvirComRetentativa(
    (mudou, falhou) =>
      onSnapshot(
        collection(db, ...caminhos.plantas(empresaId, aid)),
        { includeMetadataChanges: true },
        (snap) => {
          const porN = {};
          let pendentes = 0;
          for (const d of snap.docs) {
            const dados = d.data();
            porN[dados.n] = { obs: dados.obs ?? {}, notas: dados.notas ?? '', fotos: dados.fotos ?? [] };
            if (d.metadata.hasPendingWrites) pendentes += 1;
          }
          mudou({ porN, pendentes, doCache: snap.metadata.fromCache });
        },
        falhou,
      ),
    aoMudar,
    aoFalhar,
    opcoes,
  );
}

export function ouvirAvaliacao(db, empresaId, aid, aoMudar, aoFalhar, opcoes) {
  return ouvirComRetentativa(
    (mudou, falhou) =>
      onSnapshot(
        doc(db, ...caminhos.avaliacao(empresaId, aid)),
        { includeMetadataChanges: true },
        (snap) => mudou(snap.exists() ? { ...snap.data(), id: snap.id, pendente: snap.metadata.hasPendingWrites } : null),
        falhou,
      ),
    aoMudar,
    aoFalhar,
    opcoes,
  );
}

/** Lê tudo o que o motor precisa de uma avaliação: cabeçalho, ficha da versão usada, plantas e ajustes. */
export async function carregarParaCalcular(db, empresaId, aid) {
  const av = comId(await getDoc(doc(db, ...caminhos.avaliacao(empresaId, aid))));
  const ficha = await carregarFicha(db, av.fichaId, av.fichaVersao);
  const plantas = (await getDocs(collection(db, ...caminhos.plantas(empresaId, aid)))).docs.map((d) => d.data()).sort((a, b) => a.n - b.n);
  const ajustes = (await getDocs(colecaoAjustes(db, empresaId))).docs.map((d) => d.data());
  return { avaliacao: av, ficha, plantas, ajustes };
}
