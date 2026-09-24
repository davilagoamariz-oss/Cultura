// Testes das firestore.rules v2 (empresas, unidades, setores, vínculos), com DUAS empresas.
// Rodar: npm run test:rules   (precisa de Java 21 e do firebase-tools)
import { test, before, after, beforeEach, describe } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  initializeTestEnvironment,
  assertFails,
  assertSucceeds,
} from '@firebase/rules-unit-testing';
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  collectionGroup,
  query,
  where,
  writeBatch,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ronda',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env.cleanup();
});

// ---------------------------------------------------------------- dados de teste

const A = 'empA';
const B = 'empB';
const FICHA = { fichaId: 'limao-tahiti', versao: 1 };
const ATRIBUTOS = { tipoPomar: 'adulto' };
const agora = () => Timestamp.now();

const AV1 = 't-a1_2026-W38_pragA1'; // rascunho da pragA1 (setor fit-a1)
const AV1_FIN = 't-a1_2026-W37_pragA1'; // finalizada da pragA1, com decisão aprovada
const AV1B = 't-a1_2026-W38_pragA1b'; // rascunho do colega pragA1b (mesmo setor)
const AV2 = 't-a2_2026-W38_pragA2'; // rascunho da pragA2 (setor fit-a2)
const AV2_FIN = 't-a2_2026-W37_pragA2'; // finalizada da pragA2 (setor fit-a2)

const membro = (uid, papelEmpresa = 'membro', ativo = true) => ({ uid, papelEmpresa, ativo });
const vinculo = (pessoaUid, setorId, unidadeId, papel, funcoes, ativo = true) => ({
  pessoaUid, setorId, unidadeId, papel, funcoes, ativo, versao: 1, alteradoPor: 'seed', alteradoEm: agora(),
});

// Estrutura semeada:
//  empresa A: unidades un-a1 e un-a2; setores fit-a1 (un-a1), fit-a2 (un-a2) com fitossanidade e frota-a1 (un-a1) só com "frota".
//   admA        admin da empresa (SEM vínculo em setor algum)
//   gerA1       gerente de fit-a1            gerA2   gerente de fit-a2
//   pragA1      funcionário pragueiro em fit-a1     pragA2  pragueiro em fit-a2
//   agroA       funcionário agrônomo em fit-a1
//   motA        motorista: funcionário só em frota-a1
//   inativoA    membro inativo, com vínculo ativo em fit-a1
//   semVincA    membro sem nenhum vínculo
//  empresa B: admB (admin) e pragB (pragueiro em fit-b1)
//  plat: dono da plataforma
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'plataforma_admins', 'plat'), { criadoEm: 1 });

    await setDoc(doc(db, 'catalogo_culturas', 'limao-tahiti'), { nome: 'Limão Tahiti', fichaAtual: FICHA });
    await setDoc(doc(db, 'catalogo_alvos', 'tripes'), { nome: 'Tripes', tipo: 'praga' });
    await setDoc(doc(db, 'catalogo_fichas', 'limao-tahiti', 'versoes', '1'), { fichaId: 'limao-tahiti', versao: 1 });

    for (const e of [A, B]) await setDoc(doc(db, 'empresas', e), { nome: e, status: 'ativa' });

    const membrosA = {
      admA: membro('admA', 'admin'), gerA1: membro('gerA1'), gerA2: membro('gerA2'), pragA1: membro('pragA1'),
      pragA2: membro('pragA2'), agroA: membro('agroA'), motA: membro('motA'), inativoA: membro('inativoA', 'membro', false),
      semVincA: membro('semVincA'), gerA1b: membro('gerA1b'), pragA1b: membro('pragA1b'),
    };
    for (const [uid, m] of Object.entries(membrosA)) await setDoc(doc(db, 'empresas', A, 'membros', uid), m);
    await setDoc(doc(db, 'empresas', B, 'membros', 'admB'), membro('admB', 'admin'));
    await setDoc(doc(db, 'empresas', B, 'membros', 'pragB'), membro('pragB'));

    for (const u of ['un-a1', 'un-a2']) await setDoc(doc(db, 'empresas', A, 'unidades', u), { nome: u, ativa: true });
    await setDoc(doc(db, 'empresas', B, 'unidades', 'un-b1'), { nome: 'un-b1', ativa: true });

    const setor = (unidadeId, modulos) => ({ unidadeId, nome: 'Setor', modulos, ativo: true });
    await setDoc(doc(db, 'empresas', A, 'setores', 'fit-a1'), setor('un-a1', ['fitossanidade']));
    await setDoc(doc(db, 'empresas', A, 'setores', 'fit-a2'), setor('un-a2', ['fitossanidade']));
    await setDoc(doc(db, 'empresas', A, 'setores', 'frota-a1'), setor('un-a1', ['frota']));
    await setDoc(doc(db, 'empresas', B, 'setores', 'fit-b1'), setor('un-b1', ['fitossanidade']));

    const vinculos = [
      vinculo('gerA1', 'fit-a1', 'un-a1', 'gerente', []),
      vinculo('gerA2', 'fit-a2', 'un-a2', 'gerente', []),
      vinculo('gerA1b', 'fit-a1', 'un-a1', 'gerente', []),
      vinculo('pragA1', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']),
      vinculo('pragA2', 'fit-a2', 'un-a2', 'funcionario', ['pragueiro']),
      vinculo('pragA1b', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']),
      vinculo('agroA', 'fit-a1', 'un-a1', 'funcionario', ['agronomo']),
      vinculo('motA', 'frota-a1', 'un-a1', 'funcionario', []),
      vinculo('inativoA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']),
    ];
    for (const v of vinculos) await setDoc(doc(db, 'empresas', A, 'vinculos', `${v.pessoaUid}_${v.setorId}`), v);
    await setDoc(doc(db, 'empresas', A, 'vinculos', 'pragA1_fit-a1', 'historico', '1'), {
      versao: 1, pessoaUid: 'pragA1', setorId: 'fit-a1', papel: 'funcionario', funcoes: ['pragueiro'], ativo: true, alteradoPor: 'seed', alteradoEm: agora(),
    });
    const av = (talhaoId, unidadeId, setorId, semanaISO, uid, status) => ({
      talhaoId, unidadeId, setorId, fichaId: 'limao-tahiti', fichaVersao: 1, atributosTalhao: ATRIBUTOS,
      responsavelUid: uid, data: '2026-09-15', semanaISO, status, ...(status === 'finalizada' ? { finalizadaEm: agora() } : {}),
    });
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV1), av('t-a1', 'un-a1', 'fit-a1', '2026-W38', 'pragA1', 'rascunho'));
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV1_FIN), av('t-a1', 'un-a1', 'fit-a1', '2026-W37', 'pragA1', 'finalizada'));
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV1B), av('t-a1', 'un-a1', 'fit-a1', '2026-W38', 'pragA1b', 'rascunho'));
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV2), av('t-a2', 'un-a2', 'fit-a2', '2026-W38', 'pragA2', 'rascunho'));
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV2_FIN), av('t-a2', 'un-a2', 'fit-a2', '2026-W37', 'pragA2', 'finalizada'));
    await setDoc(doc(db, 'empresas', B, 'avaliacoes', 't-b1_2026-W38_pragB'), av('t-b1', 'un-b1', 'fit-b1', '2026-W38', 'pragB', 'rascunho'));
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV1, 'plantas', '1'), { n: 1, obs: {} });
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV1_FIN, 'plantas', '1'), { n: 1, obs: {} });
    await setDoc(doc(db, 'empresas', A, 'decisoes', AV1_FIN), {
      avaliacaoId: AV1_FIN, talhaoId: 't-a1', unidadeId: 'un-a1', setorId: 'fit-a1', tds: ['TD2'], status: 'aprovada',
      decididoPor: 'agroA', decididoEm: agora(),
    });
    await setDoc(doc(db, 'empresas', B, 'vinculos', 'pragB_fit-b1'), vinculo('pragB', 'fit-b1', 'un-b1', 'funcionario', ['pragueiro']));

    const talhao = (unidadeId) => ({ unidadeId, nome: 'T', culturaId: 'limao-tahiti', atributos: ATRIBUTOS, ativo: true });
    await setDoc(doc(db, 'empresas', A, 'talhoes', 't-a1'), talhao('un-a1'));
    await setDoc(doc(db, 'empresas', A, 'talhoes', 't-a2'), talhao('un-a2'));
    await setDoc(doc(db, 'empresas', B, 'talhoes', 't-b1'), talhao('un-b1'));
  });
});

const como = (uid, claims) => env.authenticatedContext(uid, claims).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();
const p = (db, ...caminho) => doc(db, ...caminho);

// ---------------------------------------------------------------- isolamento entre empresas

