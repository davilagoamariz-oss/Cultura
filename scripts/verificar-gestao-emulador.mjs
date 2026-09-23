// Percorre o acompanhamento e a gestão nos EMULADORES, com o SDK e as firestore.rules reais, usando o mesmo
// repositório do app (src/gestao): agrônomo lê e decide, gerente executa, gerente e admin gerenciam vínculos
// com histórico, e cada papel esbarra no que NÃO pode fazer.
// Usa semanas passadas para não colidir com os dados criados por verificar-campo-emulador.mjs.
// Uso: npm run test:fluxo
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, getDocs, doc, getDoc, updateDoc, setDoc, collection, query, where } from 'firebase/firestore';
import { caminhos } from '../src/nucleo/caminhos.js';
import { carregarFichaDaCultura, consultaTalhoes, iniciarAvaliacao, salvarPlanta, finalizarAvaliacao, carregarParaCalcular, consultaMinhasDaSemana, comId } from '../src/campo/repositorio.js';
import { agruparPorOrgao, definirGrupo, definirValor } from '../src/campo/ficha-campo.js';
import { semanaISO, dataISO, semanaAnterior } from '../src/campo/semana.js';
import { montarResumo } from '../src/campo/resumo.js';
import { avaliar } from '../src/dominio/motor/index.js';
import {
  consultaAvaliacoesDoSetor, consultaAvaliacoesFinalizadasDoSetor, avaliacaoDaSemanaAnterior, decisoesDeAvaliacoes, criarDecisao, executarDecisao,
  consultaDecisoesDoSetor, ouvirDecisao, consultaVinculosDoSetor, colecaoHistorico, alterarVinculo, criarVinculo, resolverNomes, listarMembros,
} from '../src/gestao/repositorio.js';
import { contarPendencias } from '../src/gestao/pendencias.js';
import { tdsSugeridos, montarDecisao } from '../src/gestao/decisao.js';
import { quemPodeAlterar, linhasDoHistorico, candidatosParaVincular } from '../src/gestao/vinculos.js';

