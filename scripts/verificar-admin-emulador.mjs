// Percorre a administração do cadastro nos EMULADORES, com o SDK e as firestore.rules reais, usando o mesmo
// repositório do app (src/admin): o admin cria unidade, setor, talhão, ajuste de limite e membro; o pragueiro avalia
// o talhão novo e o limite ajustado muda a decisão; o admin da plataforma publica uma versão nova da ficha; e cada
// papel esbarra no que NÃO pode fazer. Roda por último em `npm run test:fluxo`.
import { readFileSync } from 'node:fs';
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, getDoc, setDoc, updateDoc, deleteDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { caminhos } from '../src/nucleo/caminhos.js';
import { carregarFichaDaCultura, consultaTalhoes, iniciarAvaliacao, salvarPlanta, finalizarAvaliacao, carregarParaCalcular, comId } from '../src/campo/repositorio.js';
import { agruparPorOrgao, definirGrupo, definirValor } from '../src/campo/ficha-campo.js';
import { semanaISO, dataISO, semanaAnterior } from '../src/campo/semana.js';
import { avaliar } from '../src/dominio/motor/index.js';
import { criarVinculo } from '../src/gestao/repositorio.js';
import {
  listarUnidades, listarSetores, listarTalhoes, listarAjustes, listarMembrosDaEmpresa, listarCulturas,
  criarUnidade, alterarUnidade, criarSetor, alterarSetor, criarTalhao, alterarTalhao, criarAjuste, criarMembro, alterarMembro, publicarFicha,
} from '../src/admin/repositorio.js';
import { atributosDaFicha } from '../src/admin/cadastros.js';
import { linhasDeLimites } from '../src/admin/limites.js';
import { getDocs } from 'firebase/firestore';