describe('isolamento entre empresas (ataques)', () => {
  test('usuários da empresa B não leem nada da empresa A', async () => {
    for (const uid of ['admB', 'pragB']) {
      const db = como(uid);
      await assertFails(getDoc(p(db, 'empresas', A)));
      await assertFails(getDoc(p(db, 'empresas', A, 'unidades', 'un-a1')));
      await assertFails(getDoc(p(db, 'empresas', A, 'setores', 'fit-a1')));
      await assertFails(getDoc(p(db, 'empresas', A, 'talhoes', 't-a1')));
      await assertFails(getDoc(p(db, 'empresas', A, 'membros', 'admA')));
      await assertFails(getDoc(p(db, 'empresas', A, 'vinculos', 'pragA1_fit-a1')));
      await assertFails(getDocs(collection(db, 'empresas', A, 'talhoes')));
    }
  });

  test('usuários da empresa A não leem nem escrevem na empresa B', async () => {
    for (const uid of ['admA', 'gerA1', 'pragA1']) {
      const db = como(uid);
      await assertFails(getDoc(p(db, 'empresas', B, 'talhoes', 't-b1')));
      await assertFails(getDoc(p(db, 'empresas', B, 'setores', 'fit-b1')));
      await assertFails(setDoc(p(db, 'empresas', B, 'unidades', 'nova'), { nome: 'X', ativa: true }));
    }
  });

  test('o admin de uma empresa não cria membros na outra (nem a si mesmo)', async () => {
    await assertFails(setDoc(p(como('admA'), 'empresas', B, 'membros', 'admA'), membro('admA', 'admin')));
    await assertFails(setDoc(p(como('admB'), 'empresas', A, 'membros', 'admB'), membro('admB', 'admin')));
    await assertFails(setDoc(p(como('admB'), 'empresas', A, 'membros', 'x1'), membro('x1')));
  });

  test('sem vínculo com a empresa ou anônimo: nada', async () => {
    for (const db of [como('forasteiro'), anonimo()]) {
      await assertFails(getDoc(p(db, 'empresas', A)));
      await assertFails(getDoc(p(db, 'empresas', A, 'talhoes', 't-a1')));
      await assertFails(getDocs(collection(db, 'empresas', A, 'talhoes')));
    }
  });

  test('membro inativo perde o acesso à empresa inteira', async () => {
    const db = como('inativoA');
    await assertFails(getDoc(p(db, 'empresas', A)));
    await assertFails(getDoc(p(db, 'empresas', A, 'talhoes', 't-a1')));
    await assertFails(getDoc(p(db, 'empresas', A, 'setores', 'fit-a1')));
  });

  test('cada usuário descobre só os próprios vínculos com a empresa (grupo de coleções)', async () => {
    const db = como('pragA1');
    await assertSucceeds(getDocs(query(collectionGroup(db, 'membros'), where('uid', '==', 'pragA1'))));
    await assertFails(getDocs(query(collectionGroup(db, 'membros'), where('uid', '==', 'admA'))));
    await assertFails(getDocs(collectionGroup(db, 'membros')));
  });
});

// ---------------------------------------------------------------- perfil, plataforma, empresa, membros

describe('perfil, plataforma e membros', () => {
  test('users: só o nome, só o próprio', async () => {
    const db = como('u1');
    await assertSucceeds(setDoc(p(db, 'users', 'u1'), { nome: 'Ana' }));
    await assertFails(setDoc(p(db, 'users', 'u1'), { nome: 'Ana', papel: 'admin' }));
    await assertFails(setDoc(p(db, 'users', 'u1'), { nome: 'Ana', empresas: ['empA'] }));
    await assertFails(setDoc(p(db, 'users', 'u2'), { nome: 'Outra' }));
    await assertFails(getDoc(p(db, 'users', 'u2')));
  });

  test('plataforma_admins não é gravável pelo cliente (nem pelo dono)', async () => {
    await assertFails(setDoc(p(como('admA'), 'plataforma_admins', 'admA'), { criadoEm: 1 }));
    await assertFails(setDoc(p(como('plat'), 'plataforma_admins', 'outro'), { criadoEm: 1 }));
    await assertSucceeds(getDoc(p(como('plat'), 'plataforma_admins', 'plat')));
    await assertFails(getDoc(p(como('admA'), 'plataforma_admins', 'plat')));
  });

  test('só o dono da plataforma cria empresa e o primeiro admin; ele não lê os dados da empresa', async () => {
    await assertSucceeds(setDoc(p(como('plat'), 'empresas', 'empC'), { nome: 'C', status: 'ativa' }));
    await assertFails(setDoc(p(como('admA'), 'empresas', 'empD'), { nome: 'D', status: 'ativa' }));
    await assertSucceeds(setDoc(p(como('plat'), 'empresas', 'empC', 'membros', 'primeiro'), membro('primeiro', 'admin')));
    await assertFails(getDoc(p(como('plat'), 'empresas', A, 'talhoes', 't-a1')));
    await assertFails(getDoc(p(como('plat'), 'empresas', A, 'setores', 'fit-a1')));
    await assertFails(getDoc(p(como('plat'), 'empresas', A, 'vinculos', 'pragA1_fit-a1')));
  });

  test('admin cria e ajusta membros válidos; dados inválidos não passam', async () => {
    const db = como('admA');
    await assertSucceeds(setDoc(p(db, 'empresas', A, 'membros', 'novo'), membro('novo')));
    await assertSucceeds(updateDoc(p(db, 'empresas', A, 'membros', 'pragA1'), { ativo: false }));
    await assertFails(setDoc(p(db, 'empresas', A, 'membros', 'x1'), membro('x1', 'superadmin')));
    await assertFails(setDoc(p(db, 'empresas', A, 'membros', 'x2'), { ...membro('x2'), extra: 1 }));
    await assertFails(setDoc(p(db, 'empresas', A, 'membros', 'x3'), membro('outro')));
    await assertFails(setDoc(p(db, 'empresas', A, 'membros', 'x4'), { ...membro('x4'), ativo: 'sim' }));
  });

  test('ninguém sobe o próprio papel nem edita o próprio registro', async () => {
    await assertFails(updateDoc(p(como('pragA1'), 'empresas', A, 'membros', 'pragA1'), { papelEmpresa: 'admin' }));
    await assertFails(setDoc(p(como('gerA1'), 'empresas', A, 'membros', 'gerA1'), membro('gerA1', 'admin')));
    await assertFails(setDoc(p(como('admA'), 'empresas', A, 'membros', 'admA'), membro('admA', 'admin', false)));
  });

  test('só o admin gerencia membros: gerente, pragueiro e agrônomo não', async () => {
    for (const uid of ['gerA1', 'pragA1', 'agroA', 'motA']) {
      await assertFails(setDoc(p(como(uid), 'empresas', A, 'membros', 'novo'), membro('novo')));
      await assertFails(updateDoc(p(como(uid), 'empresas', A, 'membros', 'semVincA'), { ativo: false }));
    }
  });

  test('membro lê o próprio registro; o admin lê e lista todos; os demais não listam', async () => {
    await assertSucceeds(getDoc(p(como('pragA1'), 'empresas', A, 'membros', 'pragA1')));
    await assertFails(getDoc(p(como('pragA1'), 'empresas', A, 'membros', 'admA')));
    await assertSucceeds(getDocs(collection(como('admA'), 'empresas', A, 'membros')));
    await assertFails(getDocs(collection(como('gerA1'), 'empresas', A, 'membros')));
  });

  test('ninguém apaga membro nem empresa', async () => {
    await assertFails(deleteDoc(p(como('admA'), 'empresas', A, 'membros', 'pragA1')));
    await assertFails(deleteDoc(p(como('plat'), 'empresas', A)));
  });
});

// ---------------------------------------------------------------- cadastros base

