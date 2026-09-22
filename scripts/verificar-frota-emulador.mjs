// Percorre o módulo Frota (maquinário) nos EMULADORES, com o SDK e as firestore.rules reais, usando o mesmo
// repositório do app (src/frota): admin cadastra a máquina, o operador começa e encerra um uso (com o
// combustível), qualquer membro sinaliza um problema leve, o admin marca urgente e conclui, e cada papel
// esbarra no que NÃO pode fazer. Usa uma empresa própria ("frota-1"), para não colidir com outros scripts.
// Uso: npm run test:fluxo (chamado por lá) ou node scripts/verificar-frota-emulador.mjs
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, doc, setDoc, getDoc, deleteField, serverTimestamp, writeBatch, Timestamp } from 'firebase/firestore';
import { caminhos } from '../src/nucleo/caminhos.js';
import { criarMaquina, editarMaquina, iniciarUso, encerrarUso, sugerirManutencao, alterarStatusManutencao, listarMaquinas } from '../src/frota/repositorio.js';

const PROJETO = 'demo-ronda';
const AUTH = process.env.AUTH_EMULATOR ?? 'http://127.0.0.1:9099';
const FIRESTORE = process.env.FIRESTORE_EMULATOR ?? 'http://127.0.0.1:8080';
const [, AUTH_PORT] = AUTH.match(/:(\d+)$/) ?? [, '9099'];
const [, FIRESTORE_PORT] = FIRESTORE.match(/:(\d+)$/) ?? [, '8080'];

for (const url of [AUTH, FIRESTORE]) {
  if (!/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(url)) {
    console.error(`Recusado: ${url} não é um emulador local.`);
    process.exit(1);
  }
}

