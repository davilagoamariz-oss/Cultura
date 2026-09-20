// Prova a migração de produção nos EMULADORES: parte do estado antigo (o que está hoje no Firebase real),
// roda a MESMA lógica de scripts/lib/migracao-v2.cjs em simulação e depois aplicando, confere que é
// idempotente e entra como davi e paulo com as firestore.rules v2 reais.
// Uso: npm run test:migracao
import { createRequire } from 'node:module';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, getDoc, getDocs, doc, setDoc } from 'firebase/firestore';
import { refAdminPlataforma, consultaMembros, consultaVinculos, colecaoSetores, colecaoUnidades, comEmpresa, comoMapa } from '../src/nucleo/consultas.js';
import { decidirEmpresa, ehAdminDaEmpresa } from '../src/nucleo/empresas.js';
import { montarMenu } from '../src/nucleo/menu.js';
import { podeAvaliar, podeDecidir, ehGerenteDoSetor } from '../src/nucleo/permissoes.js';

const require = createRequire(import.meta.url);
const { executar, PESSOAS, EMPRESA } = require('./lib/migracao-v2.cjs');
const { campos, doc: paraObjeto } = require('./lib/valores-firestore.cjs');

const FIRESTORE = 'http://127.0.0.1:8080';
const AUTH = 'http://127.0.0.1:9099';
const BASE = `${FIRESTORE}/v1/projects/demo-ronda/databases/(default)/documents`;
const CAB = { 'Content-Type': 'application/json', Authorization: 'Bearer owner' };

let falhas = 0;
const conferir = (ok, texto) => {
  console.log(`  ${ok ? 'OK ' : 'ERRO'} ${texto}`);
  if (!ok) falhas += 1;
};

// io do emulador (mesma interface que a produção usa via firebase-tools)
const io = {
  async ler(caminho) {
    const r = await fetch(`${BASE}/${caminho}`, { headers: CAB });
    if (r.status === 404) return null;
    if (!r.ok) throw new Error(`ler ${caminho}: ${r.status}`);
    return paraObjeto((await r.json()).fields);
  },
  async criar(caminho, dados) {
    const r = await fetch(`${BASE}/${caminho}?currentDocument.exists=false`, { method: 'PATCH', headers: CAB, body: JSON.stringify(campos(dados)) });
    if (r.status === 409 || r.status === 400 || r.status === 412) return 'ja_existia';
    if (!r.ok) throw new Error(`criar ${caminho}: ${r.status} ${await r.text()}`);
    return 'criado';
  },
  async trocarCampos(caminho, novos, remover = []) {
    const mascara = [...Object.keys(novos), ...remover].map((c) => `updateMask.fieldPaths=${encodeURIComponent(c)}`).join('&');
    const r = await fetch(`${BASE}/${caminho}?${mascara}&currentDocument.exists=true`, { method: 'PATCH', headers: CAB, body: JSON.stringify(campos(novos)) });
    if (!r.ok) throw new Error(`trocar ${caminho}: ${r.status} ${await r.text()}`);
  },
};