describe('cadastros base (unidades, setores, safras, talhões)', () => {
  test('todo membro ativo lê os cadastros, inclusive quem só tem vínculo em outro setor', async () => {
    for (const uid of ['admA', 'gerA1', 'pragA1', 'motA', 'semVincA']) {
      const db = como(uid);
      await assertSucceeds(getDoc(p(db, 'empresas', A, 'unidades', 'un-a1')));
      await assertSucceeds(getDoc(p(db, 'empresas', A, 'setores', 'fit-a1')));
      await assertSucceeds(getDoc(p(db, 'empresas', A, 'talhoes', 't-a1')));
      await assertSucceeds(getDocs(collection(db, 'empresas', A, 'talhoes')));
    }
  });

  test('só o admin da empresa escreve', async () => {
    for (const uid of ['gerA1', 'pragA1', 'agroA', 'motA']) {
      const db = como(uid);
      await assertFails(setDoc(p(db, 'empresas', A, 'unidades', 'nova'), { nome: 'N', ativa: true }));
      await assertFails(updateDoc(p(db, 'empresas', A, 'talhoes', 't-a1'), { nome: 'X', atributos: ATRIBUTOS }));
      await assertFails(updateDoc(p(db, 'empresas', A, 'setores', 'fit-a1'), { modulos: [] }));
    }
    await assertSucceeds(setDoc(p(como('admA'), 'empresas', A, 'unidades', 'nova'), { nome: 'N', ativa: true, municipio: 'Petrolina' }));
  });

  test('setor: id só com letras, números e hífen; unidade tem que existir; módulo tem que ser conhecido', async () => {
    const db = como('admA');
    const novo = (extra = {}) => ({ unidadeId: 'un-a1', nome: 'Novo', modulos: ['fitossanidade'], ativo: true, ...extra });
    await assertSucceeds(setDoc(p(db, 'empresas', A, 'setores', 'fit-novo'), novo()));
    await assertFails(setDoc(p(db, 'empresas', A, 'setores', 'fit_novo'), novo())); // "_" quebraria o id do vínculo
    await assertFails(setDoc(p(db, 'empresas', A, 'setores', 'x'.repeat(61)), novo()));
    await assertFails(setDoc(p(db, 'empresas', A, 'setores', 'fit-x'), novo({ unidadeId: 'un-b1' }))); // unidade de outra empresa
    await assertSucceeds(setDoc(p(db, 'empresas', A, 'setores', 'fit-y'), novo({ modulos: ['frota'] }))); // frota já é um módulo conhecido
    await assertFails(setDoc(p(db, 'empresas', A, 'setores', 'fit-w'), novo({ modulos: ['colheita'] }))); // módulo ainda não existe
    await assertFails(setDoc(p(db, 'empresas', A, 'setores', 'fit-z'), novo({ modulos: 'fitossanidade' })));
  });

  test('setor: a unidade não muda depois de criado; o admin habilita e desabilita módulos', async () => {
    const db = como('admA');
    await assertFails(updateDoc(p(db, 'empresas', A, 'setores', 'fit-a1'), { unidadeId: 'un-a2' }));
    await assertSucceeds(updateDoc(p(db, 'empresas', A, 'setores', 'fit-a1'), { modulos: [] }));
  });

  test('talhão: id sem "_", unidade e cultura existentes, campos válidos', async () => {
    const db = como('admA');
    const novo = (extra = {}) => ({ unidadeId: 'un-a1', nome: 'T9', culturaId: 'limao-tahiti', atributos: ATRIBUTOS, ativo: true, areaHa: 5, ...extra });
    await assertSucceeds(setDoc(p(db, 'empresas', A, 'talhoes', 't-9'), novo()));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't_9'), novo()));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't-10'), novo({ unidadeId: 'un-b1' })));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't-11'), novo({ culturaId: 'cultura-que-nao-existe' })));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't-12'), novo({ areaHa: -1 })));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't-13'), novo({ atributos: 'adulto' })));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't-14'), novo({ extra: 1 })));
  });

  test('talhão: espaçamento em metros (Embrapa Doc. 183, p.11) — os dois valores, positivos e até 100', async () => {
    const db = como('admA');
    const novo = (espacamento) => ({ unidadeId: 'un-a1', nome: 'T', culturaId: 'limao-tahiti', atributos: ATRIBUTOS, ativo: true, areaHa: 5, espacamento });
    await assertSucceeds(setDoc(p(db, 'empresas', A, 'talhoes', 't-esp1'), novo({ entrePlantas: 4, entreLinhas: 6.5 })));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't-esp2'), novo({ entrePlantas: 4 }))); // falta um
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't-esp3'), novo({ entrePlantas: 0, entreLinhas: 6 })));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't-esp4'), novo({ entrePlantas: 4, entreLinhas: 101 })));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't-esp5'), novo({ entrePlantas: 4, entreLinhas: 6, extra: 1 })));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 't-esp6'), novo('4x6')));
  });

  test('talhão: a unidade não muda; atributos e nome sim', async () => {
    const db = como('admA');
    await assertFails(updateDoc(p(db, 'empresas', A, 'talhoes', 't-a1'), { unidadeId: 'un-a2' }));
    await assertSucceeds(updateDoc(p(db, 'empresas', A, 'talhoes', 't-a1'), { atributos: { tipoPomar: 'novo' }, nome: 'Renomeado' }));
  });

  test('safra: cultura do catálogo e datas no formato certo', async () => {
    const db = como('admA');
    await assertSucceeds(setDoc(p(db, 'empresas', A, 'safras', 's1'), { culturaId: 'limao-tahiti', inicio: '2026-01-01', fim: '2026-12-31', ativa: true }));
    await assertFails(setDoc(p(db, 'empresas', A, 'safras', 's2'), { culturaId: 'nao-existe', inicio: '2026-01-01' }));
    await assertFails(setDoc(p(db, 'empresas', A, 'safras', 's3'), { culturaId: 'limao-tahiti', inicio: '01/01/2026' }));
    await assertFails(setDoc(p(como('pragA1'), 'empresas', A, 'safras', 's4'), { culturaId: 'limao-tahiti', inicio: '2026-01-01' }));
  });

  test('ninguém apaga cadastro', async () => {
    for (const caminho of [['unidades', 'un-a1'], ['setores', 'fit-a1'], ['talhoes', 't-a1']]) {
      await assertFails(deleteDoc(p(como('admA'), 'empresas', A, ...caminho)));
    }
  });
});

// ---------------------------------------------------------------- ajustes de limite

describe('ajustes de limite (só acrescentam)', () => {
  // "undefined" no extra remove o campo (o SDK do Firestore não aceita valores undefined)
  const ajuste = (extra = {}) => Object.fromEntries(
    Object.entries({ culturaId: 'limao-tahiti', alvoId: 'acaro-da-ferrugem', limite: 0.1, vigenteDe: serverTimestamp(), criadoPor: 'admA', ...extra })
      .filter(([, v]) => v !== undefined),
  );

  test('o admin cria ajuste "a partir de agora"; os demais membros só leem', async () => {
    await assertSucceeds(setDoc(p(como('admA'), 'empresas', A, 'ajustes', 'aj1'), ajuste()));
    await assertSucceeds(setDoc(p(como('admA'), 'empresas', A, 'ajustes', 'aj2'), ajuste({ alvoId: undefined, itemId: 'ferrugem_bgude', nivelId: 'padrao', motivo: 'exigência do mercado' })));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'empresas', A, 'ajustes', 'existente'), { culturaId: 'limao-tahiti', alvoId: 'x', limite: 0.1, vigenteDe: agora(), criadoPor: 'admA' });
    });
    await assertSucceeds(getDoc(p(como('pragA1'), 'empresas', A, 'ajustes', 'existente')));
    await assertFails(getDoc(p(como('pragB'), 'empresas', A, 'ajustes', 'existente')));
  });

  test('não dá para voltar no tempo (vigência retroativa ou futura)', async () => {
    const db = como('admA');
    await assertFails(setDoc(p(db, 'empresas', A, 'ajustes', 'r1'), ajuste({ vigenteDe: Timestamp.fromDate(new Date('2020-01-01')) })));
    await assertFails(setDoc(p(db, 'empresas', A, 'ajustes', 'r2'), ajuste({ vigenteDe: Timestamp.fromDate(new Date(Date.now() + 86_400_000)) })));
  });

  test('não se altera nem se apaga um ajuste; criador tem que ser quem grava', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'empresas', A, 'ajustes', 'existente'), { culturaId: 'limao-tahiti', alvoId: 'x', limite: 0.1, vigenteDe: agora(), criadoPor: 'admA' });
    });
    await assertFails(updateDoc(p(como('admA'), 'empresas', A, 'ajustes', 'existente'), { limite: 0.99 }));
    await assertFails(deleteDoc(p(como('admA'), 'empresas', A, 'ajustes', 'existente')));
    await assertFails(setDoc(p(como('admA'), 'empresas', A, 'ajustes', 'f1'), ajuste({ criadoPor: 'gerA1' })));
  });

  test('só o admin da empresa cria ajuste (agrônomo, gerente e pragueiro não)', async () => {
    for (const uid of ['agroA', 'gerA1', 'pragA1', 'motA']) {
      await assertFails(setDoc(p(como(uid), 'empresas', A, 'ajustes', `x-${uid}`), ajuste({ criadoPor: uid })));
    }
    await assertFails(setDoc(p(como('admB'), 'empresas', A, 'ajustes', 'x-b'), ajuste({ criadoPor: 'admB' })));
  });

  test('ajuste inválido: sem alvo nem item, limite fora da faixa, campo extra', async () => {
    const db = como('admA');
    await assertFails(setDoc(p(db, 'empresas', A, 'ajustes', 'i1'), ajuste({ alvoId: undefined })));
    await assertFails(setDoc(p(db, 'empresas', A, 'ajustes', 'i2'), ajuste({ limite: -0.1 })));
    await assertFails(setDoc(p(db, 'empresas', A, 'ajustes', 'i3'), ajuste({ limite: 1000 })));
    await assertFails(setDoc(p(db, 'empresas', A, 'ajustes', 'i4'), ajuste({ limite: '10%' })));
    await assertFails(setDoc(p(db, 'empresas', A, 'ajustes', 'i5'), ajuste({ extra: 1 })));
  });
});

// ---------------------------------------------------------------- catálogo