// Escritas de preparação (empresa, membros, unidades, setores, vínculos), direto pela REST com o token
// "owner" do emulador (ignora as regras) — o mesmo truque de scripts/semear-emulador.mjs.
function valorFirestore(v) {
  if (v === null) return { nullValue: null };
  if (v instanceof Timestamp) return { timestampValue: v.toDate().toISOString() };
  if (typeof v === 'string') return { stringValue: v };
  if (typeof v === 'boolean') return { booleanValue: v };
  if (typeof v === 'number') return Number.isInteger(v) ? { integerValue: String(v) } : { doubleValue: v };
  if (Array.isArray(v)) return { arrayValue: { values: v.map(valorFirestore) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(v).map(([k, x]) => [k, valorFirestore(x)])) } };
}
async function gravar(caminho, dados) {
  const url = `${FIRESTORE}/v1/projects/${PROJETO}/databases/(default)/documents/${caminho}`;
  const r = await fetch(url, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer owner' },
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(dados).map(([k, v]) => [k, valorFirestore(v)])) }),
  });
  if (!r.ok) throw new Error(`Falha ao gravar ${caminho}: ${r.status} ${await r.text()}`);
}
async function criarUsuario(email) {
  const chamar = (metodo) =>
    fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:${metodo}?key=chave-falsa`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password: 'senha123', returnSecureToken: true }),
    });
  const corpo = await (await chamar('signUp')).json();
  if (corpo.localId) return corpo.localId;
  if (corpo.error?.message === 'EMAIL_EXISTS') return (await (await chamar('signInWithPassword')).json()).localId;
  throw new Error(`Falha ao criar ${email}: ${JSON.stringify(corpo)}`);
}

const app = initializeApp({ apiKey: 'chave-falsa', projectId: PROJETO, appId: '1:0:web:frota' });
const auth = getAuth(app);
connectAuthEmulator(auth, `http://127.0.0.1:${AUTH_PORT}`, { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', Number(FIRESTORE_PORT));

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
// para o que a própria função pura já recusa antes de qualquer escrita (nunca chega ao servidor).
const recusado = async (f) => {
  try {
    await f();
    return false;
  } catch {
    return true;
  }
};
const entrar = (email) => signInWithEmailAndPassword(auth, `${email}@frota.test`, 'senha123');
const sair = () => signOut(auth);

const E = 'frota-1';
const uidAdmin = await criarUsuario('admin@frota.test');
const uidOp = await criarUsuario('op@frota.test');
const uidOutro = await criarUsuario('outro@frota.test');
const uidSemVinculo = await criarUsuario('sem@frota.test');
const uidOutraEmpresa = await criarUsuario('outraempresa@frota.test');

await gravar(`empresas/${E}`, { nome: 'Empresa da Frota' });
await gravar('empresas/frota-2-empresa', { nome: 'Outra Empresa' });
await gravar(`empresas/frota-2-empresa/membros/${uidOutraEmpresa}`, { uid: uidOutraEmpresa, papelEmpresa: 'membro', ativo: true }); // membro ativo, mas de OUTRA empresa
for (const [u, papel] of [[uidAdmin, 'admin'], [uidOp, 'membro'], [uidOutro, 'membro'], [uidSemVinculo, 'membro']]) {
  await gravar(`empresas/${E}/membros/${u}`, { uid: u, papelEmpresa: papel, ativo: true });
}
await gravar(`empresas/${E}/unidades/un-1`, { nome: 'Fazenda 1', ativa: true });
await gravar(`empresas/${E}/unidades/un-2`, { nome: 'Fazenda 2', ativa: true });
await gravar(`empresas/${E}/setores/frota-1`, { unidadeId: 'un-1', nome: 'Frota', modulos: ['frota'], ativo: true });
await gravar(`empresas/${E}/setores/frota-2`, { unidadeId: 'un-2', nome: 'Frota Outra Fazenda', modulos: ['frota'], ativo: true });
const agora = Timestamp.now();
const vinc = (uid, setorId, unidadeId, funcoes) =>
  gravar(`empresas/${E}/vinculos/${uid}_${setorId}`, { pessoaUid: uid, setorId, unidadeId, papel: 'funcionario', funcoes, ativo: true, versao: 1, alteradoPor: uid, alteradoEm: agora });
await vinc(uidOp, 'frota-1', 'un-1', ['operador']);
await vinc(uidOutro, 'frota-1', 'un-1', []); // vinculado, sem a função operador
await vinc(uidOutro, 'frota-2', 'un-2', ['operador']); // operador, mas de OUTRA fazenda

console.log('\n== Admin cadastra a máquina ==');
await entrar('admin');
const idM = await criarMaquina(db, E, { unidadeId: 'un-1', nome: 'Trator 01', combustivel: '80' });
let m = (await listarMaquinas(db, E)).find((x) => x.id === idM);
conferir(m.disponibilidade === 'disponivel' && m.status === 'operacional' && m.ativo === true && m.combustivel === 0.8, 'máquina nasce disponível, operacional, ativa, com o combustível inicial');
conferir(await negado(() => setDoc(doc(db, ...caminhos.maquina(E, 'sem-unidade')), { unidadeId: 'nao-existe', nome: 'X', ativo: true, disponibilidade: 'disponivel', status: 'operacional', combustivel: 0.5 })), 'máquina numa unidade que não existe é negada');
conferir(await negado(() => setDoc(doc(db, ...caminhos.maquina(E, 'ja-em-uso')), { unidadeId: 'un-1', nome: 'X', ativo: true, disponibilidade: 'em_uso', status: 'operacional', combustivel: 0.5 })), 'máquina não nasce "em uso"');
await sair();
await entrar('op');
conferir(await negado(() => criarMaquina(db, E, { unidadeId: 'un-1', nome: 'Do operador', combustivel: '50' })), 'operador não cadastra máquina');
await sair();

console.log('\n== Uso (operador) ==');
await entrar('op');
const usoId = await iniciarUso(db, E, { maquina: m, maquinaId: idM, uid: uidOp, setorId: 'frota-1' });
m = (await listarMaquinas(db, E)).find((x) => x.id === idM);
conferir(m.disponibilidade === 'em_uso' && m.usoAtual?.usoId === usoId && m.usoAtual?.operadorUid === uidOp, 'máquina fica "em uso", ligada ao registro pelo usoId');
const usoAberto = await getDoc(doc(db, ...caminhos.uso(E, idM, usoId)));
conferir(usoAberto.exists() && usoAberto.data().operadorUid === uidOp && !('fimEm' in usoAberto.data()), 'registro do uso criado, ainda sem fim');
await sair();

await entrar('outro'); // vinculado ao mesmo setor, mas sem a função operador; a máquina está em_uso de verdade agora
conferir(await recusado(() => encerrarUso(db, E, { maquina: m, maquinaId: idM, uid: uidOutro, combustivel: '10' })), 'a própria função pura recusa antes de gravar (nem chega às regras)');
// mesmo contornando a função pura (escrita direta, como um cliente malicioso faria), a regra recusa
const loteEsperto = writeBatch(db);
loteEsperto.update(doc(db, ...caminhos.maquina(E, idM)), { disponibilidade: 'disponivel', combustivel: 0.1, usoAtual: deleteField() });
loteEsperto.update(doc(db, ...caminhos.uso(E, idM, usoId)), { fimEm: serverTimestamp(), combustivelFim: 0.1 });
conferir(await negado(() => loteEsperto.commit()), 'outro operador não encerra o uso de quem começou (regra, não só a função pura)');
await sair();

await entrar('op');
await encerrarUso(db, E, { maquina: m, maquinaId: idM, uid: uidOp, combustivel: '55' });
m = (await listarMaquinas(db, E)).find((x) => x.id === idM);
conferir(m.disponibilidade === 'disponivel' && !('usoAtual' in m) && m.combustivel === 0.55, 'ao encerrar: volta a disponível, some o uso atual, o combustível é o informado');
const usoFechado = await getDoc(doc(db, ...caminhos.uso(E, idM, usoId)));
conferir(usoFechado.data().combustivelFim === 0.55 && usoFechado.data().fimEm != null, 'registro do uso fechado com o combustível');
await sair();

// agora a máquina está de verdade "disponivel": testa as negativas isoladas, uma de cada vez
await entrar('outro'); // vinculado ao mesmo setor (frota-1), mas sem a função operador
conferir(await negado(() => iniciarUso(db, E, { maquina: m, maquinaId: idM, uid: uidOutro, setorId: 'frota-1' })), 'sem a função operador, não inicia uso');
conferir(await negado(() => iniciarUso(db, E, { maquina: m, maquinaId: idM, uid: uidOutro, setorId: 'frota-2' })), 'operador de outra fazenda (frota-2/un-2) não usa uma máquina de un-1');
await sair();

await entrar('op');
conferir(await recusado(() => iniciarUso(db, E, { maquina: { ...m, disponibilidade: 'em_uso', usoAtual: { usoId: 'outro', operadorUid: uidOp, setorId: 'frota-1' } }, maquinaId: idM, uid: uidOp, setorId: 'frota-1' })), 'a função pura já recusa iniciar uso numa máquina que ela mesma vê como em uso');
await sair();

console.log('\n== Manutenção ==');
await entrar('outraempresa'); // membro ativo, mas de OUTRA empresa: não pode nem sinalizar
conferir(await negado(() => sugerirManutencao(db, E, { maquina: m, maquinaId: idM, uid: uidOutraEmpresa, descricao: 'tentando de fora' })), 'membro de OUTRA empresa não sinaliza manutenção nesta máquina');
await sair();

await entrar('sem'); // sem nenhum vínculo, só membro
await sugerirManutencao(db, E, { maquina: m, maquinaId: idM, uid: uidSemVinculo, descricao: 'barulho estranho no motor' });
m = (await listarMaquinas(db, E)).find((x) => x.id === idM);
conferir(m.status === 'manutencao_sugerida', 'qualquer membro ativo sinaliza um problema leve, mesmo sem vínculo em setor nenhum');
conferir(await recusado(() => sugerirManutencao(db, E, { maquina: m, maquinaId: idM, uid: uidSemVinculo, descricao: 'de novo' })), 'não sinaliza de novo enquanto já está sinalizada (função pura)');
await sair();

await entrar('op');
conferir(await negado(() => alterarStatusManutencao(db, E, { maquina: m, maquinaId: idM, uid: uidOp, novoStatus: 'precisa_manutencao', descricao: 'x' })), 'operador não marca urgente');
await sair();

await entrar('admin');
await alterarStatusManutencao(db, E, { maquina: m, maquinaId: idM, uid: uidAdmin, novoStatus: 'precisa_manutencao', descricao: 'vazamento confirmado' });
m = (await listarMaquinas(db, E)).find((x) => x.id === idM);
conferir(m.status === 'precisa_manutencao', 'admin marca urgente');
conferir(await recusado(() => alterarStatusManutencao(db, E, { maquina: m, maquinaId: idM, uid: uidAdmin, novoStatus: 'operacional', descricao: '' })), 'concluir exige descrição (a validação do app já barra antes de gravar)');
await alterarStatusManutencao(db, E, { maquina: m, maquinaId: idM, uid: uidAdmin, novoStatus: 'operacional', descricao: 'troca da mangueira' });
m = (await listarMaquinas(db, E)).find((x) => x.id === idM);
conferir(m.status === 'operacional', 'admin conclui a manutenção, com o que foi feito');

console.log('\n== Cadastro: edição não mexe no dia a dia; setor com módulo desconhecido é negado ==');
await editarMaquina(db, E, idM, { nome: 'Trator 01 (revisado)', ativo: true });
m = (await listarMaquinas(db, E)).find((x) => x.id === idM);
conferir(m.nome === 'Trator 01 (revisado)' && m.disponibilidade === 'disponivel' && m.combustivel === 0.55, 'editar não altera disponibilidade nem combustível');
conferir(await negado(() => setDoc(doc(db, ...caminhos.setor(E, 'frota-x')), { unidadeId: 'un-1', nome: 'X', modulos: ['frota', 'colheita'], ativo: true })), 'setor com módulo desconhecido (mesmo ao lado de frota) é negado');
conferir(await negado(() => setDoc(doc(db, ...caminhos.vinculo(E, uidOp, 'frota-1')), { pessoaUid: uidOp, setorId: 'frota-1', unidadeId: 'un-1', papel: 'funcionario', funcoes: ['mecanico'], ativo: true, versao: 2, alteradoPor: uidAdmin, alteradoEm: Timestamp.now() })), 'função desconhecida no vínculo (ex.: "mecanico") é negada');
await sair();

console.log(falhas === 0 ? '\nFrota verificada: tudo certo.' : `\n${falhas} falha(s).`);
process.exit(falhas === 0 ? 0 : 1);