// Cria o usuário no emulador com um uid FIXO (o endpoint administrativo aceita; o público não).
async function criarUsuario(email, uid) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/demo-ronda/accounts`, {
    method: 'POST', headers: CAB,
    body: JSON.stringify({ localId: uid, email, password: 'senha123', emailVerified: true }),
  });
  const corpo = await r.json();
  if (corpo.localId !== uid) throw new Error(`Não consegui criar ${email} com o uid fixo: ${JSON.stringify(corpo)}`);
}

const app = initializeApp({ apiKey: 'chave-falsa', projectId: 'demo-ronda', appId: '1:0:web:migracao' });
const auth = getAuth(app);
connectAuthEmulator(auth, AUTH, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

async function gravarBruto(caminho, dados) {
  const r = await fetch(`${BASE}/${caminho}`, { method: 'PATCH', headers: CAB, body: JSON.stringify(campos(dados)) });
  if (!r.ok) throw new Error(`semear ${caminho}: ${r.status}`);
}

try {
  const { davi, paulo } = PESSOAS;

  console.log('0) Estado antigo, igual ao de produção');
  await criarUsuario('davi@demo.test', davi.uid);
  await criarUsuario('paulo@demo.test', paulo.uid);
  await gravarBruto(`users/${davi.uid}`, { nome: 'davi' });
  await gravarBruto(`users/${paulo.uid}`, { nome: 'paulo' });
  await gravarBruto(`empresas/${EMPRESA}`, { nome: 'Exemplo 1', status: 'ativa' });
  await gravarBruto(`empresas/${EMPRESA}/membros/${davi.uid}`, { uid: davi.uid, papel: 'admin_empresa', fazendaIds: ['*'], ativo: true, nome: 'davi' });
  await gravarBruto(`empresas/${EMPRESA}/membros/${paulo.uid}`, { uid: paulo.uid, papel: 'pragueiro', fazendaIds: ['*'], ativo: true, nome: 'paulo' });
  const antes = await io.ler(`empresas/${EMPRESA}/membros/${davi.uid}`);
  conferir('papel' in antes && !('papelEmpresa' in antes), 'o membro está no formato antigo (papel, fazendaIds)');

  console.log('\n1) Simulação não grava nada');
  const sim = await executar({ io, aplicar: false, log: () => {} });
  conferir(sim.criados === 31 && sim.membros === 2, `simulação planeja ${sim.criados} documentos e ${sim.membros} membros`);
  conferir((await io.ler(`catalogo_culturas/limao-tahiti`)) === null && (await io.ler(`plataforma_admins/${davi.uid}`)) === null, 'nada foi gravado');
  conferir('papel' in (await io.ler(`empresas/${EMPRESA}/membros/${davi.uid}`)), 'o membro continua no formato antigo');

  console.log('\n2) Aplicar');
  const ap = await executar({ io, aplicar: true, log: () => {} });
  conferir(ap.criados === 31 && ap.membros === 2 && ap.existentes === 0, `criou ${ap.criados}, migrou ${ap.membros} membros`);
  const depois = await io.ler(`empresas/${EMPRESA}/membros/${davi.uid}`);
  conferir(depois.papelEmpresa === 'admin' && !('papel' in depois) && !('fazendaIds' in depois) && depois.ativo === true && depois.nome === 'davi', 'membro do davi agora é v2 (admin), sem os campos antigos');
  const dPaulo = await io.ler(`empresas/${EMPRESA}/membros/${paulo.uid}`);
  conferir(dPaulo.papelEmpresa === 'membro' && !('papel' in dPaulo), 'membro do paulo agora é v2 (membro)');

  console.log('\n3) Rodar de novo não muda nada (idempotente)');
  const ap2 = await executar({ io, aplicar: true, log: () => {} });
  conferir(ap2.criados === 0 && ap2.membros === 0 && ap2.existentes === 31, `segunda execução: ${ap2.criados} criados, ${ap2.membros} membros, ${ap2.existentes} já existiam`);

  console.log('\n4) davi e paulo entram com as regras v2 reais');
  await signInWithEmailAndPassword(auth, 'davi@demo.test', 'senha123');
  let membros = (await getDocs(consultaMembros(db, davi.uid))).docs.map(comEmpresa);
  let vinculos = (await getDocs(consultaVinculos(db, davi.uid))).docs.map(comEmpresa);
  let dec = decidirEmpresa({ membros, ehPlataforma: (await getDoc(refAdminPlataforma(db, davi.uid))).exists() });
  const menuDe = async (v) => montarMenu({ vinculos: v.filter((x) => x.empresaId === EMPRESA), setores: comoMapa(await getDocs(colecaoSetores(db, EMPRESA))), unidades: comoMapa(await getDocs(colecaoUnidades(db, EMPRESA))) });
  let menu = await menuDe(vinculos);
  conferir(dec.status === 'ok' && dec.empresaId === EMPRESA && ehAdminDaEmpresa(dec.membro), 'davi entra na empresa Exemplo 1 como administrador');
  conferir((await getDoc(refAdminPlataforma(db, davi.uid))).exists(), 'davi é dono da plataforma');
  conferir(menu.length === 1 && menu[0].modulo.id === 'fitossanidade' && menu[0].setores[0].unidadeNome === 'Unidade 1', 'davi vê a Fitossanidade (Unidade 1)');
  const vDavi = vinculos[0];
  conferir(ehGerenteDoSetor(vDavi) && podeDecidir(vDavi) && !podeAvaliar(vDavi), 'davi é gerente e agrônomo do setor (decide e executa; não avalia)');
  const ficha = await getDoc(doc(db, 'catalogo_fichas', 'limao-tahiti', 'versoes', '1'));
  conferir(ficha.exists() && ficha.data().itens.length === 30, 'a ficha do limão (30 itens) está no catálogo e é legível');
  await signOut(auth);

  await signInWithEmailAndPassword(auth, 'paulo@demo.test', 'senha123');
  membros = (await getDocs(consultaMembros(db, paulo.uid))).docs.map(comEmpresa);
  vinculos = (await getDocs(consultaVinculos(db, paulo.uid))).docs.map(comEmpresa);
  dec = decidirEmpresa({ membros, ehPlataforma: false });
  menu = await menuDe(vinculos);
  conferir(dec.status === 'ok' && !ehAdminDaEmpresa(dec.membro), 'paulo entra na empresa como membro (não administrador)');
  conferir(menu.length === 1 && podeAvaliar(vinculos[0]) && !podeDecidir(vinculos[0]), 'paulo vê a Fitossanidade e pode avaliar (pragueiro)');
  let barrado = false;
  try { await setDoc(doc(db, 'catalogo_fichas', 'limao-tahiti', 'versoes', '2'), { adulterada: true }); } catch (e) { barrado = e.code === 'permission-denied'; }
  conferir(barrado, 'paulo não consegue alterar o catálogo');
  await signOut(auth);

  console.log(falhas === 0 ? '\nMigração verificada.' : `\n${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
} catch (erro) {
  console.error('\nFalha inesperada:', erro.code ?? '', erro.message);
  process.exit(1);
}