const app = initializeApp({ apiKey: 'chave-falsa', projectId: 'demo-ronda', appId: '1:0:web:gestao' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const E = 'demo-1';
const S = 'fit-1';
const U = 'un-1';
const W = semanaAnterior(semanaAnterior(semanaISO())); // "esta semana" do painel (duas atrás)
const W_ANT = semanaAnterior(W); // semana anterior a ela
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
const sair = () => signOut(auth);

async function avaliacaoFinalizada({ uid, talhaoId, semana, cenario = {}, adultos }) {
  const talhao = comId(await getDocsUm(caminhos.talhao(E, talhaoId)));
  const { ficha } = await carregarFichaDaCultura(db, talhao.culturaId);
  const { id, promessa } = iniciarAvaliacao(db, E, { ficha, talhaoId, talhao, setorId: S, unidadeId: U, uid, data: DATA, semana, faseCultura: ['chumbinho'] });
  await promessa;
  await Promise.all(Array.from({ length: 30 }, (_, i) => {
    let obs = agruparPorOrgao(ficha).reduce((o, g) => definirGrupo(o, g, 0), {});
    const item = (x) => ficha.itens.find((y) => y.id === x);
    if (i < (cenario.tripes ?? 0)) obs = definirValor(obs, item('tripes_flor'), 'A', 2);
    if (i < (cenario.ferrugem ?? 0)) obs = definirValor(obs, item('ferrugem_bgude'), 'A', 1);
    if (i < (cenario.joaninha ?? 0)) obs = definirValor(obs, item('joaninha'), 'A', 1);
    if (i < (cenario.furao ?? 0)) obs = definirValor(obs, item('bicho_furao'), 'B', 1);
    return salvarPlanta(db, E, id, { ficha, n: i + 1, obs });
  }));
  await finalizarAvaliacao(db, E, id, adultos === undefined ? {} : { adultosArmadilha: adultos });
  return id;
}
const getDocsUm = (caminho) => getDoc(doc(db, ...caminho));
// eventos do setor com a ação dada (a trilha de auditoria: decisão, execução, vínculo), mais novos primeiro
const eventosComAcao = async (setorId, acao) =>
  (await getDocs(query(collection(db, ...caminhos.eventos(E)), where('setorId', '==', setorId), where('acao', '==', acao)))).docs.map((d) => d.data());

function esperar(condicao, ms = 8000) {
  return new Promise((resolve, reject) => {
    const inicio = Date.now();
    const t = setInterval(() => {
      if (condicao()) { clearInterval(t); resolve(); } else if (Date.now() - inicio > ms) { clearInterval(t); reject(new Error('tempo esgotado')); }
    }, 40);
  });
}
// a escuta de UMA decisão (a consulta que a tela de detalhe usa): entrega o documento ou null
async function escutarDecisao(setorId, aid) {
  let visto;
  let falha = null;
  const parar = ouvirDecisao(db, E, setorId, aid, (d) => { visto = d; }, (e) => { falha = e; });
  await esperar(() => visto !== undefined || falha).catch(() => {});
  parar();
  if (falha) throw falha;
  return visto;
}

async function rascunho({ uid, talhaoId, semana }) {
  const talhao = comId(await getDocsUm(caminhos.talhao(E, talhaoId)));
  const { ficha } = await carregarFichaDaCultura(db, talhao.culturaId);
  const { id, promessa } = iniciarAvaliacao(db, E, { ficha, talhaoId, talhao, setorId: S, unidadeId: U, uid, data: DATA, semana });
  await promessa;
  return id;
}

try {
  console.log(`0) Preparo: avaliações de campo na semana ${W} e na anterior (${W_ANT})`);
  const uidPaulo = await entrar('paulo');
  const aidTripes = await avaliacaoFinalizada({ uid: uidPaulo, talhaoId: 't-01', semana: W, cenario: { tripes: 7, ferrugem: 4, joaninha: 5, furao: 3 }, adultos: 4 });
  const aidRascunho = await rascunho({ uid: uidPaulo, talhaoId: 't-02', semana: W });
  await avaliacaoFinalizada({ uid: uidPaulo, talhaoId: 't-01', semana: W_ANT, adultos: 7 });
  await sair();
  const uidPaula = await entrar('paula');
  const aidLimpa = await avaliacaoFinalizada({ uid: uidPaula, talhaoId: 't-02', semana: W });
  await sair();
  conferir(true, 'paulo finalizou o talhão 01 (tripes, ferrugem, joaninha) e deixou o 02 em rascunho; paula finalizou o 02 limpo');

  console.log('1) O agrônomo acompanha a semana');
  const uidAgro = await entrar('agro');
  const daSemana = (await getDocs(consultaAvaliacoesDoSetor(db, E, S, W))).docs.map(comId);
  conferir(daSemana.length === 3, `vê as 3 avaliações do setor na semana ${W} (2 finalizadas e 1 em andamento)`);
  conferir(daSemana.filter((a) => a.status === 'finalizada').length === 2 && daSemana.some((a) => a.id === aidRascunho && a.status === 'rascunho'), 'distingue finalizadas de rascunho');
  const talhoes = Object.fromEntries((await getDocs(consultaTalhoes(db, E, U))).docs.map((d) => [d.id, d.data()]));
  conferir(daSemana.every((a) => talhoes[a.talhaoId]), 'os talhões vêm do cadastro (nomes para mostrar)');
  const anterior = await avaliacaoDaSemanaAnterior(db, E, S, 't-01', W_ANT);
  conferir(anterior?.armadilha?.adultos === 7, 'semana anterior do talhão 01: 7 adultos na armadilha (para cruzar as duas semanas do bicho-furão)');
  conferir((await avaliacaoDaSemanaAnterior(db, E, S, 't-02', W_ANT)) === null, 'talhão 02 não tem semana anterior finalizada');
  conferir(daSemana.find((a) => a.id === aidTripes).armadilha.adultos === 4, 'a armadilha desta semana (4 adultos) está no cabeçalho');
  conferir(await negado(() => getDocs(consultaAvaliacoesDoSetor(db, E, 'frota-1', W))), 'não lê avaliações de um setor onde não tem vínculo');

  console.log('2) O cálculo é o mesmo do campo, feito no aparelho de quem acompanha');
  const calc = await carregarParaCalcular(db, E, aidTripes);
  const resumo = montarResumo(avaliar({ ficha: calc.ficha, plantas: calc.plantas, atributos: calc.avaliacao.atributosTalhao, ajustes: calc.ajustes, referencia: calc.avaliacao.finalizadaEm }), calc.ficha);
  conferir(resumo.tds.map((t) => t.codigo).join() === 'TD3', 'talhão 01: TD3 sugerido (tripes 23,3%)');
  conferir(resumo.revisar.map((r) => r.id).sort().join() === 'bicho_furao,ferrugem_bgude', 'ferrugem e bicho-furão detectados sem limite: REVISAR');
  const calcLimpa = await carregarParaCalcular(db, E, aidLimpa);
  const resumoLimpa = montarResumo(avaliar({ ficha: calcLimpa.ficha, plantas: calcLimpa.plantas, atributos: calcLimpa.avaliacao.atributosTalhao, ajustes: calcLimpa.ajustes, referencia: calcLimpa.avaliacao.finalizadaEm }), calcLimpa.ficha);
  conferir(resumoLimpa.tds.map((t) => t.codigo).join() === 'TD1', 'talhão 02 (paula): TD1, nenhum item atingiu o nível de ação');
  conferir(tdsSugeridos(resumo).join() === 'TD3', 'a sugestão de decisão vem do cálculo (sem REVISAR, que não é decisão)');
  let recusou = false;
  try { montarDecisao({ ficha: calc.ficha, avaliacao: calc.avaliacao, uid: uidAgro, status: 'aprovada', tds: ['REVISAR'], decididoEm: 'x' }); } catch { recusou = true; }
  conferir(recusou, 'o app recusa "REVISAR" como decisão: o agrônomo precisa escolher o que fazer');

  console.log('3) O agrônomo decide (uma vez, só avaliação finalizada)');
  conferir((Object.keys(await decisoesDeAvaliacoes(db, E, S, daSemana.map((a) => a.id)))).length === 0, 'ainda não há decisões');
  conferir(await negado(() => criarDecisao(db, E, { ficha: calc.ficha, avaliacao: { ...calc.avaliacao, id: aidRascunho, status: 'finalizada' }, uid: uidAgro, status: 'aprovada', tds: ['TD3'], motivos: resumo.motivos })), 'não decide uma avaliação em rascunho (as regras conferem o estado real)');
  await criarDecisao(db, E, { ficha: calc.ficha, avaliacao: calc.avaliacao, uid: uidAgro, status: 'aprovada', tds: ['TD3'], motivos: resumo.motivos, observacao: 'aplicar inseticida amanhã cedo' });
  conferir(true, 'aprovou o talhão 01 com TD3');
  await criarDecisao(db, E, { ficha: calcLimpa.ficha, avaliacao: calcLimpa.avaliacao, uid: uidAgro, status: 'rejeitada', tds: ['TD1'], motivos: [], observacao: 'aguardar a próxima semana' });
  conferir(true, 'rejeitou o talhão 02 com explicação');
  const decisoes = await decisoesDeAvaliacoes(db, E, S, daSemana.map((a) => a.id));
  conferir(decisoes[aidTripes]?.status === 'aprovada' && decisoes[aidLimpa]?.status === 'rejeitada' && !decisoes[aidRascunho], 'as decisões aparecem por avaliação');
  const eventosDecisao = await eventosComAcao(S, 'decisao_criada');
  conferir(eventosDecisao.some((ev) => ev.alvo === aidTripes && ev.uid === uidAgro) && eventosDecisao.some((ev) => ev.alvo === aidLimpa), 'cada decisão deixou um evento de auditoria, com quem decidiu');
  await sair();
  await entrar('paulo');
  conferir(await negado(() => eventosComAcao(S, 'decisao_criada')), 'o pragueiro não lê a trilha de auditoria do setor (só admin, gerente e agrônomo)');
  await sair();
  await entrar('agro');
  conferir(await negado(() => criarDecisao(db, E, { ficha: calc.ficha, avaliacao: calc.avaliacao, uid: uidAgro, status: 'rejeitada', tds: ['TD1'], observacao: 'mudei de ideia' })), 'não decide duas vezes a mesma avaliação');
  conferir(await negado(() => executarDecisao(db, E, aidTripes, { uid: uidAgro, setorId: S })), 'o agrônomo não marca como executada (é do gerente)');

  console.log('3b) Selo de pendências: a consulta de finalizadas do setor (para o total na aba)');
  const finalizadasDoSetor = (await getDocs(consultaAvaliacoesFinalizadasDoSetor(db, E, S))).docs.map(comId);
  conferir(finalizadasDoSetor.some((a) => a.id === aidTripes) && finalizadasDoSetor.some((a) => a.id === aidLimpa), 'traz as duas avaliações finalizadas deste setor');
  conferir(finalizadasDoSetor.every((a) => a.status === 'finalizada'), 'só traz finalizadas (nunca rascunho, mesmo sem filtrar por semana)');
  const decisoesAgora = (await getDocs(consultaDecisoesDoSetor(db, E, S))).docs.map((d) => d.data());
  // outros scripts de verificação também deixam avaliações finalizadas neste setor; conferimos só as DUAS
  // desta verificação, não o total (que varia conforme o que rodou antes).
  const decididasAgora = new Set(decisoesAgora.map((d) => d.avaliacaoId));
  conferir(decididasAgora.has(aidTripes) && decididasAgora.has(aidLimpa), 'as duas avaliações decididas aqui já saem de "aguardando decisão" do agrônomo');
  const pendAgro = contarPendencias({ avaliacoes: finalizadasDoSetor, decisoes: decisoesAgora, podeDecidir: true });
  conferir(pendAgro.aguardandoDecisao === finalizadasDoSetor.length - decisoesAgora.length, 'o total "aguardando decisão" é exatamente finalizadas menos decididas');
  const pendGerente = contarPendencias({ decisoes: decisoesAgora, ehGerente: true });
  conferir(pendGerente.aguardandoExecucao >= 1, 'o gerente tem ao menos uma aprovada aguardando execução (o talhão 01, TD3)');
  await sair();

  console.log('4) Quem não é agrônomo não decide');
  for (const nome of ['paulo', 'gerente']) {
    await entrar(nome);
    conferir(await negado(() => criarDecisao(db, E, { ficha: calc.ficha, avaliacao: { ...calc.avaliacao, id: `t-02_${W}_${uidPaula}` }, uid: 'x', status: 'aprovada', tds: ['TD1'] })), `${nome} não cria decisão`);
    await sair();
  }
  await entrar('paulo');
  conferir(await negado(() => getDocs(consultaAvaliacoesDoSetor(db, E, S, W))), 'o pragueiro não lista as avaliações de todo o setor (só as dele)');
  await sair();

  console.log('5) O gerente executa');
  const uidGerente = await entrar('gerente');
  const vistas = await decisoesDeAvaliacoes(db, E, S, [aidTripes, aidLimpa]);
  conferir(vistas[aidTripes]?.tds.join() === 'TD3' && vistas[aidTripes].observacao === 'aplicar inseticida amanhã cedo', 'lê a decisão do agrônomo (TD3 e a observação)');
  conferir(await negado(() => executarDecisao(db, E, aidLimpa, { uid: uidGerente, setorId: S })), 'não executa uma decisão rejeitada');
  await executarDecisao(db, E, aidTripes, { uid: uidGerente, observacao: 'aplicado às 6h, talhão inteiro', setorId: S });
  const exec = (await decisoesDeAvaliacoes(db, E, S, [aidTripes]))[aidTripes];
  conferir(exec.status === 'executada' && exec.executadoPor === uidGerente && exec.observacaoExecucao === 'aplicado às 6h, talhão inteiro', 'marcou como executada, com quem e a observação');
  conferir((await eventosComAcao(S, 'decisao_executada')).some((ev) => ev.alvo === aidTripes && ev.uid === uidGerente), 'a execução também deixou um evento de auditoria');
  const todasDoSetor = (await getDocs(consultaDecisoesDoSetor(db, E, S))).docs.map((d) => d.data());
  const aids = todasDoSetor.map((d) => d.avaliacaoId);
  // (o script do fluxo de decisão, que roda antes, também deixa uma decisão neste setor: por isso "inclui", não "igual a 2")
  conferir(aids.includes(aidTripes) && aids.includes(aidLimpa) && todasDoSetor.every((d) => d.setorId === S), 'a lista de decisões do setor (usada na tela da semana) traz as duas desta verificação, todas do setor');
  const escutada = await escutarDecisao(S, aidTripes);
  conferir(escutada?.status === 'executada' && escutada.avaliacaoId === aidTripes, 'a escuta de uma decisão (tela de detalhe) entrega a decisão já executada');
  conferir((await escutarDecisao(S, aidRascunho)) === null, 'e entrega null quando ainda não há decisão (sem erro de permissão)');
  conferir(await negado(() => escutarDecisao('frota-1', aidTripes)), 'escutar com o setor errado é negado');
  conferir(await negado(() => executarDecisao(db, E, aidTripes, { uid: uidGerente, setorId: S })), 'não executa duas vezes');
  await sair();

  console.log('6) O gerente gerencia os vínculos do setor, com histórico');
  await entrar('gerente');
  const vinculos = (await getDocs(consultaVinculosDoSetor(db, E, S))).docs.map((d) => d.data());
  conferir(vinculos.length === 4, 'lista os 4 vínculos do setor de Fitossanidade');
  const vPaula = vinculos.find((v) => v.pessoaUid === uidPaula);
  const vPaulo = vinculos.find((v) => v.pessoaUid === uidPaulo);
  const vGerente = vinculos.find((v) => v.pessoaUid === uidGerente);
  const atorG = { uid: uidGerente, ehAdminEmpresa: false, ehGerenteDoSetor: true };
  conferir(quemPodeAlterar({ ator: atorG, alvo: vPaula }).pode && !quemPodeAlterar({ ator: atorG, alvo: vGerente }).pode, 'a interface só oferece alterar funcionários, não a si mesmo');

  await alterarVinculo(db, E, { atual: vPaula, mudancas: { ativo: false }, uid: uidGerente });
  const depois = (await getDocs(consultaVinculosDoSetor(db, E, S))).docs.map((d) => d.data()).find((v) => v.pessoaUid === uidPaula);
  conferir(depois.ativo === false && depois.versao === 2 && depois.alteradoPor === uidGerente, 'desativou a paula: versão 2, quem alterou registrado');
  let hist = (await getDocs(colecaoHistorico(db, E, uidPaula, S))).docs.map((d) => d.data());
  conferir(hist.length === 2, 'o histórico ganhou o registro da versão 2 no mesmo lote');
  conferir((await eventosComAcao(S, 'vinculo_alterado')).some((ev) => ev.alvo === `${uidPaula}_${S}` && ev.uid === uidGerente && ev.detalhe === 'ativo'), 'alterar o vínculo também deixou um evento de auditoria');

  await sair();
  await entrar('paula');
  conferir(await negado(() => getDocs(consultaMinhasDaSemana(db, E, S, uidPaula, W))), 'desativada, a paula perde o acesso às avaliações na hora');
  await sair();

  await entrar('gerente');
  await alterarVinculo(db, E, { atual: depois, mudancas: { ativo: true }, uid: uidGerente });
  await alterarVinculo(db, E, { atual: vPaulo, mudancas: { funcoes: ['pragueiro', 'agronomo'] }, uid: uidGerente });
  conferir(true, 'reativou a paula e deu também a função de agrônomo ao paulo');
  await sair();
  await entrar('paula');
  conferir(!(await negado(() => getDocs(consultaMinhasDaSemana(db, E, S, uidPaula, W)))), 'reativada, a paula volta a acessar');
  await sair();

  console.log('7) Limites do gerente: o que as regras não deixam');
  await entrar('gerente');
  const atual = (await getDocs(consultaVinculosDoSetor(db, E, S))).docs.map((d) => d.data());
  const vPaulaAtual = atual.find((v) => v.pessoaUid === uidPaula);
  const vPauloAtual = atual.find((v) => v.pessoaUid === uidPaulo);
  const vGerenteAtual = atual.find((v) => v.pessoaUid === uidGerente);
  conferir(await negado(() => alterarVinculo(db, E, { atual: vPauloAtual, mudancas: { papel: 'gerente' }, uid: uidGerente })), 'não promove um funcionário a gerente');
  conferir(await negado(() => alterarVinculo(db, E, { atual: vGerenteAtual, mudancas: { funcoes: ['agronomo'] }, uid: uidGerente })), 'não altera o próprio vínculo');
  conferir(await negado(() => updateDoc(doc(db, ...caminhos.vinculo(E, uidPaula, S)), { ativo: false })), 'não altera vínculo sem gravar o histórico (o lote é obrigatório)');
  conferir(await negado(() => setDoc(doc(db, ...caminhos.historicoVinculo(E, uidPaula, S, 9)), { versao: 9, pessoaUid: uidPaula, setorId: S, papel: 'gerente', funcoes: [], ativo: true, alteradoPor: uidGerente })), 'não forja um registro de histórico solto');
  conferir(await negado(() => alterarVinculo(db, E, { atual: { ...vPaulaAtual, setorId: 'frota-1', unidadeId: U }, mudancas: { ativo: false }, uid: uidGerente })), 'não altera vínculo de outro setor');
  await sair();

  console.log('8) O administrador promove, liga pessoas novas e lê os nomes');
  const uidAdmin = await entrar('admin');
  await alterarVinculo(db, E, { atual: vPaulaAtual, mudancas: { papel: 'gerente' }, uid: uidAdmin });
  conferir(true, 'o admin promoveu a paula a gerente (só ele pode)');
  const { permitido, membros } = await listarMembros(db, E);
  const candidatos = candidatosParaVincular(membros, (await getDocs(consultaVinculosDoSetor(db, E, S))).docs.map((d) => d.data()));
  conferir(permitido && candidatos.some((m) => m.nome === 'Sem Vínculo'), 'o admin lista os membros e vê quem ainda não tem vínculo no setor');
  const semVinculo = candidatos.find((m) => m.nome === 'Sem Vínculo');
  await criarVinculo(db, E, { pessoaUid: semVinculo.uid, setorId: S, unidadeId: U, papel: 'funcionario', funcoes: ['pragueiro'], uid: uidAdmin });
  const novoHist = (await getDocs(colecaoHistorico(db, E, semVinculo.uid, S))).docs.map((d) => d.data());
  conferir(novoHist.length === 1 && novoHist[0].versao === 1, 'ligou "Sem Vínculo" ao setor: vínculo versão 1 e histórico criados juntos');
  conferir((await eventosComAcao(S, 'vinculo_criado')).some((ev) => ev.alvo === `${semVinculo.uid}_${S}` && ev.uid === uidAdmin), 'ligar alguém ao setor também deixou um evento de auditoria');
  conferir(!candidatosParaVincular(membros, (await getDocs(consultaVinculosDoSetor(db, E, S))).docs.map((d) => d.data())).some((m) => m.uid === semVinculo.uid), 'depois disso ele deixa de ser candidato');
  const nomes = await resolverNomes(db, E, [uidPaulo, uidPaula, uidGerente]);
  conferir(nomes[uidPaula] === 'Paula Pragueira' && nomes[uidGerente] === 'Gil Gerente', 'o admin resolve os nomes das pessoas');
  await sair();

  console.log('9) A linha do tempo do vínculo da paula');
  await entrar('admin');
  hist = (await getDocs(colecaoHistorico(db, E, uidPaula, S))).docs.map((d) => d.data());
  const linha = linhasDoHistorico(hist);
  conferir(linha.length === 4 && linha.map((l) => l.versao).join() === '4,3,2,1', 'quatro registros, do mais novo ao mais antigo');
  conferir(linha[0].mudancas[0] === 'Promovido a gerente' && linha[1].mudancas[0] === 'Reativado' && linha[2].mudancas[0] === 'Desativado' && /Vínculo criado/.test(linha[3].mudancas[0]), 'promovido, reativado, desativado, criado');
  conferir(linha[0].quem === uidAdmin && linha[1].quem === uidGerente, 'cada registro diz quem fez');
  await sair();

  console.log('10) O que as regras ainda deixam de fora (lacuna dos nomes)');
  await entrar('gerente');
  const lista = await listarMembros(db, E);
  conferir(lista.permitido === false, 'o gerente NÃO lista os membros da empresa (só o admin)');
  const nomesGerente = await resolverNomes(db, E, [uidPaulo, uidPaula]);
  conferir(Object.keys(nomesGerente).length === 0, 'o gerente NÃO lê o nome dos colegas: a tela mostra um trecho do código');
  const motorista = await (async () => { await sair(); const u = await entrar('motorista'); await sair(); return u; })();
  await entrar('gerente');
  await criarVinculo(db, E, { pessoaUid: motorista, setorId: S, unidadeId: U, papel: 'funcionario', funcoes: [], uid: uidGerente });
  conferir(true, 'as regras deixam o gerente ligar quem ele já conhece pelo código, mas a tela não tem como oferecer a escolha sem listar os membros');
  await sair();

  console.log(falhas === 0 ? '\nGestão verificada.' : `\n${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
} catch (erro) {
  console.error('\nFalha inesperada:', erro.code ?? '', erro.message);
  console.error(erro.stack?.split('\n').slice(0, 4).join('\n'));
  process.exit(1);
}
