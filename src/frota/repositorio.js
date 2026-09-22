// Leitura e gravação do maquinário: cadastro, uso (com o combustível) e manutenção. Toda função recebe o
// `db`, então o app e os scripts de verificação usam o mesmo código.
//
// Regras que moldam este arquivo (firestore.rules):
//  - iniciar/encerrar um uso grava a máquina E o registro em "usos" no MESMO lote, com o mesmo usoId
//    (é o que garante, nas regras, que as duas escritas combinam) — não são chamadas em sequência;
//  - sugerir/alterar o status da máquina grava a máquina E o registro em "manutencoes" juntos, por
//    consistência (não é exigido pelas regras, mas é como o app sempre faz);
//  - ler por id um documento que não existe é negado: listagens usam consulta simples.
import { collection, deleteField, doc, getDocs, onSnapshot, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { caminhos } from '../nucleo/caminhos.js';
import { comId } from '../campo/repositorio.js';
import { montarMaquina, montarEdicaoMaquina } from './cadastro.js';
import { montarInicioDeUso, montarFimDeUso, montarSugestaoDeManutencao, montarMudancaDeStatusPeloAdmin } from './uso.js';
import { gerarId } from '../admin/slug.js';

const lista = async (ref) => (await getDocs(ref)).docs.map(comId);

export const listarMaquinas = (db, e) => lista(collection(db, ...caminhos.maquinas(e)));
export const listarUsos = (db, e, maquinaId) => lista(collection(db, ...caminhos.usos(e, maquinaId)));
export const listarManutencoes = (db, e, maquinaId) => lista(collection(db, ...caminhos.manutencoes(e, maquinaId)));

export function ouvirMaquinas(db, e, aoMudar, aoFalhar) {
  return onSnapshot(collection(db, ...caminhos.maquinas(e)), { includeMetadataChanges: true }, (s) => aoMudar(s.docs.map((d) => ({ ...comId(d), pendente: d.metadata.hasPendingWrites }))), aoFalhar);
}

// ---------------------------------------------------------------- cadastro (admin)

export async function criarMaquina(db, e, dados, existentes = []) {
  const id = gerarId(dados.nome, existentes);
  await setDoc(doc(db, ...caminhos.maquina(e, id)), { ...montarMaquina(dados), criadoEm: serverTimestamp() });
  return id;
}

export const editarMaquina = (db, e, id, dados) => updateDoc(doc(db, ...caminhos.maquina(e, id)), { ...montarEdicaoMaquina(dados), atualizadoEm: serverTimestamp() });

// ---------------------------------------------------------------- uso (operador)

/** Começa um uso: gera o id que liga o registro à máquina, e grava os dois no mesmo lote. */
export async function iniciarUso(db, e, { maquina, maquinaId, uid, setorId }) {
  const usoId = doc(collection(db, ...caminhos.usos(e, maquinaId))).id;
  const { naMaquina, noUso } = montarInicioDeUso({ maquina, uid, setorId, usoId });
  const lote = writeBatch(db);
  // inicioEm entra nos dois lugares com o MESMO carimbo do servidor: as regras conferem os dois.
  lote.update(doc(db, ...caminhos.maquina(e, maquinaId)), { ...naMaquina, usoAtual: { ...naMaquina.usoAtual, inicioEm: serverTimestamp() }, atualizadoEm: serverTimestamp() });
  lote.set(doc(db, ...caminhos.uso(e, maquinaId, usoId)), { ...noUso, inicioEm: serverTimestamp() });
  await lote.commit();
  return usoId;
}

/** Encerra o uso corrente, com o combustível. */
export async function encerrarUso(db, e, { maquina, maquinaId, uid, combustivel }) {
  const { usoId, naMaquina, noUso } = montarFimDeUso({ maquina, uid, combustivel });
  const lote = writeBatch(db);
  // Firestore só apaga um campo com deleteField(): sem isso, "usoAtual" ficaria para trás.
  lote.update(doc(db, ...caminhos.maquina(e, maquinaId)), { ...naMaquina, usoAtual: deleteField() });
  lote.update(doc(db, ...caminhos.uso(e, maquinaId, usoId)), { ...noUso, fimEm: serverTimestamp() });
  await lote.commit();
}

// ---------------------------------------------------------------- manutenção

/** Qualquer membro ativo sinaliza um problema leve. */
export async function sugerirManutencao(db, e, { maquina, maquinaId, uid, descricao }) {
  const { naMaquina, log } = montarSugestaoDeManutencao({ maquina, uid, descricao });
  const lote = writeBatch(db);
  lote.update(doc(db, ...caminhos.maquina(e, maquinaId)), { ...naMaquina, atualizadoEm: serverTimestamp() });
  lote.set(doc(collection(db, ...caminhos.manutencoes(e, maquinaId))), { ...log, criadoEm: serverTimestamp() });
  await lote.commit();
}

/** Admin marca urgente ou conclui (com o que foi feito). */
export async function alterarStatusManutencao(db, e, { maquina, maquinaId, uid, novoStatus, descricao }) {
  const { naMaquina, log } = montarMudancaDeStatusPeloAdmin({ maquina, uid, novoStatus, descricao });
  const lote = writeBatch(db);
  lote.update(doc(db, ...caminhos.maquina(e, maquinaId)), { ...naMaquina, atualizadoEm: serverTimestamp() });
  lote.set(doc(collection(db, ...caminhos.manutencoes(e, maquinaId))), { ...log, criadoEm: serverTimestamp() });
  await lote.commit();
}
