// Testes das firestore.rules no emulador, com um usuário de cada papel.
// Rodar: npm run test:rules   (precisa de Java e do firebase-tools)
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
  query,
  where,
  serverTimestamp,
} from 'firebase/firestore';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-cultura',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
  });
});

after(async () => {
  await env.cleanup();
});

// Usuários: p1 e p2 pragueiros, g1 gestor, ag1 agrônomo, adm admin, semperfil logado sem documento em users.
const PERFIS = {
  p1: 'pragueiro',
  p2: 'pragueiro',
  g1: 'gestor',
  ag1: 'agronomo',
  adm: 'admin',
};

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    for (const [uid, papel] of Object.entries(PERFIS)) {
      await setDoc(doc(db, 'users', uid), { papel, nome: uid });
    }
    await setDoc(doc(db, 'fazendas', 'f1'), { nome: 'Fazenda 1' });
    await setDoc(doc(db, 'talhoes', 't1'), { fazendaId: 'f1', nome: 'T1', tipoPomar: 'adulto' });
    await setDoc(doc(db, 'config', 'regras'), { versao: 1 });

    await setDoc(doc(db, 'avaliacoes', 'av1'), { talhaoId: 't1', responsavelUid: 'p1', status: 'rascunho' });
    await setDoc(doc(db, 'avaliacoes', 'av2'), { talhaoId: 't1', responsavelUid: 'p2', status: 'rascunho' });
    await setDoc(doc(db, 'avaliacoes', 'avF'), { talhaoId: 't1', responsavelUid: 'p1', status: 'finalizada' });
    await setDoc(doc(db, 'avaliacoes', 'av1', 'plantas', '1'), { n: 1, obs: {} });
    await setDoc(doc(db, 'avaliacoes', 'avF', 'plantas', '1'), { n: 1, obs: {} });

    await setDoc(doc(db, 'resultados', 'av1'), { ni: {} });
    await setDoc(doc(db, 'decisoes', 'd1'), {
      avaliacaoId: 'avF',
      talhaoId: 't1',
      tds: ['TD2'],
      status: 'pendente',
    });
  });
});

const como = (uid) => env.authenticatedContext(uid).firestore();
const anonimo = () => env.unauthenticatedContext().firestore();

describe('sem login ou sem perfil', () => {
  test('anônimo não lê nada', async () => {
    const db = anonimo();
    await assertFails(getDoc(doc(db, 'fazendas', 'f1')));
    await assertFails(getDoc(doc(db, 'avaliacoes', 'av1')));
    await assertFails(getDoc(doc(db, 'users', 'p1')));
  });

  test('logado mas sem documento em users não acessa cadastros nem avaliações', async () => {
    const db = como('semperfil');
    await assertFails(getDoc(doc(db, 'fazendas', 'f1')));
    await assertFails(getDoc(doc(db, 'talhoes', 't1')));
    await assertFails(
      setDoc(doc(db, 'avaliacoes', 'x'), { responsavelUid: 'semperfil', status: 'rascunho' }),
    );
  });
});

describe('users', () => {
  test('cada um lê o próprio perfil', async () => {
    await assertSucceeds(getDoc(doc(como('p1'), 'users', 'p1')));
  });

  test('pragueiro não lê o perfil de outro', async () => {
    await assertFails(getDoc(doc(como('p1'), 'users', 'p2')));
  });

  test('gestor, agrônomo e admin leem qualquer perfil', async () => {
    for (const uid of ['g1', 'ag1', 'adm']) {
      await assertSucceeds(getDoc(doc(como(uid), 'users', 'p1')));
    }
  });

  test('ninguém, exceto o admin, escreve em users (sem escalar o próprio papel)', async () => {
    await assertFails(updateDoc(doc(como('p1'), 'users', 'p1'), { papel: 'admin' }));
    await assertFails(setDoc(doc(como('g1'), 'users', 'g1'), { papel: 'admin', nome: 'g1' }));
    await assertSucceeds(setDoc(doc(como('adm'), 'users', 'novo'), { papel: 'pragueiro', nome: 'Novo' }));
  });
});

