// Leitura e gravação dos cadastros da empresa (unidades, setores, talhões, ajustes de limite, membros) e a
// publicação de fichas no catálogo. Toda função recebe o `db`: o app e os scripts de verificação usam o mesmo código.
//
// Regras que moldam este arquivo (firestore.rules):
//  - todo membro ativo lê unidades, setores, talhões e ajustes; só o admin da empresa escreve;
//  - nada é apagado: desativar = ativo:false / ativa:false. Unidade do setor e do talhão não muda depois de criada;
//  - ajuste é append-only e `vigenteDe` TEM de ser o carimbo do servidor (nunca uma data escolhida por quem grava);
//  - a ficha do catálogo é imutável (versão nova = documento novo) e só o admin da plataforma publica;
//  - só o admin lista os membros; ao criar, o usuário já existe no Firebase Authentication (criado no console).
import { collection, doc, getDoc, getDocs, runTransaction, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { caminhos } from '../nucleo/caminhos.js';
import { comId } from '../campo/repositorio.js';
import { validarFicha } from '../dominio/fichas/ficha.js';
import { montarUnidade, montarSetor, montarTalhao, montarMembro } from './cadastros.js';
import { montarAjuste } from './limites.js';
import { gerarId } from './slug.js';

const lista = async (ref) => (await getDocs(ref)).docs.map(comId);

export const listarUnidades = (db, e) => lista(collection(db, ...caminhos.unidades(e)));
export const listarSetores = (db, e) => lista(collection(db, ...caminhos.setores(e)));
export const listarTalhoes = (db, e) => lista(collection(db, ...caminhos.talhoes(e)));
export const listarAjustes = (db, e) => lista(collection(db, ...caminhos.ajustes(e)));
export const listarMembrosDaEmpresa = (db, e) => lista(collection(db, ...caminhos.membros(e)));

/** Culturas do catálogo e a ficha vigente de cada uma (para o cadastro de talhão pedir os atributos certos). */
export const listarCulturas = (db) => lista(collection(db, ...caminhos.catalogoCulturas()));

// ---------------------------------------------------------------- unidades

/** Cria a unidade. O id sai do nome ("Fazenda São João" -> fazenda-sao-joao) e nunca repete o de outra. */
export async function criarUnidade(db, e, dados, existentes = []) {
  const id = gerarId(dados.nome, existentes);
  await setDoc(doc(db, ...caminhos.unidade(e, id)), { ...montarUnidade(dados), criadoEm: serverTimestamp() });
  return id;
}
export const alterarUnidade = (db, e, id, dados) => updateDoc(doc(db, ...caminhos.unidade(e, id)), montarUnidade(dados));

// ---------------------------------------------------------------- setores

export async function criarSetor(db, e, dados, existentes = []) {
  const id = gerarId(dados.nome, existentes);
  await setDoc(doc(db, ...caminhos.setor(e, id)), { ...montarSetor(dados), criadoEm: serverTimestamp() });
  return id;
}
/** A unidade do setor não muda: quem chama passa a mesma que ele já tem. */
export const alterarSetor = (db, e, id, dados) => updateDoc(doc(db, ...caminhos.setor(e, id)), montarSetor(dados));

// ---------------------------------------------------------------- talhões

export async function criarTalhao(db, e, dados, existentes = []) {
  const id = gerarId(dados.nome, existentes);
  await setDoc(doc(db, ...caminhos.talhao(e, id)), { ...montarTalhao(dados), criadoEm: serverTimestamp() });
  return id;
}
/**
 * Altera o talhão. Só vale para as avaliações NOVAS: cada avaliação guarda a cópia dos atributos do talhão de
 * quando foi feita (atributosTalhao), então o histórico não é reescrito.
 */
export const alterarTalhao = (db, e, id, dados) =>
  updateDoc(doc(db, ...caminhos.talhao(e, id)), { ...montarTalhao(dados), atualizadoEm: serverTimestamp() });

// ---------------------------------------------------------------- limites de ação

/** Acrescenta um ajuste. `vigenteDe` é a hora do servidor e `criadoPor` o usuário: as regras exigem os dois. */
export async function criarAjuste(db, e, { ficha, itemId, nivelId, entrada, motivo, uid }) {
  const dados = montarAjuste({ ficha, itemId, nivelId, entrada, motivo });
  const ref = doc(collection(db, ...caminhos.ajustes(e)));
  await setDoc(ref, { ...dados, vigenteDe: serverTimestamp(), criadoPor: uid });
  return ref.id;
}

// ---------------------------------------------------------------- membros

/** Registra quem já existe no Authentication como membro da empresa. Nunca sobrescreve um registro existente. */
export async function criarMembro(db, e, dados) {
  const m = montarMembro(dados);
  const ref = doc(db, ...caminhos.membro(e, m.uid));
  if ((await getDoc(ref)).exists()) throw new Error('Este usuário já é membro da empresa');
  await setDoc(ref, { uid: m.uid, papelEmpresa: m.papelEmpresa, ativo: m.ativo, ...(m.nome ? { nome: m.nome } : {}), criadoEm: serverTimestamp() });
  return m.uid;
}
/** Muda papel, nome ou ativo. Ninguém altera o próprio registro (regras); o uid não muda. */
export async function alterarMembro(db, e, uid, dados) {
  const m = montarMembro({ ...dados, uid });
  await updateDoc(doc(db, ...caminhos.membro(e, uid)), { papelEmpresa: m.papelEmpresa, ativo: m.ativo, ...(m.nome ? { nome: m.nome } : {}) });
}

// ---------------------------------------------------------------- catálogo (só admin da plataforma)

/**
 * Publica uma versão NOVA da ficha e a torna a vigente da cultura. A versão é a próxima da cultura; a ficha
 * publicada nunca é alterada. Confere a ficha antes de gravar (mesmo validador do catálogo local).
 */
export async function publicarFicha(db, ficha) {
  const problemas = validarFicha(ficha);
  if (problemas.length > 0) throw new Error(`Ficha inválida: ${problemas.slice(0, 3).join('; ')}`);
  return runTransaction(db, async (t) => {
    const refCultura = doc(db, ...caminhos.catalogoCultura(ficha.culturaId));
    const cultura = await t.get(refCultura);
    if (!cultura.exists()) throw new Error(`Cultura ${ficha.culturaId} não existe no catálogo`);
    const versao = (cultura.data().fichaAtual?.versao ?? 0) + 1;
    const fichaId = cultura.data().fichaAtual?.fichaId ?? ficha.fichaId;
    t.set(doc(db, ...caminhos.catalogoFicha(fichaId, versao)), { ...ficha, fichaId, versao });
    t.update(refCultura, { fichaAtual: { fichaId, versao } });
    return { fichaId, versao };
  });
}

