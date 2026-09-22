// Verifica, contra os EMULADORES e com as firestore.rules reais, o que a sessão do app calcula para
// cada usuário de demonstração: empresa, menu por módulo e permissões. Usa as MESMAS consultas e
// funções do app (src/nucleo), então o resultado é o que o usuário veria.
// Uso: npm run test:fluxo  (sobe os emuladores, semeia e roda esta verificação junto com a do fluxo).
import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator, getDoc, getDocs } from 'firebase/firestore';
import {
  refUsuario, refAdminPlataforma, consultaMembros, consultaVinculos, colecaoSetores, colecaoUnidades, comEmpresa, comoMapa,
} from '../src/nucleo/consultas.js';
import { decidirEmpresa, ehAdminDaEmpresa } from '../src/nucleo/empresas.js';
import { montarMenu, escolherSetorDoModulo } from '../src/nucleo/menu.js';
import { podeAvaliar, podeAcompanhar, podeDecidir, ehGerenteDoSetor } from '../src/nucleo/permissoes.js';

const app = initializeApp({ apiKey: 'chave-falsa', projectId: 'demo-ronda', appId: '1:0:web:sessao' });
const auth = getAuth(app);
connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
const db = getFirestore(app);
connectFirestoreEmulator(db, '127.0.0.1', 8080);

let falhas = 0;
const conferir = (ok, texto) => {
  console.log(`  ${ok ? 'OK ' : 'ERRO'} ${texto}`);
  if (!ok) falhas += 1;
};

// O que o app faria depois do login, para uma empresa já escolhida (ou a única).
async function sessaoDe(email, empresaEscolhida = null) {
  const uid = (await signInWithEmailAndPassword(auth, `${email}@demo.test`, 'senha123')).user.uid;
  const membros = (await getDocs(consultaMembros(db, uid))).docs.map(comEmpresa);
  const vinculos = (await getDocs(consultaVinculos(db, uid))).docs.map(comEmpresa);
  const ehPlataforma = (await getDoc(refAdminPlataforma(db, uid))).exists();
  const nome = (await getDoc(refUsuario(db, uid))).data()?.nome;
  const decisao = decidirEmpresa({ membros, ehPlataforma, empresaSalva: empresaEscolhida });
  let menu = [];
  if (decisao.status === 'ok') {
    const setores = comoMapa(await getDocs(colecaoSetores(db, decisao.empresaId)));
    const unidades = comoMapa(await getDocs(colecaoUnidades(db, decisao.empresaId)));
    menu = montarMenu({ vinculos: vinculos.filter((v) => v.empresaId === decisao.empresaId), setores, unidades });
  }
  const sessao = { uid, nome, decisao, ehPlataforma, menu, vinculos };
  await signOut(auth);
  return sessao;
}

const setoresDoMenu = (menu) => menu.flatMap((e) => e.setores.map((s) => `${e.modulo.id}/${s.setorId}`));

try {
  console.log('Sessão e menu por usuário (o que o app mostra depois do login)');

  let s = await sessaoDe('paulo');
  conferir(s.decisao.status === 'ok' && s.decisao.empresaId === 'demo-1', 'paulo entra direto na Fazenda Demonstração');
  conferir(setoresDoMenu(s.menu).join() === 'fitossanidade/fit-1', 'paulo vê só Fitossanidade (setor fit-1)');
  const setorPaulo = escolherSetorDoModulo(s.menu[0]);
  conferir(setorPaulo?.unidadeNome === 'Fazenda 1', `o setor tem um só, então já vem escolhido (${setorPaulo?.unidadeNome})`);
  const vPaulo = s.vinculos.find((v) => v.setorId === 'fit-1');
  conferir(podeAvaliar(vPaulo) && !podeAcompanhar(vPaulo), 'paulo pode avaliar (campo) e não acompanha');

  s = await sessaoDe('agro');
  conferir(s.decisao.status === 'escolher_empresa' && s.decisao.ativos.length === 2, 'o agrônomo consultor precisa escolher entre 2 empresas');
  for (const [empresa, setor] of [['demo-1', 'fit-1'], ['demo-2', 'fit-2']]) {
    const e = await sessaoDe('agro', empresa);
    conferir(e.decisao.status === 'ok' && setoresDoMenu(e.menu).join() === `fitossanidade/${setor}`, `agrônomo em ${empresa}: menu fitossanidade/${setor}`);
    const v = e.vinculos.find((x) => x.setorId === setor);
    conferir(podeDecidir(v) && podeAcompanhar(v) && !podeAvaliar(v), `agrônomo em ${empresa}: decide e acompanha, não avalia`);
  }

  s = await sessaoDe('gerente');
  conferir(setoresDoMenu(s.menu).join() === 'fitossanidade/fit-1', 'gerente vê Fitossanidade');
  conferir(ehGerenteDoSetor(s.vinculos[0]) && podeAcompanhar(s.vinculos[0]) && !podeAvaliar(s.vinculos[0]), 'gerente acompanha e executa; não avalia');

  s = await sessaoDe('motorista');
  conferir(s.decisao.status === 'ok' && s.vinculos.length === 1, 'motorista é membro e tem 1 vínculo (setor Frota)');
  conferir(setoresDoMenu(s.menu).join() === 'frota/frota-1', 'motorista vê Frota (é operador), não Fitossanidade');

  s = await sessaoDe('semvinculo');
  conferir(s.decisao.status === 'ok' && s.menu.length === 0, 'membro sem vínculo entra na empresa e não vê nenhum módulo');

  s = await sessaoDe('admin');
  conferir(s.decisao.status === 'ok' && ehAdminDaEmpresa(s.decisao.membro), 'admin é administrador da empresa');
  conferir(s.ehPlataforma === true, 'admin é dono da plataforma');
  conferir(s.menu.length === 0, 'admin sem vínculo em setor não vê módulos operacionais (menor privilégio)');

  s = await sessaoDe('admin2');
  conferir(s.decisao.empresaId === 'demo-2' && s.ehPlataforma === false && ehAdminDaEmpresa(s.decisao.membro), 'admin2 administra só a empresa 2 e não é dono da plataforma');

  s = await sessaoDe('pragueiro2');
  conferir(s.decisao.empresaId === 'demo-2' && setoresDoMenu(s.menu).join() === 'fitossanidade/fit-2', 'pragueiro2 vê só a Fitossanidade da empresa 2');

  console.log(falhas === 0 ? '\nSessão verificada.' : `\n${falhas} verificação(ões) falharam.`);
  process.exit(falhas === 0 ? 0 : 1);
} catch (erro) {
  console.error('\nFalha inesperada:', erro.code ?? '', erro.message);
  process.exit(1);
}