describe('fazendas, talhões e config', () => {
  test('todos os papéis leem', async () => {
    for (const uid of Object.keys(PERFIS)) {
      const db = como(uid);
      await assertSucceeds(getDoc(doc(db, 'fazendas', 'f1')));
      await assertSucceeds(getDoc(doc(db, 'talhoes', 't1')));
      await assertSucceeds(getDoc(doc(db, 'config', 'regras')));
    }
  });

  test('só o admin escreve', async () => {
    for (const uid of ['p1', 'g1', 'ag1']) {
      const db = como(uid);
      await assertFails(setDoc(doc(db, 'fazendas', 'novo'), { nome: 'X' }));
      await assertFails(updateDoc(doc(db, 'talhoes', 't1'), { nome: 'X' }));
      await assertFails(setDoc(doc(db, 'config', 'regras'), { versao: 99 }));
    }
    const admin = como('adm');
    await assertSucceeds(setDoc(doc(admin, 'fazendas', 'novo'), { nome: 'X' }));
    await assertSucceeds(updateDoc(doc(admin, 'talhoes', 't1'), { nome: 'Y' }));
    await assertSucceeds(setDoc(doc(admin, 'config', 'regras'), { versao: 2 }));
  });
});

describe('avaliações (cabeçalho)', () => {
  test('pragueiro cria a própria como rascunho', async () => {
    await assertSucceeds(
      setDoc(doc(como('p1'), 'avaliacoes', 'nova'), {
        talhaoId: 't1',
        responsavelUid: 'p1',
        status: 'rascunho',
        criadoEm: serverTimestamp(),
      }),
    );
  });

  test('pragueiro não cria em nome de outro nem já finalizada', async () => {
    const db = como('p1');
    await assertFails(setDoc(doc(db, 'avaliacoes', 'a'), { responsavelUid: 'p2', status: 'rascunho' }));
    await assertFails(setDoc(doc(db, 'avaliacoes', 'b'), { responsavelUid: 'p1', status: 'finalizada' }));
  });

  test('gestor, agrônomo e admin não criam avaliações', async () => {
    for (const uid of ['g1', 'ag1', 'adm']) {
      await assertFails(
        setDoc(doc(como(uid), 'avaliacoes', `x-${uid}`), { responsavelUid: uid, status: 'rascunho' }),
      );
    }
  });

  test('pragueiro lê as próprias, não as de outro', async () => {
    await assertSucceeds(getDoc(doc(como('p1'), 'avaliacoes', 'av1')));
    await assertFails(getDoc(doc(como('p1'), 'avaliacoes', 'av2')));
  });

  test('consulta do pragueiro precisa filtrar por responsavelUid', async () => {
    const db = como('p1');
    await assertSucceeds(
      getDocs(query(collection(db, 'avaliacoes'), where('responsavelUid', '==', 'p1'))),
    );
    await assertFails(getDocs(collection(db, 'avaliacoes')));
  });

  test('gestor, agrônomo e admin leem todas', async () => {
    for (const uid of ['g1', 'ag1', 'adm']) {
      await assertSucceeds(getDocs(collection(como(uid), 'avaliacoes')));
    }
  });

  test('pragueiro edita e finaliza o próprio rascunho', async () => {
    const ref = doc(como('p1'), 'avaliacoes', 'av1');
    await assertSucceeds(updateDoc(ref, { faseCultura: ['chumbinho'] }));
    await assertSucceeds(updateDoc(ref, { status: 'finalizada' }));
  });

  test('avaliação finalizada é imutável', async () => {
    const ref = doc(como('p1'), 'avaliacoes', 'avF');
    await assertFails(updateDoc(ref, { status: 'rascunho' }));
    await assertFails(updateDoc(ref, { faseCultura: ['azeitona'] }));
  });

  test('pragueiro não edita a avaliação de outro nem troca o responsável', async () => {
    await assertFails(updateDoc(doc(como('p1'), 'avaliacoes', 'av2'), { faseCultura: ['x'] }));
    await assertFails(updateDoc(doc(como('p1'), 'avaliacoes', 'av1'), { responsavelUid: 'p2' }));
  });

  test('ninguém apaga avaliação', async () => {
    for (const uid of ['p1', 'g1', 'adm']) {
      await assertFails(deleteDoc(doc(como(uid), 'avaliacoes', 'av1')));
    }
  });
});