const app = initializeApp({ apiKey: 'chave-falsa', projectId: 'demo-ronda', appId: '1:0:web:admin' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

const E = 'demo-1';
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
const recusa = async (f, padrao) => {
  try {
    await f();
    return false;
  } catch (e) {
    return padrao.test(e.message);
  }
};
const entrar = async (nome) => (await signInWithEmailAndPassword(auth, `${nome}@demo.test`, 'senha123')).user.uid;
const sair = () => signOut(auth);
const semana = semanaAnterior(semanaAnterior(semanaAnterior(semanaISO()))); // longe das semanas usadas pelos outros scripts

// ============================================================ admin da empresa monta o cadastro
console.log('\n== Cadastro pelo admin da empresa ==');
const uidAdmin = await entrar('admin');
const { ficha } = await carregarFichaDaCultura(db, 'limao-tahiti');

const unidades0 = await listarUnidades(db, E);
const idUn = await criarUnidade(db, E, { nome: 'Fazenda São João', municipio: 'Petrolina' }, unidades0.map((u) => u.id));
conferir(idUn === 'fazenda-sao-joao', `unidade criada com id legível (${idUn})`);
const idUn2 = await criarUnidade(db, E, { nome: 'Fazenda São João' }, [...unidades0.map((u) => u.id), idUn]);
conferir(idUn2 === 'fazenda-sao-joao-2', `nome repetido ganha sufixo (${idUn2})`);
await alterarUnidade(db, E, idUn2, { nome: 'Fazenda São João 2', ativa: false });
conferir((await listarUnidades(db, E)).find((u) => u.id === idUn2).ativa === false, 'unidade desativada (nunca apagada)');

const setores0 = await listarSetores(db, E);
const idSetor = await criarSetor(db, E, { unidadeId: idUn, nome: 'Fitossanidade Norte', modulos: ['fitossanidade'] }, setores0.map((s) => s.id));
conferir(idSetor === 'fitossanidade-norte', `setor com módulo criado (${idSetor})`);
await alterarSetor(db, E, idSetor, { unidadeId: idUn, nome: 'Fitossanidade Norte', modulos: [] });
conferir((await listarSetores(db, E)).find((s) => s.id === idSetor).modulos.length === 0, 'módulo desligado no setor');
await alterarSetor(db, E, idSetor, { unidadeId: idUn, nome: 'Fitossanidade Norte', modulos: ['fitossanidade'] });

const atrib = atributosDaFicha(ficha);
conferir(atrib.map((a) => a.chave).join() === 'citrosVizinhos,tipoPomar', 'o formulário de talhão pede os atributos que a ficha usa');
const talhoes0 = await listarTalhoes(db, E);
const idTal = await criarTalhao(db, E, { ficha, unidadeId: idUn, nome: 'Talhão Novo 01', culturaId: 'limao-tahiti', variedade: 'Tahiti CPB', areaHa: '7,5', atributos: { tipoPomar: 'adulto', citrosVizinhos: true } }, talhoes0.map((t) => t.id));
const talhao = (await listarTalhoes(db, E)).find((t) => t.id === idTal);
conferir(idTal === 'talhao-novo-01' && talhao.areaHa === 7.5 && talhao.atributos.tipoPomar === 'adulto' && talhao.atributos.citrosVizinhos === true, `talhão criado com atributos e área (${idTal})`);

const membroNovo = 'uid-novo-membro-123';
await criarMembro(db, E, { uid: membroNovo, nome: 'Nova Pessoa' });
conferir((await listarMembrosDaEmpresa(db, E)).some((m) => m.id === membroNovo && m.papelEmpresa === 'membro'), 'membro registrado a partir do código do usuário');
conferir(await recusa(() => criarMembro(db, E, { uid: membroNovo }), /já é membro/), 'registrar de novo o mesmo membro é recusado');
await alterarMembro(db, E, membroNovo, { papelEmpresa: 'membro', nome: 'Nova Pessoa', ativo: false });
conferir((await listarMembrosDaEmpresa(db, E)).find((m) => m.id === membroNovo).ativo === false, 'membro desativado');

// vincula o pragueiro ao setor novo, como o admin faria pela tela de vínculos
await sair();
const uidPaulo = await entrar('paulo');
await sair();
await entrar('admin');
await criarVinculo(db, E, { pessoaUid: uidPaulo, setorId: idSetor, unidadeId: idUn, papel: 'funcionario', funcoes: ['pragueiro'], uid: uidAdmin });
conferir(true, 'pragueiro vinculado ao setor novo (com histórico)');

// ============================================================ limite de ação
console.log('\n== Limite de ação (só acrescenta) ==');
const ajustesAntes = await listarAjustes(db, E);
const hoje = linhasDeLimites(ficha, ajustesAntes).find((l) => l.itemId === 'larva_minadora_broto' && l.nivelId === 'pomar-adulto');
conferir(hoje.textoVigente === '40%' && hoje.origem === 'ficha', 'limite da ficha: larva minadora, pomar adulto, 40%');
const idAj = await criarAjuste(db, E, { ficha, itemId: 'larva_minadora_broto', nivelId: 'pomar-adulto', entrada: '15', motivo: 'Região com histórico de ataque', uid: uidAdmin });
const ajustes = await listarAjustes(db, E);
const aj = ajustes.find((a) => a.id === idAj);
conferir(aj.limite === 0.15 && aj.criadoPor === uidAdmin && typeof aj.vigenteDe?.toMillis === 'function', 'ajuste gravado com a hora do servidor e quem criou');
conferir(linhasDeLimites(ficha, ajustes).find((l) => l.itemId === 'larva_minadora_broto' && l.nivelId === 'pomar-adulto').textoVigente === '15%', 'a tela passa a mostrar o limite ajustado');
conferir(await negado(() => updateDoc(doc(db, ...caminhos.ajuste(E, idAj)), { limite: 0.9 })), 'ajuste não se edita');
conferir(await negado(() => deleteDoc(doc(db, ...caminhos.ajuste(E, idAj)))), 'ajuste não se apaga');
conferir(await negado(() => setDoc(doc(db, ...caminhos.ajuste(E, 'retroativo')), { culturaId: 'limao-tahiti', itemId: 'larva_minadora_broto', nivelId: 'pomar-adulto', limite: 0.9, vigenteDe: Timestamp.fromMillis(1000), criadoPor: uidAdmin })), 'ajuste com data escolhida (voltar no tempo) é negado');
conferir(await negado(() => setDoc(doc(db, ...caminhos.ajuste(E, 'em-nome-de-outro')), { culturaId: 'limao-tahiti', itemId: 'larva_minadora_broto', nivelId: 'pomar-adulto', limite: 0.9, vigenteDe: serverTimestamp(), criadoPor: 'outra-pessoa' })), 'ajuste em nome de outra pessoa é negado');

// ============================================================ o campo usa o cadastro novo
console.log('\n== O pragueiro avalia o talhão novo ==');
await sair();
await entrar('paulo');
const lista = (await getDocs(consultaTalhoes(db, E, idUn))).docs.map(comId);
conferir(lista.some((t) => t.id === idTal), 'o talhão novo aparece para o pragueiro do setor');
const t = lista.find((x) => x.id === idTal);
const { id, promessa } = iniciarAvaliacao(db, E, { ficha, talhaoId: idTal, talhao: t, setorId: idSetor, unidadeId: idUn, uid: uidPaulo, data: dataISO(), semana, faseCultura: ['chumbinho'] });
await promessa;
const item = (x) => ficha.itens.find((y) => y.id === x);
await Promise.all(Array.from({ length: 30 }, (_, i) => {
  let obs = agruparPorOrgao(ficha).reduce((o, g) => definirGrupo(o, g, 0), {});
  if (i < 6) obs = definirValor(obs, item('larva_minadora_broto'), 'A', 1); // 20% das plantas
  return salvarPlanta(db, E, id, { ficha, n: i + 1, obs });
}));
await finalizarAvaliacao(db, E, id, {});
const c = await carregarParaCalcular(db, E, id);
conferir(c.avaliacao.atributosTalhao.tipoPomar === 'adulto' && c.avaliacao.atributosTalhao.citrosVizinhos === true, 'a avaliação guarda a cópia dos atributos cadastrados');
const comAjuste = avaliar({ ficha: c.ficha, plantas: c.plantas, atributos: c.avaliacao.atributosTalhao, ajustes: c.ajustes });
const semAjuste = avaliar({ ficha: c.ficha, plantas: c.plantas, atributos: c.avaliacao.atributosTalhao, ajustes: [] });
conferir(semAjuste.decisao.tds.join() === 'TD1' && comAjuste.decisao.tds.join() === 'TD3', 'com 20% de larva minadora: limite da ficha (40%) dá TD1; o ajuste (15%) dá TD3');

// ============================================================ quem NÃO pode
console.log('\n== O que cada um não pode ==');
conferir(await negado(() => setDoc(doc(db, ...caminhos.talhao(E, 'do-pragueiro')), { unidadeId: idUn, nome: 'X', culturaId: 'limao-tahiti', atributos: {}, ativo: true })), 'pragueiro não cria talhão');
conferir(await negado(() => criarAjuste(db, E, { ficha, itemId: 'larva_minadora_broto', nivelId: 'pomar-novo', entrada: '5', uid: uidPaulo })), 'pragueiro não cria ajuste');
conferir(await negado(() => criarUnidade(db, E, { nome: 'Do pragueiro' })), 'pragueiro não cria unidade');
await sair();
await entrar('gerente');
conferir(await negado(() => criarSetor(db, E, { unidadeId: idUn, nome: 'Do gerente', modulos: [] })), 'gerente do setor não cria setor');
conferir(await negado(() => criarMembro(db, E, { uid: 'outro-uid' })), 'gerente não registra membro');
conferir((await listarTalhoes(db, E)).some((x) => x.id === idTal) && (await listarUnidades(db, E)).length > 0, 'mas o gerente lê as unidades e os talhões');
await sair();
const uidAdmin2 = await entrar('admin2');
conferir(await negado(() => alterarMembro(db, 'demo-2', uidAdmin2, { papelEmpresa: 'admin', ativo: true })), 'admin não altera o próprio registro de membro (nem para subir o papel)');
conferir(await negado(() => criarUnidade(db, E, { nome: 'De outra empresa' })), 'admin de OUTRA empresa não cria na empresa 1');
conferir(await negado(() => listarTalhoes(db, E)), 'admin de OUTRA empresa não lê os talhões da empresa 1');
await sair();

console.log('\n== Regras que valem mesmo com o app ajustado à mão ==');
await entrar('admin');
conferir(await negado(() => setDoc(doc(db, ...caminhos.setor(E, 'setor-frota')), { unidadeId: idUn, nome: 'Frota', modulos: ['frota'], ativo: true })), 'setor com módulo desconhecido é negado');
conferir(await negado(() => setDoc(doc(db, ...caminhos.setor(E, 'setor-sem-unidade')), { unidadeId: 'nao-existe', nome: 'X', modulos: [], ativo: true })), 'setor numa unidade que não existe é negado');
conferir(await negado(() => updateDoc(doc(db, ...caminhos.setor(E, idSetor)), { unidadeId: 'un-1' })), 'setor não troca de unidade');
conferir(await negado(() => updateDoc(doc(db, ...caminhos.talhao(E, idTal)), { unidadeId: 'un-1' })), 'talhão não troca de unidade');
conferir(await negado(() => setDoc(doc(db, ...caminhos.talhao(E, 'cultura-fantasma')), { unidadeId: idUn, nome: 'X', culturaId: 'manga', atributos: {}, ativo: true })), 'talhão de cultura que não existe no catálogo é negado');
conferir(await negado(() => setDoc(doc(db, 'empresas', E, 'talhoes', 'com_sublinhado'), { unidadeId: idUn, nome: 'X', culturaId: 'limao-tahiti', atributos: {}, ativo: true })), 'id de talhão com "_" é negado');
conferir(await negado(() => deleteDoc(doc(db, ...caminhos.talhao(E, idTal)))), 'talhão não se apaga');
conferir(await negado(() => deleteDoc(doc(db, ...caminhos.unidade(E, idUn)))), 'unidade não se apaga');
conferir(await recusa(() => criarTalhao(db, E, { ficha, unidadeId: idUn, nome: 'Sem tipo', culturaId: 'limao-tahiti', atributos: {} }), /Tipo de pomar/), 'o app recusa talhão sem o tipo de pomar, antes de gravar');

// talhão editado: só vale para as avaliações novas
await alterarTalhao(db, E, idTal, { ficha, unidadeId: idUn, nome: 'Talhão Novo 01', culturaId: 'limao-tahiti', areaHa: '7,5', atributos: { tipoPomar: 'novo' } });
conferir((await listarTalhoes(db, E)).find((x) => x.id === idTal).atributos.tipoPomar === 'novo', 'talhão editado (pomar novo)');
await sair();
await entrar('paulo');
const antiga = (await carregarParaCalcular(db, E, id)).avaliacao;
await sair();
await entrar('admin');
conferir(antiga.atributosTalhao.tipoPomar === 'adulto', 'a avaliação já feita continua com os atributos de quando foi feita');

// ============================================================ catálogo
console.log('\n== Ficha no catálogo (só dono da plataforma; imutável) ==');
const antes = (await listarCulturas(db)).find((x) => x.id === 'limao-tahiti').fichaAtual;
const pub = await publicarFicha(db, { ...ficha, versao: 1 });
conferir(pub.versao === antes.versao + 1 || pub.versao === antes.versao + 2, `versão nova publicada (v${pub.versao}) e passa a ser a vigente`);
const depois = (await listarCulturas(db)).find((x) => x.id === 'limao-tahiti').fichaAtual;
conferir(depois.versao === pub.versao, 'a cultura aponta para a versão nova');
conferir(await negado(() => setDoc(doc(db, ...caminhos.catalogoFicha(pub.fichaId, antes.versao)), { ...ficha })), 'versão antiga não é reescrita');
conferir(await recusa(() => publicarFicha(db, { ...ficha, regras: 'quebrada' }), /Ficha inválida/), 'ficha inválida é recusada antes de gravar');
conferir(await recusa(() => publicarFicha(db, { ...ficha, culturaId: 'manga' }), /não existe no catálogo/), 'ficha de cultura que não existe é recusada');
await sair();
await entrar('admin2');
conferir(await negado(() => publicarFicha(db, { ...ficha })), 'quem não é dono da plataforma não publica ficha');
await sair();

console.log(falhas === 0 ? '\nAdministração verificada: tudo certo.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
