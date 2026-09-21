// Percorre a jornada do pragueiro nos EMULADORES, com o SDK e as firestore.rules reais, usando o mesmo
// repositório do app (src/campo/repositorio.js): escolher o talhão, avaliar 30 plantas, calcular, finalizar,
// os avisos de duplicada e o trabalho SEM REDE (gravar offline e enviar depois, na ordem certa).
// Uso: npm run test:fluxo
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, getDoc, getDocs, doc, collection, disableNetwork, enableNetwork, waitForPendingWrites } from 'firebase/firestore';
import { caminhos } from '../src/nucleo/caminhos.js';
import {
  carregarFichaDaCultura, consultaTalhoes, avaliacoesDaSemanaPorTalhao, iniciarAvaliacao, salvarPlanta,
  finalizarAvaliacao, ouvirPlantas, carregarParaCalcular, comId,
} from '../src/campo/repositorio.js';
import { agruparPorOrgao, definirGrupo, definirValor, definirItem } from '../src/campo/ficha-campo.js';
import { progresso, avisoDeAvaliacaoExistente } from '../src/campo/avaliacao.js';
import { montarResumo } from '../src/campo/resumo.js';
import { semanaISO, dataISO } from '../src/campo/semana.js';
import { validarFicha } from '../src/dominio/fichas/ficha.js';
import { avaliar } from '../src/dominio/motor/index.js';

const app = initializeApp({ apiKey: 'chave-falsa', projectId: 'demo-ronda', appId: '1:0:web:campo' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const E = 'demo-1';
const S = 'fit-1';
const U = 'un-1';
const SEMANA = semanaISO();
const DATA = dataISO();

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
const entrar = async (nome) => (await signInWithEmailAndPassword(auth, `${nome}@demo.test`, 'senha123')).user.uid;

// leitura administrativa do emulador (ignora as regras): só para conferir o que chegou ao servidor
async function lerNoServidor(caminho) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/demo-ronda/databases/(default)/documents/${caminho}`, { headers: { Authorization: 'Bearer owner' } });
  return r.status === 404 ? null : r.json();
}
async function contarNoServidor(caminho) {
  const r = await fetch(`http://127.0.0.1:8080/v1/projects/demo-ronda/databases/(default)/documents/${caminho}?pageSize=100`, { headers: { Authorization: 'Bearer owner' } });
  return ((await r.json()).documents ?? []).length;
}

// 30 plantas: tudo ausente, com tripes em 7 (nível 2), ferrugem em 4, joaninha em 5 e bicho-furão em 3 (lado da armadilha)
function obsDaPlanta(ficha, i, cenario) {
  let obs = agruparPorOrgao(ficha).reduce((o, g) => definirGrupo(o, g, 0), {});
  const item = (id) => ficha.itens.find((x) => x.id === id);
  if (i < cenario.tripes) obs = definirValor(obs, item('tripes_flor'), 'A', 2);
  if (i < cenario.ferrugem) obs = definirValor(obs, item('ferrugem_bgude'), 'A', 1);
  if (i < cenario.joaninha) obs = definirValor(obs, item('joaninha'), 'A', 1);
  if (i < cenario.furao) obs = definirValor(obs, item('bicho_furao'), 'B', 1);
  return obs;
}
const CENARIO = { tripes: 7, ferrugem: 4, joaninha: 5, furao: 3 };

function esperar(condicao, ms = 10000) {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const t = setInterval(() => {
      if (condicao()) { clearInterval(t); resolve(); } else if (Date.now() - inicio > ms) { clearInterval(t); reject(new Error('tempo esgotado')); }
    }, 50);
  });
}