describe('catálogo (culturas, alvos e fichas)', () => {
  test('qualquer autenticado lê; anônimo não', async () => {
    for (const uid of ['pragB', 'semVincA', 'forasteiro']) {
      await assertSucceeds(getDoc(p(como(uid), 'catalogo_culturas', 'limao-tahiti')));
      await assertSucceeds(getDoc(p(como(uid), 'catalogo_alvos', 'tripes')));
      await assertSucceeds(getDoc(p(como(uid), 'catalogo_fichas', 'limao-tahiti', 'versoes', '1')));
    }
    await assertFails(getDoc(p(anonimo(), 'catalogo_culturas', 'limao-tahiti')));
    await assertFails(getDoc(p(anonimo(), 'catalogo_fichas', 'limao-tahiti', 'versoes', '1')));
  });

  test('só o dono da plataforma publica; admin de empresa não altera o catálogo', async () => {
    await assertFails(setDoc(p(como('admA'), 'catalogo_culturas', 'manga'), { nome: 'Manga' }));
    await assertFails(updateDoc(p(como('admA'), 'catalogo_culturas', 'limao-tahiti'), { nome: 'X' }));
    await assertFails(setDoc(p(como('admA'), 'catalogo_alvos', 'novo'), { nome: 'Novo', tipo: 'praga' }));
    await assertSucceeds(setDoc(p(como('plat'), 'catalogo_culturas', 'manga'), { nome: 'Manga', fichaAtual: { fichaId: 'manga', versao: 1 } }));
    await assertSucceeds(setDoc(p(como('plat'), 'catalogo_alvos', 'novo'), { nome: 'Novo', tipo: 'praga' }));
  });

  test('ficha publicada é imutável: versão nova é documento novo; nem a plataforma altera ou apaga', async () => {
    const plat = como('plat');
    await assertSucceeds(setDoc(p(plat, 'catalogo_fichas', 'limao-tahiti', 'versoes', '2'), { fichaId: 'limao-tahiti', versao: 2 }));
    await assertFails(setDoc(p(plat, 'catalogo_fichas', 'limao-tahiti', 'versoes', '1'), { fichaId: 'limao-tahiti', versao: 1, adulterada: true }));
    await assertFails(updateDoc(p(plat, 'catalogo_fichas', 'limao-tahiti', 'versoes', '1'), { adulterada: true }));
    await assertFails(deleteDoc(p(plat, 'catalogo_fichas', 'limao-tahiti', 'versoes', '1')));
    await assertFails(setDoc(p(plat, 'catalogo_fichas', 'limao-tahiti', 'versoes', 'abc'), { versao: 'abc' }));
    await assertFails(setDoc(p(como('admA'), 'catalogo_fichas', 'limao-tahiti', 'versoes', '3'), { versao: 3 }));
  });
});

// ---------------------------------------------------------------- vínculos por setor

