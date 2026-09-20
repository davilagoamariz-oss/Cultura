// Consultas da sessão, num só lugar. O app (Sessao) e os scripts de verificação usam estas mesmas
// funções, então o que é testado contra os emuladores é exatamente o que o app executa.
import { collection, collectionGroup, doc, query, where } from 'firebase/firestore';
import { caminhos, GRUPO_MEMBROS, GRUPO_VINCULOS } from './caminhos.js';

export const refUsuario = (db, uid) => doc(db, ...caminhos.usuario(uid));
export const refAdminPlataforma = (db, uid) => doc(db, ...caminhos.adminPlataforma(uid));
export const refEmpresa = (db, empresaId) => doc(db, ...caminhos.empresa(empresaId));

/** Empresas do usuário: grupo de coleções "membros", só os registros dele (as regras exigem o filtro). */
export const consultaMembros = (db, uid) => query(collectionGroup(db, GRUPO_MEMBROS), where('uid', '==', uid));

/** Setores do usuário: grupo de coleções "vinculos", só os dele (as regras exigem o filtro). */
export const consultaVinculos = (db, uid) => query(collectionGroup(db, GRUPO_VINCULOS), where('pessoaUid', '==', uid));

/** Cadastros base da empresa: legíveis por todo membro ativo. */
export const colecaoSetores = (db, empresaId) => collection(db, ...caminhos.setores(empresaId));
export const colecaoUnidades = (db, empresaId) => collection(db, ...caminhos.unidades(empresaId));

/** Documento de grupo de coleções -> dado + id da empresa (vem do caminho: empresas/{id}/...). */
export const comEmpresa = (docSnap) => ({ ...docSnap.data(), empresaId: docSnap.ref.parent.parent.id });

/** Coleção -> mapa { id: dados }. */
export const comoMapa = (querySnap) => Object.fromEntries(querySnap.docs.map((d) => [d.id, d.data()]));
