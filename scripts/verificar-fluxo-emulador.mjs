// Percorre o fluxo da Fase 1 contra os EMULADORES, com o SDK do Firebase e as firestore.rules reais:
// pragueiro avalia -> motor calcula com a ficha lida do banco -> agrônomo decide -> gerente executa,
// e confere que os acessos indevidos são barrados.
// Uso: npm run emuladores (terminal 1), npm run semear (terminal 2), npm run verificar:fluxo (terminal 3).
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  getFirestore, connectFirestoreEmulator, doc, getDoc, getDocs, setDoc, updateDoc, collection, collectionGroup,
  query, where, writeBatch, serverTimestamp,
} from 'firebase/firestore';
import { caminhos, GRUPO_MEMBROS, GRUPO_VINCULOS, idAvaliacao } from '../src/nucleo/caminhos.js';
import { avaliar } from '../src/dominio/motor/index.js';
import { validarFicha } from '../src/dominio/fichas/ficha.js';

const app = initializeApp({ apiKey: 'chave-falsa', projectId: 'demo-ronda', appId: '1:0:web:verificacao' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

let falhas = 0;
const conferir = (ok, texto) => {
  console.log(`  ${ok ? 'OK ' : 'ERRO'} ${texto}`);
  if (!ok) falhas += 1;
};
const negado = async (f) => {
  try {
    await f();
    return false;
  } catch (e) {
    return e.code === 'permission-denied';
  }
};
const entrar = async (email) => (await signInWithEmailAndPassword(auth, `${email}@demo.test`, 'senha123')).user.uid;
const E = 'demo-1';
const SEMANA = '2026-W38';

async function vinculosDe(uid) {
  const membros = await getDocs(query(collectionGroup(db, GRUPO_MEMBROS), where('uid', '==', uid)));
  const vinculos = await getDocs(query(collectionGroup(db, GRUPO_VINCULOS), where('pessoaUid', '==', uid)));
  return {
    empresas: membros.docs.map((d) => ({ ...d.data(), empresaId: d.ref.parent.parent.id })),
    setores: vinculos.docs.map((d) => ({ ...d.data(), empresaId: d.ref.parent.parent.id })),
  };
}

try {
  console.log('1) Cada usuário descobre suas empresas e setores');
  for (const [email, empresasEsperadas, setoresEsperados] of [
    ['paulo', 1, 1], ['agro', 2, 2], ['motorista', 1, 1], ['semvinculo', 1, 0], ['pragueiro2', 1, 1],
  ]) {
    const uid = await entrar(email);
    const { empresas, setores } = await vinculosDe(uid);
    conferir(empresas.length === empresasEsperadas && setores.length === setoresEsperados, `${email}: ${empresas.length} empresa(s), ${setores.length} setor(es)`);
    await signOut(auth);
  }
  const consultor = await vinculosDe(await entrar('agro'));
  conferir(new Set(consultor.empresas.map((m) => m.empresaId)).size === 2, 'o agrônomo consultor pertence a duas empresas (a tela pede a escolha)');
  await signOut(auth);

  console.log('2) O pragueiro avalia o Talhão 01 com a ficha vigente lida do catálogo');
  const uidPaulo = await entrar('paulo');
  const talhao = (await getDoc(doc(db, ...caminhos.talhao(E, 't-01')))).data();
  const cultura = (await getDoc(doc(db, ...caminhos.catalogoCultura(talhao.culturaId)))).data();
  const ficha = (await getDoc(doc(db, ...caminhos.catalogoFicha(cultura.fichaAtual.fichaId, cultura.fichaAtual.versao)))).data();
  conferir(validarFicha(ficha).length === 0, `a ficha lida do banco é válida (${ficha.itens.length} itens)`);

  const aid = idAvaliacao('t-01', SEMANA, uidPaulo);
  await setDoc(doc(db, ...caminhos.avaliacao(E, aid)), {
    talhaoId: 't-01', unidadeId: 'un-1', setorId: 'fit-1', fichaId: ficha.fichaId, fichaVersao: ficha.versao,
    atributosTalhao: talhao.atributos, responsavelUid: uidPaulo, data: '2026-09-15', semanaISO: SEMANA, status: 'rascunho',
    faseCultura: ['chumbinho'], criadoEm: serverTimestamp(),
  });
  conferir(true, `avaliação ${aid} criada como rascunho`);

  // 30 plantas: tripes em 7 (23,3% > 20% -> TD3), ferrugem em 4 (sem limite -> REVISAR), joaninha em 5 (inimigo natural)
  const lote = writeBatch(db);
  for (let n = 1; n <= 30; n += 1) {
    lote.set(doc(db, ...caminhos.planta(E, aid, n)), {
      n,
      obs: {
        tripes_flor: { A: n <= 7 ? 2 : 0, B: 0 },
        ferrugem_bgude: { A: n <= 4 ? 1 : 0, B: 0 },
        joaninha: { A: n <= 5 ? 1 : 0, B: null },
      },
      atualizadoEm: serverTimestamp(),
    });
  }
  await lote.commit();
  conferir(true, '30 plantas gravadas (em lote separado do cabeçalho)');

  await updateDoc(doc(db, ...caminhos.avaliacao(E, aid)), { status: 'finalizada', finalizadaEm: serverTimestamp() });
  conferir(true, 'avaliação finalizada com carimbo de hora do servidor');
  conferir(await negado(() => updateDoc(doc(db, ...caminhos.avaliacao(E, aid)), { notas: 'editar depois de finalizar' })), 'avaliação finalizada não pode mais ser editada');
  conferir(await negado(() => setDoc(doc(db, ...caminhos.planta(E, aid, 1)), { n: 1, obs: {} })), 'planta de avaliação finalizada não pode mais ser gravada');
  await signOut(auth);

  console.log('3) Acessos indevidos são barrados');
  for (const [email, motivo] of [
    ['motorista', 'motorista (só setor Frota)'],
    ['admin', 'admin da empresa sem vínculo no setor'],
    ['semvinculo', 'membro sem vínculo'],
    ['pragueiro2', 'pragueiro de outra empresa'],
    ['admin2', 'admin de outra empresa'],
  ]) {
    await entrar(email);
    const bloqueado = await negado(() => getDoc(doc(db, ...caminhos.avaliacao(E, aid))));
    conferir(bloqueado, `${motivo} não lê a avaliação`);
    await signOut(auth);
  }

  console.log('4) O agrônomo lê os dados brutos e o motor calcula (NI e TD)');
  await entrar('agro');
  const av = (await getDoc(doc(db, ...caminhos.avaliacao(E, aid)))).data();
  const plantas = (await getDocs(collection(db, ...caminhos.plantas(E, aid)))).docs.map((d) => d.data()).sort((a, b) => a.n - b.n);
  const ajustes = (await getDocs(collection(db, ...caminhos.ajustes(E)))).docs.map((d) => d.data());
  conferir(plantas.length === 30, 'lê as 30 plantas');
  const fichaDaAvaliacao = (await getDoc(doc(db, ...caminhos.catalogoFicha(av.fichaId, av.fichaVersao)))).data();
  const resultado = avaliar({ ficha: fichaDaAvaliacao, plantas, atributos: av.atributosTalhao, ajustes, referencia: av.finalizadaEm });
  const tripes = resultado.resultados.find((r) => r.id === 'tripes_flor');
  conferir(Math.abs(tripes.ni - 7 / 30) < 1e-9 && tripes.status === 'acao', `tripes: NI ${(tripes.ni * 100).toFixed(1)}% -> ação (${tripes.td})`);
  conferir(resultado.decisao.tds.join() === 'TD3', `decisão sugerida: ${resultado.decisao.tds.join(', ')}`);
  conferir(resultado.decisao.revisarManual.some((r) => r.id === 'ferrugem_bgude'), 'ferrugem detectada sem limite definido: aparece para REVISAR (nunca vira TD1)');
  conferir(resultado.decisao.usarProdutoSeletivo === true, 'joaninha presente: aviso de produto seletivo');

  await setDoc(doc(db, ...caminhos.decisao(E, aid)), {
    avaliacaoId: aid, talhaoId: 't-01', unidadeId: 'un-1', setorId: 'fit-1', tds: resultado.decisao.tds,
    motivos: resultado.decisao.motivos.map((m) => ({ id: m.id, nivel: m.nivel, td: m.td })), status: 'aprovada',
    decididoPor: auth.currentUser.uid, decididoEm: serverTimestamp(),
  });
  conferir(true, 'agrônomo registrou a decisão (aprovada)');
  conferir(await negado(() => updateDoc(doc(db, ...caminhos.decisao(E, aid)), { status: 'rejeitada' })), 'o agrônomo não reescreve a própria decisão');
  await signOut(auth);

  console.log('5) O gerente executa');
  const uidGerente = await entrar('gerente');
  const decisao = (await getDoc(doc(db, ...caminhos.decisao(E, aid)))).data();
  conferir(decisao.status === 'aprovada' && decisao.tds.join() === 'TD3', 'o gerente lê a decisão aprovada (TD3)');
  conferir(await negado(() => setDoc(doc(db, ...caminhos.decisao(E, 'outra')), { ...decisao, avaliacaoId: 'outra' })), 'o gerente não cria decisão');
  await updateDoc(doc(db, ...caminhos.decisao(E, aid)), { status: 'executada', executadoPor: uidGerente, executadoEm: serverTimestamp(), observacaoExecucao: 'aplicação feita' });
  conferir(true, 'gerente marcou a decisão como executada');
  await signOut(auth);

  console.log(falhas === 0 ? '\nFluxo completo verificado.' : `\n${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
} catch (erro) {
  console.error('\nFalha inesperada:', erro.code ?? '', erro.message);
  console.error('Os emuladores estão rodando e semeados? (npm run emuladores; npm run semear)');
  process.exit(1);
}