describe('vínculos por setor', () => {
  const dv = (pessoaUid, setorId, unidadeId, papel, funcoes, extra = {}) => ({
    pessoaUid, setorId, unidadeId, papel, funcoes, ativo: true, versao: 1, ...extra,
  });

  // Cria vínculo + histórico no MESMO lote (é o que as regras exigem).
  async function criar(quem, dados, { historico = true, historicoExtra = {}, id } = {}) {
    const db = como(quem);
    const ref = p(db, 'empresas', A, 'vinculos', id ?? `${dados.pessoaUid}_${dados.setorId}`);
    const lote = writeBatch(db);
    lote.set(ref, { ...dados, alteradoPor: dados.alteradoPor ?? quem, alteradoEm: dados.alteradoEm ?? serverTimestamp() });
    if (historico) {
      lote.set(doc(ref, 'historico', String(dados.versao)), {
        versao: dados.versao, pessoaUid: dados.pessoaUid, setorId: dados.setorId, papel: dados.papel,
        funcoes: dados.funcoes, ativo: dados.ativo, alteradoPor: quem, alteradoEm: serverTimestamp(), ...historicoExtra,
      });
    }
    return lote.commit();
  }

  async function estadoAtual(pessoa, sid) {
    let dados;
    await env.withSecurityRulesDisabled(async (ctx) => {
      dados = (await getDoc(doc(ctx.firestore(), 'empresas', A, 'vinculos', `${pessoa}_${sid}`))).data();
    });
    return dados;
  }

  // Altera vínculo + grava o histórico da nova versão no mesmo lote.
  async function atualizar(quem, pessoa, sid, mudancas, { saltoDeVersao = 1, historico = true, historicoExtra = {}, extraNoVinculo = {} } = {}) {
    const db = como(quem);
    const atual = await estadoAtual(pessoa, sid);
    const novo = { ...atual, ...mudancas, versao: atual.versao + saltoDeVersao };
    const ref = p(db, 'empresas', A, 'vinculos', `${pessoa}_${sid}`);
    const lote = writeBatch(db);
    lote.update(ref, { ...mudancas, versao: novo.versao, alteradoPor: quem, alteradoEm: serverTimestamp(), ...extraNoVinculo });
    if (historico) {
      lote.set(doc(ref, 'historico', String(novo.versao)), {
        versao: novo.versao, pessoaUid: pessoa, setorId: sid, papel: novo.papel, funcoes: novo.funcoes, ativo: novo.ativo,
        alteradoPor: quem, alteradoEm: serverTimestamp(), ...historicoExtra,
      });
    }
    return lote.commit();
  }

  describe('criar', () => {
    test('gerente cria FUNCIONÁRIO no próprio setor, para um membro ativo', async () => {
      await assertSucceeds(criar('gerA1', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro'])));
    });

    test('gerente NÃO cria vínculo em outro setor', async () => {
      await assertFails(criar('gerA1', dv('semVincA', 'fit-a2', 'un-a2', 'funcionario', ['pragueiro'])));
      await assertFails(criar('gerA2', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro'])));
      await assertFails(criar('gerA1', dv('semVincA', 'frota-a1', 'un-a1', 'funcionario', [])));
    });

    test('gerente NÃO cria gerente (nem para si, nem para outro): promoção é só do admin', async () => {
      await assertFails(criar('gerA1', dv('semVincA', 'fit-a1', 'un-a1', 'gerente', [])));
      await assertFails(criar('gerA1', dv('gerA1', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']))); // para si
    });

    test('só para membro ativo da própria empresa', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await deleteDoc(doc(ctx.firestore(), 'empresas', A, 'vinculos', 'inativoA_fit-a1'));
      });
      await assertFails(criar('gerA1', dv('inativoA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']))); // membro inativo
      await assertFails(criar('gerA1', dv('pessoaDeFora', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']))); // não é membro
      await assertFails(criar('gerA1', dv('pragB', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']))); // membro de outra empresa
    });

    test('o vínculo precisa do histórico no mesmo lote, e o histórico tem que ser fiel', async () => {
      await assertFails(criar('gerA1', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']), { historico: false }));
      await assertFails(criar('gerA1', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']), { historicoExtra: { papel: 'gerente' } }));
      await assertFails(criar('gerA1', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']), { historicoExtra: { alteradoPor: 'admA' } }));
      await assertFails(criar('gerA1', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']), { historicoExtra: { alteradoEm: Timestamp.fromDate(new Date('2020-01-01')) } }));
    });

    test('id, unidade, versão e auditoria precisam bater', async () => {
      const base = dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']);
      await assertFails(criar('gerA1', base, { id: 'outro-id' }));
      await assertFails(criar('gerA1', dv('semVincA', 'fit-a1', 'un-a2', 'funcionario', ['pragueiro']))); // unidade não é a do setor
      await assertFails(criar('gerA1', { ...base, versao: 2 }));
      await assertFails(criar('gerA1', { ...base, alteradoPor: 'admA' }));
      await assertFails(criar('gerA1', { ...base, alteradoEm: Timestamp.fromDate(new Date('2020-01-01')) }));
    });

    test('campos inválidos: função desconhecida, papel desconhecido, campo extra, setor inexistente', async () => {
      await assertFails(criar('admA', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['diretor'])));
      await assertFails(criar('admA', dv('semVincA', 'fit-a1', 'un-a1', 'dono', [])));
      await assertFails(criar('admA', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', [], { poder: 'total' })));
      await assertFails(criar('admA', dv('semVincA', 'setor-fantasma', 'un-a1', 'funcionario', [])));
      await assertFails(criar('admA', dv('semVincA', 'fit_a1', 'un-a1', 'funcionario', []))); // "_" no setor
    });

    test('admin da empresa cria qualquer vínculo: gerente, funcionário e o próprio (para poder operar)', async () => {
      await assertSucceeds(criar('admA', dv('semVincA', 'fit-a1', 'un-a1', 'gerente', [])));
      await assertSucceeds(criar('admA', dv('motA', 'fit-a2', 'un-a2', 'funcionario', ['agronomo'])));
      await assertSucceeds(criar('admA', dv('admA', 'fit-a1', 'un-a1', 'funcionario', ['agronomo'])));
    });

    test('funcionário, agrônomo, motorista e membro sem vínculo não criam vínculo', async () => {
      for (const uid of ['pragA1', 'agroA', 'motA', 'semVincA']) {
        await assertFails(criar(uid, dv('gerA2', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro'])));
      }
    });

    test('ninguém se auto-promove criando o próprio vínculo de gerente', async () => {
      await assertFails(criar('semVincA', dv('semVincA', 'fit-a1', 'un-a1', 'gerente', [])));
      await assertFails(criar('semVincA', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro'])));
    });

    test('admin de outra empresa não cria vínculo aqui; gerente inativo ou de membro inativo não cria', async () => {
      await assertFails(criar('admB', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro'])));
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'empresas', A, 'vinculos', 'gerA1_fit-a1'), { ativo: false });
      });
      await assertFails(criar('gerA1', dv('semVincA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro'])));
    });
  });

  describe('alterar', () => {
    test('gerente desativa e ajusta funções de FUNCIONÁRIO do próprio setor, com histórico', async () => {
      await assertSucceeds(atualizar('gerA1', 'pragA1', 'fit-a1', { ativo: false }));
      await assertSucceeds(atualizar('gerA1', 'agroA', 'fit-a1', { funcoes: ['agronomo', 'pragueiro'] }));
    });

    test('gerente NÃO promove funcionário a gerente', async () => {
      await assertFails(atualizar('gerA1', 'pragA1', 'fit-a1', { papel: 'gerente' }));
    });

    test('gerente NÃO se promove nem altera o próprio vínculo', async () => {
      await assertFails(atualizar('gerA1', 'gerA1', 'fit-a1', { papel: 'gerente', funcoes: ['agronomo'] }));
      await assertFails(atualizar('gerA1', 'gerA1', 'fit-a1', { ativo: false }));
      await assertFails(atualizar('gerA1', 'gerA1', 'fit-a1', { funcoes: ['agronomo'] }));
    });

    test('gerente NÃO altera outro gerente, nem vínculo de outro setor', async () => {
      await assertFails(atualizar('gerA1', 'gerA1b', 'fit-a1', { ativo: false }));
      await assertFails(atualizar('gerA2', 'pragA1', 'fit-a1', { ativo: false })); // gerente de fit-a2 no setor fit-a1
      await assertFails(atualizar('gerA1', 'pragA2', 'fit-a2', { ativo: false })); // gerente de fit-a1 no setor fit-a2
      await assertFails(atualizar('gerA1', 'motA', 'frota-a1', { ativo: false }));
    });

    test('funcionário NÃO altera o próprio vínculo (ativo, funções ou papel)', async () => {
      await assertFails(atualizar('pragA1', 'pragA1', 'fit-a1', { funcoes: ['pragueiro', 'agronomo'] }));
      await assertFails(atualizar('pragA1', 'pragA1', 'fit-a1', { papel: 'gerente' }));
      await assertFails(atualizar('pragA1', 'pragA1', 'fit-a1', { ativo: false }));
      await assertFails(atualizar('agroA', 'pragA1', 'fit-a1', { ativo: false })); // colega
    });

    test('só o admin promove a gerente e mexe em gerente', async () => {
      await assertSucceeds(atualizar('admA', 'pragA1', 'fit-a1', { papel: 'gerente' }));
      await assertSucceeds(atualizar('admA', 'gerA1b', 'fit-a1', { ativo: false }));
    });

    test('toda alteração exige a versão seguinte e o histórico correspondente', async () => {
      await assertFails(atualizar('gerA1', 'pragA1', 'fit-a1', { ativo: false }, { historico: false }));
      await assertFails(atualizar('gerA1', 'pragA1', 'fit-a1', { ativo: false }, { saltoDeVersao: 2 }));
      await assertFails(atualizar('gerA1', 'pragA1', 'fit-a1', { ativo: false }, { saltoDeVersao: 0 }));
      await assertFails(atualizar('gerA1', 'pragA1', 'fit-a1', { ativo: false }, { historicoExtra: { ativo: true } }));
      await assertFails(atualizar('gerA1', 'pragA1', 'fit-a1', { ativo: false }, { historicoExtra: { alteradoPor: 'admA' } }));
    });

    test('pessoa, setor e unidade do vínculo nunca mudam; campos fora da lista também não', async () => {
      await assertFails(atualizar('admA', 'pragA1', 'fit-a1', { pessoaUid: 'pragA2' }));
      await assertFails(atualizar('admA', 'pragA1', 'fit-a1', { setorId: 'fit-a2' }));
      await assertFails(atualizar('admA', 'pragA1', 'fit-a1', { unidadeId: 'un-a2' }));
      await assertFails(atualizar('admA', 'pragA1', 'fit-a1', { ativo: false }, { extraNoVinculo: { poder: 'total' } }));
    });

    test('gerente com vínculo desativado, ou membro inativo, perde o poder', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'empresas', A, 'vinculos', 'gerA1_fit-a1'), { ativo: false });
      });
      await assertFails(atualizar('gerA1', 'pragA1', 'fit-a1', { ativo: false }));
    });

    test('membro inativo (mesmo com vínculo de gerente ativo) não altera nada', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'empresas', A, 'membros', 'gerA1'), { ativo: false });
      });
      await assertFails(atualizar('gerA1', 'pragA1', 'fit-a1', { ativo: false }));
    });

    test('admin de outra empresa não altera', async () => {
      await assertFails(atualizar('admB', 'pragA1', 'fit-a1', { ativo: false }));
    });

    test('ninguém apaga vínculo', async () => {
      for (const uid of ['admA', 'gerA1', 'pragA1']) {
        await assertFails(deleteDoc(p(como(uid), 'empresas', A, 'vinculos', 'pragA1_fit-a1')));
      }
    });
  });

  describe('ler', () => {
    test('a pessoa lê os próprios vínculos; o gerente lê os do setor; o admin lê todos', async () => {
      await assertSucceeds(getDoc(p(como('pragA1'), 'empresas', A, 'vinculos', 'pragA1_fit-a1')));
      await assertFails(getDoc(p(como('pragA1'), 'empresas', A, 'vinculos', 'agroA_fit-a1'))); // colega
      await assertSucceeds(getDoc(p(como('gerA1'), 'empresas', A, 'vinculos', 'pragA1_fit-a1')));
      await assertFails(getDoc(p(como('gerA1'), 'empresas', A, 'vinculos', 'pragA2_fit-a2'))); // outro setor
      await assertSucceeds(getDoc(p(como('admA'), 'empresas', A, 'vinculos', 'pragA2_fit-a2')));
      await assertFails(getDoc(p(como('pragB'), 'empresas', A, 'vinculos', 'pragA1_fit-a1')));
    });

    test('listas: o gerente lista o próprio setor (filtrando); a pessoa lista os próprios; sem filtro é negado', async () => {
      const vinculos = (db) => collection(db, 'empresas', A, 'vinculos');
      await assertSucceeds(getDocs(query(vinculos(como('gerA1')), where('setorId', '==', 'fit-a1'))));
      await assertFails(getDocs(query(vinculos(como('gerA1')), where('setorId', '==', 'fit-a2'))));
      await assertFails(getDocs(vinculos(como('gerA1'))));
      await assertSucceeds(getDocs(query(vinculos(como('pragA1')), where('pessoaUid', '==', 'pragA1'))));
      await assertFails(getDocs(vinculos(como('pragA1'))));
      await assertSucceeds(getDocs(vinculos(como('admA'))));
    });

    test('o app descobre os setores do usuário pelo grupo de coleções, só os próprios', async () => {
      const db = como('pragA1');
      await assertSucceeds(getDocs(query(collectionGroup(db, 'vinculos'), where('pessoaUid', '==', 'pragA1'))));
      await assertFails(getDocs(query(collectionGroup(db, 'vinculos'), where('pessoaUid', '==', 'agroA'))));
      await assertFails(getDocs(collectionGroup(db, 'vinculos')));
    });
  });

  describe('histórico', () => {
    test('lê quem é admin ou gerente do setor; funcionário e outras empresas não', async () => {
      await assertSucceeds(getDoc(p(como('gerA1'), 'empresas', A, 'vinculos', 'pragA1_fit-a1', 'historico', '1')));
      await assertSucceeds(getDoc(p(como('admA'), 'empresas', A, 'vinculos', 'pragA1_fit-a1', 'historico', '1')));
      await assertFails(getDoc(p(como('pragA1'), 'empresas', A, 'vinculos', 'pragA1_fit-a1', 'historico', '1')));
      await assertFails(getDoc(p(como('gerA2'), 'empresas', A, 'vinculos', 'pragA1_fit-a1', 'historico', '1')));
      await assertFails(getDoc(p(como('admB'), 'empresas', A, 'vinculos', 'pragA1_fit-a1', 'historico', '1')));
    });

    test('é imutável e não se forja registro solto', async () => {
      const ref = p(como('admA'), 'empresas', A, 'vinculos', 'pragA1_fit-a1', 'historico', '1');
      await assertFails(updateDoc(ref, { ativo: false }));
      await assertFails(deleteDoc(ref));
      // registro de versão que o vínculo não tem
      await assertFails(setDoc(p(como('admA'), 'empresas', A, 'vinculos', 'pragA1_fit-a1', 'historico', '7'), {
        versao: 7, pessoaUid: 'pragA1', setorId: 'fit-a1', papel: 'funcionario', funcoes: ['pragueiro'], ativo: true, alteradoPor: 'admA', alteradoEm: serverTimestamp(),
      }));
    });
  });
});

// ---------------------------------------------------------------- operação: avaliações, plantas, decisões, eventos

describe('avaliações (cabeçalho)', () => {
  const nova = (extra = {}) => Object.fromEntries(Object.entries({
    talhaoId: 't-a1', unidadeId: 'un-a1', setorId: 'fit-a1', fichaId: 'limao-tahiti', fichaVersao: 1,
    atributosTalhao: ATRIBUTOS, responsavelUid: 'pragA1', data: '2026-09-22', semanaISO: '2026-W39', status: 'rascunho', ...extra,
  }).filter(([, v]) => v !== undefined));
  const ID = 't-a1_2026-W39_pragA1';
  const ref = (db, id = ID) => p(db, 'empresas', A, 'avaliacoes', id);
  const semModulo = async () => env.withSecurityRulesDisabled(async (ctx) => {
    await updateDoc(doc(ctx.firestore(), 'empresas', A, 'setores', 'fit-a1'), { modulos: [] });
  });

  describe('criar', () => {
    test('pragueiro do setor cria a própria, com o id talhão_semana_uid', async () => {
      await assertSucceeds(setDoc(ref(como('pragA1')), nova()));
    });

    test('id fora do padrão, dono trocado ou já finalizada: negado', async () => {
      const db = como('pragA1');
      await assertFails(setDoc(ref(db, 'qualquer-id'), nova()));
      await assertFails(setDoc(ref(db, 't-a1_2026-W39_pragA1b'), nova({ responsavelUid: 'pragA1b' })));
      await assertFails(setDoc(ref(db), nova({ responsavelUid: 'pragA1b' })));
      await assertFails(setDoc(ref(db), nova({ status: 'finalizada' })));
      await assertFails(setDoc(ref(db), nova({ finalizadaEm: serverTimestamp() })));
    });

    test('só quem tem a função "pragueiro" no setor: agrônomo, gerente, admin e motorista não', async () => {
      for (const uid of ['agroA', 'gerA1', 'admA', 'motA', 'semVincA']) {
        await assertFails(setDoc(p(como(uid), 'empresas', A, 'avaliacoes', `t-a1_2026-W39_${uid}`), nova({ responsavelUid: uid })));
      }
    });

    test('pragueiro de outro setor não avalia neste (vínculo é por setor)', async () => {
      await assertFails(setDoc(p(como('pragA2'), 'empresas', A, 'avaliacoes', 't-a1_2026-W39_pragA2'), nova({ responsavelUid: 'pragA2' })));
      await assertFails(setDoc(p(como('pragA1'), 'empresas', A, 'avaliacoes', 't-a2_2026-W39_pragA1'), nova({ talhaoId: 't-a2', unidadeId: 'un-a2', setorId: 'fit-a2' })));
    });

    test('talhão de outra unidade, ou de outra empresa, ou inativo: negado', async () => {
      const db = como('pragA1');
      await assertFails(setDoc(ref(db, 't-a2_2026-W39_pragA1'), nova({ talhaoId: 't-a2' }))); // talhão da un-a2 no setor da un-a1
      await assertFails(setDoc(ref(db, 't-b1_2026-W39_pragA1'), nova({ talhaoId: 't-b1' }))); // talhão que só existe na empresa B
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'empresas', A, 'talhoes', 't-a1'), { ativo: false });
      });
      await assertFails(setDoc(ref(db), nova()));
    });

    test('atributos do talhão não podem ser adulterados (esconderia infestação com limite maior)', async () => {
      await assertFails(setDoc(ref(como('pragA1')), nova({ atributosTalhao: { tipoPomar: 'novo' } })));
      await assertFails(setDoc(ref(como('pragA1')), nova({ atributosTalhao: {} })));
    });

    test('a ficha tem que ser a vigente da cultura; o pragueiro não escolhe a versão', async () => {
      const db = como('pragA1');
      await assertFails(setDoc(ref(db), nova({ fichaVersao: 0 })));
      await assertFails(setDoc(ref(db), nova({ fichaVersao: 2 })));
      await assertFails(setDoc(ref(db), nova({ fichaId: 'outra-ficha' })));
      // quando a plataforma publica a v2 e a cultura passa a apontar para ela, a v1 deixa de valer
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'catalogo_culturas', 'limao-tahiti'), { fichaAtual: { fichaId: 'limao-tahiti', versao: 2 } });
      });
      await assertFails(setDoc(ref(db), nova()));
      await assertSucceeds(setDoc(ref(db), nova({ fichaVersao: 2 })));
    });

    test('amostragemPlantas (tamanho da amostra por talhão): piso 10, sem área = 15, área < 5 ha = 10', async () => {
      const db = como('pragA1');
      // talhão t-a1 do teste não tem areaHa: só 15 (o piso do manual quando falta o dado)
      await assertFails(setDoc(ref(db), nova({ amostragemPlantas: 5 })));
      await assertFails(setDoc(ref(db), nova({ amostragemPlantas: 30 }))); // fixo antigo, sem base no manual
      await assertFails(setDoc(ref(db), nova({ amostragemPlantas: '15' })));
      await assertSucceeds(setDoc(ref(db), nova({ amostragemPlantas: 15 })));
      // talhão com área < 5 ha: 10; a partir de 5 ha: qualquer valor de 10 a 999 (o app faz a conta do 1%)
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'empresas', A, 'talhoes', 't-a1'), { areaHa: 3 });
      });
      await assertFails(setDoc(ref(db, 't-a1_2026-W41_pragA1'), nova({ semanaISO: '2026-W41', amostragemPlantas: 15 })));
      await assertSucceeds(setDoc(ref(db, 't-a1_2026-W41_pragA1'), nova({ semanaISO: '2026-W41', amostragemPlantas: 10 })));
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'empresas', A, 'talhoes', 't-a1'), { areaHa: 10 });
      });
      await assertSucceeds(setDoc(ref(db, 't-a1_2026-W42_pragA1'), nova({ semanaISO: '2026-W42', amostragemPlantas: 42 })));
    });

    test('amostragemPlantas não muda depois de criada (não está entre os campos editáveis)', async () => {
      await assertFails(updateDoc(ref(como('pragA1'), AV1), { amostragemPlantas: 10 }));
    });

    test('unidade do cabeçalho tem que ser a do setor', async () => {
      await assertFails(setDoc(ref(como('pragA1')), nova({ unidadeId: 'un-a2' })));
    });

    test('setor sem o módulo (ou desativado): ninguém cria', async () => {
      await semModulo();
      await assertFails(setDoc(ref(como('pragA1')), nova()));
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'empresas', A, 'setores', 'fit-a1'), { modulos: ['fitossanidade'], ativo: false });
      });
      await assertFails(setDoc(ref(como('pragA1')), nova()));
    });

    test('vínculo ou membro inativo: sem acesso', async () => {
      await assertFails(setDoc(p(como('inativoA'), 'empresas', A, 'avaliacoes', 't-a1_2026-W39_inativoA'), nova({ responsavelUid: 'inativoA' })));
      await env.withSecurityRulesDisabled(async (ctx) => {
        await updateDoc(doc(ctx.firestore(), 'empresas', A, 'vinculos', 'pragA1_fit-a1'), { ativo: false });
      });
      await assertFails(setDoc(ref(como('pragA1')), nova()));
    });

    test('formato inválido ou campo extra: negado', async () => {
      const db = como('pragA1');
      await assertFails(setDoc(ref(db), nova({ data: '22/09/2026' })));
      await assertFails(setDoc(ref(db, 't-a1_39_pragA1'), nova({ semanaISO: '39' })));
      await assertFails(setDoc(ref(db), nova({ admin: true })));
      await assertFails(setDoc(ref(db), nova({ faseCultura: 'chumbinho' })));
    });

    test('empresa B não cria avaliação na A', async () => {
      await assertFails(setDoc(p(como('pragB'), 'empresas', A, 'avaliacoes', 't-a1_2026-W39_pragB'), nova({ responsavelUid: 'pragB' })));
    });
  });

  describe('ler', () => {
    test('o pragueiro lê só as próprias; o colega do mesmo setor não lê as dele', async () => {
      await assertSucceeds(getDoc(ref(como('pragA1'), AV1)));
      await assertFails(getDoc(ref(como('pragA1'), AV1B))); // colega
      await assertFails(getDoc(ref(como('pragA1'), AV2))); // outro setor
    });

    test('agrônomo e gerente leem as do próprio setor; de outro setor não', async () => {
      for (const uid of ['agroA', 'gerA1', 'gerA1b']) {
        await assertSucceeds(getDoc(ref(como(uid), AV1)));
        await assertSucceeds(getDoc(ref(como(uid), AV1B)));
        await assertFails(getDoc(ref(como(uid), AV2)));
      }
      await assertFails(getDoc(ref(como('gerA2'), AV1)));
    });

    test('o admin da empresa SEM vínculo não lê dados operacionais; nem a plataforma; nem motorista', async () => {
      for (const uid of ['admA', 'plat', 'motA', 'semVincA']) {
        await assertFails(getDoc(ref(como(uid), AV1)));
      }
      await assertFails(getDoc(ref(como('admB'), AV1)));
    });

    test('quando o admin se vincula ao setor com função de agrônomo, passa a ler', async () => {
      await env.withSecurityRulesDisabled(async (ctx) => {
        await setDoc(doc(ctx.firestore(), 'empresas', A, 'vinculos', 'admA_fit-a1'), vinculo('admA', 'fit-a1', 'un-a1', 'funcionario', ['agronomo']));
      });
      await assertSucceeds(getDoc(ref(como('admA'), AV1)));
      await assertFails(getDoc(ref(como('admA'), AV2))); // continua sem acesso ao outro setor
    });

    test('consultas: o pragueiro filtra por setorId E responsavelUid; o gestor por setorId', async () => {
      const col = (db) => collection(db, 'empresas', A, 'avaliacoes');
      const pr = como('pragA1');
      await assertSucceeds(getDocs(query(col(pr), where('setorId', '==', 'fit-a1'), where('responsavelUid', '==', 'pragA1'))));
      await assertFails(getDocs(query(col(pr), where('setorId', '==', 'fit-a1')))); // veria as dos colegas
      await assertFails(getDocs(query(col(pr), where('responsavelUid', '==', 'pragA1'))));
      await assertFails(getDocs(col(pr)));
      await assertSucceeds(getDocs(query(col(como('agroA')), where('setorId', '==', 'fit-a1'))));
      await assertSucceeds(getDocs(query(col(como('gerA1')), where('setorId', '==', 'fit-a1'))));
      await assertFails(getDocs(query(col(como('gerA1')), where('setorId', '==', 'fit-a2'))));
      await assertFails(getDocs(col(como('agroA'))));
    });

    test('setor sem o módulo: nem o dono lê', async () => {
      await semModulo();
      await assertFails(getDoc(ref(como('pragA1'), AV1)));
      await assertFails(getDoc(ref(como('agroA'), AV1)));
    });
  });

  describe('alterar', () => {
    test('o dono edita o rascunho e finaliza com o carimbo de hora do servidor', async () => {
      const r = ref(como('pragA1'), AV1);
      await assertSucceeds(updateDoc(r, { faseCultura: ['chumbinho'], notas: 'ok', armadilha: { adultos: 4 } }));
      await assertFails(updateDoc(r, { status: 'finalizada' })); // sem finalizadaEm
      await assertFails(updateDoc(r, { status: 'finalizada', finalizadaEm: Timestamp.fromDate(new Date('2020-01-01')) }));
      await assertFails(updateDoc(r, { finalizadaEm: serverTimestamp() })); // carimbo sem finalizar
      await assertSucceeds(updateDoc(r, { status: 'finalizada', finalizadaEm: serverTimestamp() }));
    });

    test('resumoCor: só um dos valores conhecidos; opcional; não é a decisão do agrônomo', async () => {
      const r = ref(como('pragA1'), AV1);
      await assertFails(updateDoc(r, { status: 'finalizada', finalizadaEm: serverTimestamp(), resumoCor: 'roxo' }));
      await assertSucceeds(updateDoc(r, { notas: 'sem cor ainda é permitido' })); // campo é opcional
      await assertSucceeds(updateDoc(r, { status: 'finalizada', finalizadaEm: serverTimestamp(), resumoCor: 'laranja' }));
    });

    test('identidade, setor, talhão, semana, ficha e atributos não mudam', async () => {
      const r = ref(como('pragA1'), AV1);
      await assertFails(updateDoc(r, { talhaoId: 't-a2' }));
      await assertFails(updateDoc(r, { setorId: 'fit-a2' }));
      await assertFails(updateDoc(r, { unidadeId: 'un-a2' }));
      await assertFails(updateDoc(r, { responsavelUid: 'pragA1b' }));
      await assertFails(updateDoc(r, { semanaISO: '2026-W40' }));
      await assertFails(updateDoc(r, { fichaVersao: 2 }));
      await assertFails(updateDoc(r, { atributosTalhao: { tipoPomar: 'novo' } }));
      await assertFails(updateDoc(r, { data: '2026-01-01' }));
    });

    test('avaliação finalizada é imutável', async () => {
      const r = ref(como('pragA1'), AV1_FIN);
      await assertFails(updateDoc(r, { status: 'rascunho' }));
      await assertFails(updateDoc(r, { notas: 'depois' }));
      await assertFails(updateDoc(r, { finalizadaEm: serverTimestamp() }));
    });

    test('só o dono altera: colega, agrônomo, gerente e admin não', async () => {
      for (const uid of ['pragA1b', 'agroA', 'gerA1', 'admA', 'pragB']) {
        await assertFails(updateDoc(ref(como(uid), AV1), { notas: 'invasão' }));
      }
    });

    test('dono com vínculo desativado ou setor sem módulo não altera', async () => {
      await semModulo();
      await assertFails(updateDoc(ref(como('pragA1'), AV1), { notas: 'x' }));
    });

    test('ninguém apaga', async () => {
      for (const uid of ['pragA1', 'agroA', 'gerA1', 'admA']) {
        await assertFails(deleteDoc(ref(como(uid), AV1)));
      }
    });
  });
});

