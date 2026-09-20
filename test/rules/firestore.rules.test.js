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
      semVincA: membro('semVincA'),
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
      vinculo('pragA1', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']),
      vinculo('pragA2', 'fit-a2', 'un-a2', 'funcionario', ['pragueiro']),
      vinculo('agroA', 'fit-a1', 'un-a1', 'funcionario', ['agronomo']),
      vinculo('motA', 'frota-a1', 'un-a1', 'funcionario', []),
      vinculo('inativoA', 'fit-a1', 'un-a1', 'funcionario', ['pragueiro']),
    ];
    for (const v of vinculos) await setDoc(doc(db, 'empresas', A, 'vinculos', `${v.pessoaUid}_${v.setorId}`), v);
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
    await assertFails(setDoc(p(db, 'empresas', A, 'setores', 'fit-y'), novo({ modulos: ['frota'] }))); // módulo ainda não existe
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

test('coleções que não existem no modelo continuam fechadas', async () => {
  await assertFails(getDoc(p(como('admA'), 'resultados', 'x')));
  await assertFails(setDoc(p(como('admA'), 'qualquer', 'x'), { a: 1 }));
  await assertFails(setDoc(p(como('admA'), 'empresas', A, 'segredos', 'x'), { a: 1 }));
  await assertFails(setDoc(p(como('plat'), 'segredos', 'x'), { a: 1 }));
});