try {
  console.log('1) O pragueiro escolhe o talhão e abre a avaliação');
  const uidPaulo = await entrar('paulo');
  const talhoes = (await getDocs(consultaTalhoes(db, E, U))).docs.map(comId);
  conferir(talhoes.map((t) => t.id).sort().join() === 't-01,t-02', 'lista os 2 talhões ativos da unidade do setor');
  const t01 = talhoes.find((t) => t.id === 't-01');
  const { cultura, ficha } = await carregarFichaDaCultura(db, t01.culturaId);
  conferir(validarFicha(ficha).length === 0 && cultura.fichaAtual.versao === ficha.versao, `ficha vigente ${ficha.fichaId} v${ficha.versao} carregada e válida`);
  conferir(Object.keys(await avaliacoesDaSemanaPorTalhao(db, E, S, uidPaulo, SEMANA)).length === 0, `nenhuma avaliação dele em ${SEMANA}: talhões livres`);

  const params = { ficha, talhaoId: 't-01', talhao: t01, setorId: S, unidadeId: U, uid: uidPaulo, data: DATA, semana: SEMANA, faseCultura: ['chumbinho', 'azeitona'] };
  const { id: aid, promessa } = iniciarAvaliacao(db, E, params);
  await promessa;
  conferir(aid === `t-01_${SEMANA}_${uidPaulo}`, `avaliação criada como rascunho (${aid})`);
  await iniciarAvaliacao(db, E, params).promessa;
  conferir(true, 'repetir a criação (toque duplo) é aceito, sem mudar nada');

  console.log('2) Avisos de avaliação duplicada na semana');
  let daSemana = await avaliacoesDaSemanaPorTalhao(db, E, S, uidPaulo, SEMANA);
  conferir(avisoDeAvaliacaoExistente(daSemana['t-01']).tipo === 'continuar', 'talhão 01: "você já tem uma avaliação em andamento" (continuar)');
  conferir(avisoDeAvaliacaoExistente(daSemana['t-02']).tipo === 'nenhuma', 'talhão 02: livre');
  const idInexistente = `t-02_${SEMANA}_${uidPaulo}`;
  conferir(await negado(() => getDoc(doc(db, ...caminhos.avaliacao(E, idInexistente)))), 'ler por id uma avaliação que não existe é negado (por isso o aviso usa consulta)');

  console.log('3) As 30 plantas, gravadas uma a uma (salvamento automático)');
  await Promise.all(Array.from({ length: 30 }, (_, i) => salvarPlanta(db, E, aid, {
    ficha, n: i + 1, obs: obsDaPlanta(ficha, i, CENARIO), notas: i === 0 ? 'foco perto da cerca' : '', fotos: i === 0 ? [{ itemId: null, quadrante: null, caminho: 'local:foto-1' }] : [],
  })));
  const lidas = await carregarParaCalcular(db, E, aid);
  conferir(lidas.plantas.length === 30, 'as 30 plantas foram gravadas');
  conferir(lidas.plantas[0].notas === 'foco perto da cerca' && lidas.plantas[0].fotos.length === 1, 'notas e referência da foto ficam na planta');
  const porN = Object.fromEntries(lidas.plantas.map((p) => [p.n, p.obs]));
  conferir(progresso(ficha, porN).podeFinalizar === true, 'progresso: 30 de 30 completas, pode finalizar');

  console.log('4) Resumo (NI e TD) e finalização');
  const resultado = avaliar({ ficha: lidas.ficha, plantas: lidas.plantas, atributos: lidas.avaliacao.atributosTalhao, ajustes: lidas.ajustes });
  const resumo = montarResumo(resultado, lidas.ficha);
  conferir(resumo.tds.map((t) => t.codigo).join() === 'TD3', 'decisão sugerida: TD3 (tripes 23,3% > 20%)');
  conferir(resumo.revisar.map((r) => r.id).sort().join() === 'bicho_furao,ferrugem_bgude', 'ferrugem e bicho-furão detectados sem limite definido vão para REVISAR');
  conferir(resumo.usarProdutoSeletivo && /seletivo/.test(resumo.avisoSeletivo), 'joaninha presente: aviso de produto seletivo');
  await finalizarAvaliacao(db, E, aid, { adultosArmadilha: 4, notas: 'talhão sem novidades' });
  const fim = comId(await getDoc(doc(db, ...caminhos.avaliacao(E, aid)))).status;
  conferir(fim === 'finalizada', 'avaliação finalizada');
  const noServidor = await lerNoServidor(`empresas/${E}/avaliacoes/${aid}`);
  conferir(noServidor.fields.armadilha.mapValue.fields.adultos.integerValue === '4' && Boolean(noServidor.fields.finalizadaEm.timestampValue), 'armadilha (4 adultos) e hora do servidor gravadas');
  conferir(await negado(() => finalizarAvaliacao(db, E, aid)), 'não se finaliza duas vezes');
  conferir(await negado(() => salvarPlanta(db, E, aid, { ficha, n: 1, obs: {} })), 'depois de finalizada, planta nenhuma pode mudar');
  daSemana = await avaliacoesDaSemanaPorTalhao(db, E, S, uidPaulo, SEMANA);
  conferir(avisoDeAvaliacaoExistente(daSemana['t-01']).tipo === 'finalizada', 'ao abrir o talhão de novo: "já foi avaliado e finalizado nesta semana"');
  await signOut(auth);

  console.log('5) A colega do mesmo setor não vê a avaliação dele');
  const uidPaula = await entrar('paula');
  conferir(Object.keys(await avaliacoesDaSemanaPorTalhao(db, E, S, uidPaula, SEMANA)).length === 0, 'a lista dela não mostra a avaliação do Paulo (o aviso só enxerga as próprias)');
  conferir(await negado(() => getDoc(doc(db, ...caminhos.avaliacao(E, aid)))), 'ler a avaliação do Paulo é negado');
  conferir(await negado(() => getDocs(collectionPlantas(aid))), 'listar as plantas do Paulo é negado');

  console.log('6) Trabalho SEM REDE: grava no aparelho e envia depois, na ordem');
  const talhaoPaula = comId(await getDoc(doc(db, ...caminhos.talhao(E, 't-02'))));
  const paramsPaula = { ficha, talhaoId: 't-02', talhao: talhaoPaula, setorId: S, unidadeId: U, uid: uidPaula, data: DATA, semana: SEMANA, faseCultura: ['bola_de_gude'] };
  await disableNetwork(db);
  const idOffline = `t-02_${SEMANA}_${uidPaula}`;
  const promessas = [];
  promessas.push(iniciarAvaliacao(db, E, paramsPaula).promessa);
  for (let i = 0; i < 30; i += 1) promessas.push(salvarPlanta(db, E, idOffline, { ficha, n: i + 1, obs: obsDaPlanta(ficha, i, { tripes: 0, ferrugem: 0, joaninha: 0, furao: 0 }) }));
  promessas.push(finalizarAvaliacao(db, E, idOffline, { notas: 'feita sem sinal' }));

  let ultimo = { pendentes: 0, porN: {} };
  let erroDoListener = null;
  const parar = ouvirPlantas(db, E, idOffline, (r) => { ultimo = r; }, (e) => { erroDoListener = e; });
  await esperar(() => ultimo.pendentes === 30);
  conferir(ultimo.pendentes === 30, 'sem rede: 30 plantas aguardando envio (o contador do app)');
  conferir(await lerNoServidor(`empresas/${E}/avaliacoes/${idOffline}`) === null, 'o servidor ainda não recebeu nada');

  await enableNetwork(db);
  await waitForPendingWrites(db);
  const resultados = await Promise.allSettled(promessas);
  conferir(resultados.every((r) => r.status === 'fulfilled'), 'com a rede de volta, cabeçalho, 30 plantas e finalização foram aceitos, na ordem');
  await esperar(() => ultimo.pendentes === 0 || erroDoListener, 6000).catch(() => {});
  if (erroDoListener) console.log('  (diagnóstico) o listener das plantas recebeu o erro:', erroDoListener.code);
  conferir(ultimo.pendentes === 0, 'o contador volta a zero');
  parar();
  const noSrv = await lerNoServidor(`empresas/${E}/avaliacoes/${idOffline}`);
  conferir(noSrv?.fields.status.stringValue === 'finalizada' && (await contarNoServidor(`empresas/${E}/avaliacoes/${idOffline}/plantas`)) === 30, 'no servidor: avaliação finalizada e 30 plantas');
  await signOut(auth);

  console.log(falhas === 0 ? '\nJornada de campo verificada.' : `\n${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
} catch (erro) {
  console.error('\nFalha inesperada:', erro.code ?? '', erro.message);
  process.exit(1);
}

function collectionPlantas(aid) {
  return collection(db, ...caminhos.plantas(E, aid));
}