describe('plantas', () => {
  const planta = (n, uid = 'pragA1', aid = AV1) => p(como(uid), 'empresas', A, 'avaliacoes', aid, 'plantas', String(n));

  test('o pragueiro grava as plantas da própria avaliação em rascunho (o número vai até 999: o total exato vem do talhão, no app)', async () => {
    await assertSucceeds(setDoc(planta(2), { n: 2, obs: { tripes_flor: { A: 1, B: null } } }));
    await assertSucceeds(setDoc(planta(30), { n: 30, obs: {} }));
    await assertSucceeds(setDoc(planta(42), { n: 42, obs: {} })); // talhão grande: amostra > 30 (1% do total)
    await assertSucceeds(setDoc(planta(999), { n: 999, obs: {} }));
    await assertSucceeds(updateDoc(planta(1), { 'obs.tripes_flor': { A: 3, B: 0 } }));
    await assertSucceeds(setDoc(planta(3), { n: 3, obs: {}, notas: 'foco perto da cerca', fotos: [{ itemId: 'tripes_flor', quadrante: 'A', caminho: 'local:1' }] }));
  });

  test('plantas fora de 1 a 999, campos extras e dados inválidos: negado', async () => {
    await assertFails(setDoc(planta(0), { n: 0, obs: {} }));
    await assertFails(setDoc(planta(1000), { n: 1000, obs: {} }));
    await assertFails(setDoc(planta('01'), { n: 1, obs: {} }));
    await assertFails(setDoc(planta(3), { n: 3, obs: {}, admin: true }));
    await assertFails(setDoc(planta(3), { n: 3, obs: 'texto' }));
    await assertFails(setDoc(planta(3), { n: '3', obs: {} }));
    await assertFails(setDoc(planta(3), { n: 3, obs: {}, fotos: 'foto.jpg' }));
    await assertFails(setDoc(planta(3), { n: 3, obs: Object.fromEntries(Array.from({ length: 61 }, (_, i) => [`item${i}`, { A: 1, B: 1 }])) }));
  });

  test('avaliação finalizada não aceita mais plantas', async () => {
    await assertFails(setDoc(planta(2, 'pragA1', AV1_FIN), { n: 2, obs: {} }));
    await assertFails(updateDoc(planta(1, 'pragA1', AV1_FIN), { notas: 'x' }));
  });

  test('o colega do mesmo setor não lê nem grava planta alheia', async () => {
    await assertFails(getDoc(planta(1, 'pragA1b')));
    await assertFails(setDoc(planta(2, 'pragA1b'), { n: 2, obs: {} }));
  });

  test('pragueiro de outro setor e outra empresa: nada', async () => {
    await assertFails(getDoc(planta(1, 'pragA2')));
    await assertFails(setDoc(planta(2, 'pragA2'), { n: 2, obs: {} }));
    await assertFails(getDoc(planta(1, 'pragB')));
  });

  test('agrônomo e gerente do setor leem, mas não gravam; admin sem vínculo nem lê', async () => {
    for (const uid of ['agroA', 'gerA1']) {
      await assertSucceeds(getDoc(planta(1, uid)));
      await assertFails(setDoc(planta(2, uid), { n: 2, obs: {} }));
      await assertFails(updateDoc(planta(1, uid), { notas: 'x' }));
    }
    await assertFails(getDoc(planta(1, 'gerA2')));
    await assertFails(getDoc(planta(1, 'admA')));
  });

  test('setor sem o módulo: nem o dono grava', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'empresas', A, 'setores', 'fit-a1'), { modulos: [] });
    });
    await assertFails(setDoc(planta(2), { n: 2, obs: {} }));
    await assertFails(getDoc(planta(1)));
  });

  test('ninguém apaga planta', async () => {
    await assertFails(deleteDoc(planta(1)));
  });
});