describe('plantas', () => {
  test('pragueiro grava planta na própria avaliação em rascunho', async () => {
    const db = como('p1');
    await assertSucceeds(setDoc(doc(db, 'avaliacoes', 'av1', 'plantas', '2'), { n: 2, obs: {} }));
    await assertSucceeds(
      updateDoc(doc(db, 'avaliacoes', 'av1', 'plantas', '1'), { 'obs.tripes_flor': { A: 1, B: null } }),
    );
  });

  test('pragueiro não grava planta em avaliação finalizada', async () => {
    const db = como('p1');
    await assertFails(setDoc(doc(db, 'avaliacoes', 'avF', 'plantas', '2'), { n: 2, obs: {} }));
    await assertFails(updateDoc(doc(db, 'avaliacoes', 'avF', 'plantas', '1'), { notas: 'x' }));
  });

  test('pragueiro não grava nem lê planta da avaliação de outro', async () => {
    await assertFails(setDoc(doc(como('p1'), 'avaliacoes', 'av2', 'plantas', '1'), { n: 1, obs: {} }));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'avaliacoes', 'av2', 'plantas', '1'), { n: 1, obs: {} });
    });
    await assertFails(getDoc(doc(como('p1'), 'avaliacoes', 'av2', 'plantas', '1')));
  });

  test('gestor lê plantas mas não grava', async () => {
    await assertSucceeds(getDoc(doc(como('g1'), 'avaliacoes', 'av1', 'plantas', '1')));
    await assertFails(setDoc(doc(como('g1'), 'avaliacoes', 'av1', 'plantas', '3'), { n: 3, obs: {} }));
  });

  test('ninguém apaga planta', async () => {
    await assertFails(deleteDoc(doc(como('p1'), 'avaliacoes', 'av1', 'plantas', '1')));
  });
});

describe('resultados e decisões', () => {
  test('resultados: gestor lê; ninguém escreve pelo cliente', async () => {
    await assertSucceeds(getDoc(doc(como('g1'), 'resultados', 'av1')));
    await assertFails(getDoc(doc(como('p1'), 'resultados', 'av1')));
    for (const uid of ['p1', 'g1', 'adm']) {
      await assertFails(setDoc(doc(como(uid), 'resultados', 'novo'), { ni: {} }));
    }
  });

  test('decisões: pragueiro não lê', async () => {
    await assertSucceeds(getDoc(doc(como('g1'), 'decisoes', 'd1')));
    await assertFails(getDoc(doc(como('p1'), 'decisoes', 'd1')));
  });

  test('decisões: cliente não cria (hoje só o servidor cria)', async () => {
    for (const uid of ['g1', 'ag1', 'adm']) {
      await assertFails(setDoc(doc(como(uid), 'decisoes', `n-${uid}`), { status: 'pendente', tds: ['TD1'] }));
    }
  });

  test('gestor só altera status, aprovadoPor, aprovadoEm e observacao', async () => {
    const ref = doc(como('g1'), 'decisoes', 'd1');
    await assertSucceeds(
      updateDoc(ref, { status: 'aprovada', aprovadoPor: 'g1', aprovadoEm: serverTimestamp(), observacao: 'ok' }),
    );
    await assertFails(updateDoc(ref, { tds: ['TD1'] }));
    await assertFails(updateDoc(ref, { status: 'qualquer-coisa' }));
  });

  test('pragueiro não altera decisão', async () => {
    await assertFails(updateDoc(doc(como('p1'), 'decisoes', 'd1'), { status: 'aprovada' }));
  });
});