describe('decisões (agrônomo decide, gerente executa)', () => {
  const nova = (extra = {}) => ({
    avaliacaoId: AV1_FIN, talhaoId: 't-a1', unidadeId: 'un-a1', setorId: 'fit-a1', tds: ['TD2'], status: 'aprovada',
    decididoPor: 'agroA', decididoEm: serverTimestamp(), ...extra,
  });
  const semDecisao = async () => env.withSecurityRulesDisabled(async (ctx) => {
    await deleteDoc(doc(ctx.firestore(), 'empresas', A, 'decisoes', AV1_FIN));
  });
  const dec = (uid, id = AV1_FIN) => p(como(uid), 'empresas', A, 'decisoes', id);

  test('o agrônomo do setor decide uma avaliação finalizada; o id é o da avaliação', async () => {
    await semDecisao();
    await assertSucceeds(setDoc(dec('agroA'), nova()));
    await semDecisao();
    await assertSucceeds(setDoc(dec('agroA'), nova({ status: 'rejeitada', observacao: 'aguardar a próxima semana', tds: ['TD1'] })));
  });

  test('não decide rascunho, id trocado, dados de outra avaliação ou em nome de outro', async () => {
    await semDecisao();
    await assertFails(setDoc(dec('agroA', AV1), nova({ avaliacaoId: AV1 }))); // rascunho
    await assertFails(setDoc(dec('agroA', 'outro-id'), nova()));
    await assertFails(setDoc(dec('agroA'), nova({ decididoPor: 'gerA1' })));
    await assertFails(setDoc(dec('agroA'), nova({ decididoEm: Timestamp.fromDate(new Date('2020-01-01')) })));
    await assertFails(setDoc(dec('agroA'), nova({ status: 'executada' })));
    await assertFails(setDoc(dec('agroA'), nova({ setorId: 'fit-a2' })));
    await assertFails(setDoc(dec('agroA'), nova({ talhaoId: 't-a2' })));
    await assertFails(setDoc(dec('agroA'), nova({ tds: [] })));
    await assertFails(setDoc(dec('agroA'), nova({ extra: 1 })));
  });

  test('agrônomo de OUTRO setor não decide (a função é por setor)', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), 'empresas', A, 'decisoes', AV2_FIN)).catch(() => {});
    });
    await assertFails(setDoc(dec('agroA', AV2_FIN), nova({
      avaliacaoId: AV2_FIN, talhaoId: 't-a2', unidadeId: 'un-a2', setorId: 'fit-a2',
    })));
  });

  test('gerente, pragueiro, admin e motorista não criam decisão', async () => {
    await semDecisao();
    for (const uid of ['gerA1', 'pragA1', 'admA', 'motA', 'pragB']) {
      await assertFails(setDoc(dec(uid), nova({ decididoPor: uid })));
    }
  });

  test('decisão já tomada não é reescrita pelo agrônomo', async () => {
    await assertFails(setDoc(dec('agroA'), nova()));
    await assertFails(updateDoc(dec('agroA'), { status: 'rejeitada' }));
  });

  test('o gerente do setor marca como executada, só com os campos permitidos', async () => {
    const r = dec('gerA1');
    await assertFails(updateDoc(r, { status: 'executada', executadoPor: 'gerA1', executadoEm: serverTimestamp(), tds: ['TD1'] }));
    await assertFails(updateDoc(r, { status: 'executada', executadoPor: 'outro', executadoEm: serverTimestamp() }));
    await assertFails(updateDoc(r, { status: 'executada', executadoPor: 'gerA1', executadoEm: Timestamp.fromDate(new Date('2020-01-01')) }));
    await assertSucceeds(updateDoc(r, { status: 'executada', executadoPor: 'gerA1', executadoEm: serverTimestamp(), observacaoExecucao: 'aplicado em 21/09' }));
    await assertFails(updateDoc(r, { status: 'aprovada' })); // já executada
  });

  test('gerente de outro setor, agrônomo, pragueiro e admin não executam', async () => {
    for (const uid of ['gerA2', 'agroA', 'pragA1', 'admA']) {
      await assertFails(updateDoc(dec(uid), { status: 'executada', executadoPor: uid, executadoEm: serverTimestamp() }));
    }
  });

  test('decisão rejeitada não pode ser executada', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await updateDoc(doc(ctx.firestore(), 'empresas', A, 'decisoes', AV1_FIN), { status: 'rejeitada' });
    });
    await assertFails(updateDoc(dec('gerA1'), { status: 'executada', executadoPor: 'gerA1', executadoEm: serverTimestamp() }));
  });

  test('leitura: agrônomo e gerente do setor; pragueiro, outro setor e admin sem vínculo não', async () => {
    await assertSucceeds(getDoc(dec('agroA')));
    await assertSucceeds(getDoc(dec('gerA1')));
    await assertFails(getDoc(dec('pragA1')));
    await assertFails(getDoc(dec('gerA2')));
    await assertFails(getDoc(dec('admA')));
    await assertFails(getDoc(dec('pragB')));
  });

  test('ninguém apaga decisão', async () => {
    await assertFails(deleteDoc(dec('agroA')));
    await assertFails(deleteDoc(dec('gerA1')));
  });
});

describe('eventos (trilha de auditoria)', () => {
  const ev = (uid, id) => p(como(uid), 'empresas', A, 'eventos', id);
  const semear = async (dados) => env.withSecurityRulesDisabled(async (ctx) => {
    await setDoc(doc(ctx.firestore(), 'empresas', A, 'eventos', 'e9'), { uid: 'pragA1', acao: 'finalizou', em: agora(), ...dados });
  });

  test('cada membro ativo registra o próprio evento; não falsifica autor nem hora', async () => {
    await assertSucceeds(setDoc(ev('pragA1', 'e1'), { uid: 'pragA1', acao: 'finalizou', setorId: 'fit-a1', em: serverTimestamp() }));
    await assertFails(setDoc(ev('pragA1', 'e2'), { uid: 'agroA', acao: 'finalizou', em: serverTimestamp() }));
    await assertFails(setDoc(ev('pragA1', 'e3'), { uid: 'pragA1', acao: 'finalizou', em: Timestamp.fromDate(new Date('2020-01-01')) }));
    await assertFails(setDoc(ev('pragA1', 'e4'), { uid: 'pragA1', acao: '', em: serverTimestamp() }));
    await assertFails(setDoc(ev('pragA1', 'e5'), { uid: 'pragA1', acao: 'x', em: serverTimestamp(), poder: 1 }));
  });

  test('membro inativo, de fora ou de outra empresa não registra', async () => {
    await assertFails(setDoc(ev('inativoA', 'e1'), { uid: 'inativoA', acao: 'x', em: serverTimestamp() }));
    await assertFails(setDoc(ev('pragB', 'e1'), { uid: 'pragB', acao: 'x', em: serverTimestamp() }));
  });

  test('não se altera nem se apaga', async () => {
    await semear({});
    await assertFails(updateDoc(ev('pragA1', 'e9'), { acao: 'outra' }));
    await assertFails(deleteDoc(ev('admA', 'e9')));
  });

  test('leitura: admin da empresa; agrônomo e gerente do setor do evento; pragueiro e outros setores não', async () => {
    await semear({ setorId: 'fit-a1' });
    await assertSucceeds(getDoc(ev('admA', 'e9')));
    await assertSucceeds(getDoc(ev('agroA', 'e9')));
    await assertSucceeds(getDoc(ev('gerA1', 'e9')));
    await assertFails(getDoc(ev('pragA1', 'e9')));
    await assertFails(getDoc(ev('gerA2', 'e9')));
    await assertFails(getDoc(ev('admB', 'e9')));
  });

  test('evento sem setor só o admin lê', async () => {
    await semear({});
    await assertSucceeds(getDoc(ev('admA', 'e9')));
    await assertFails(getDoc(ev('agroA', 'e9')));
    await assertFails(getDoc(ev('gerA1', 'e9')));
  });

  test('alvo e detalhe têm um teto de tamanho, como o resto do cadastro', async () => {
    await assertSucceeds(setDoc(ev('pragA1', 'e10'), { uid: 'pragA1', acao: 'x', em: serverTimestamp(), alvo: 'a'.repeat(200), detalhe: 'd'.repeat(500) }));
    await assertFails(setDoc(ev('pragA1', 'e11'), { uid: 'pragA1', acao: 'x', em: serverTimestamp(), alvo: 'a'.repeat(201) }));
    await assertFails(setDoc(ev('pragA1', 'e12'), { uid: 'pragA1', acao: 'x', em: serverTimestamp(), detalhe: 'd'.repeat(501) }));
  });
});

test('coleções que não existem no modelo continuam fechadas', async () => {
  await assertFails(getDoc(p(como('admA'), 'resultados', 'x')));
  await assertFails(setDoc(p(como('admA'), 'qualquer', 'x'), { a: 1 }));
  await assertFails(setDoc(p(como('admA'), 'empresas', A, 'segredos', 'x'), { a: 1 }));
  await assertFails(setDoc(p(como('plat'), 'segredos', 'x'), { a: 1 }));
});
