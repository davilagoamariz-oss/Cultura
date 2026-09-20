// Testes da proposta de regras multiempresa (proposta/firestore.rules).
// Rodar: npm run test:rules:proposta   (precisa de Java 21 e do firebase-tools)
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
    firestore: {
      rules: readFileSync(new URL('../../proposta/firestore.rules', import.meta.url), 'utf8'),
    },
  });
});

after(async () => {
  await env.cleanup();
});

const A = 'empresaA';
const B = 'empresaB';
const PROTOCOLO = { id: 'limao-tahiti-ffpro02', versao: 1 };
const amanha = () => Timestamp.fromDate(new Date(Date.now() + 86_400_000));
const ontem = () => Timestamp.fromDate(new Date(Date.now() - 86_400_000));

const AV1 = 'tA1_2026-W38_pragA1'; // rascunho da pragA1
const AV1_FIN = 'tA1_2026-W37_pragA1'; // finalizada da pragA1
const AV2 = 'tA2_2026-W38_pragA2'; // rascunho da pragA2 (outra fazenda)

const membro = (uid, papel, fazendaIds, ativo = true) => ({ uid, papel, fazendaIds, ativo });

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'plataforma_admins', 'plat'), { criadoEm: 1 });

    for (const e of [A, B]) await setDoc(doc(db, 'empresas', e), { nome: e, status: 'ativa' });

    const membrosA = {
      adA: membro('adA', 'admin_empresa', ['*']),
      agA: membro('agA', 'agronomo', ['*']),
      gerA1: membro('gerA1', 'gerente', ['fA1']),
      gerA2: membro('gerA2', 'gerente', ['fA2']),
      pragA1: membro('pragA1', 'pragueiro', ['fA1']),
      pragA2: membro('pragA2', 'pragueiro', ['fA2']),
      inativoA: membro('inativoA', 'pragueiro', ['fA1'], false),
    };
    for (const [uid, m] of Object.entries(membrosA)) await setDoc(doc(db, 'empresas', A, 'membros', uid), m);
    await setDoc(doc(db, 'empresas', B, 'membros', 'adB'), membro('adB', 'admin_empresa', ['*']));
    await setDoc(doc(db, 'empresas', B, 'membros', 'pragB1'), membro('pragB1', 'pragueiro', ['fB1']));

    for (const f of ['fA1', 'fA2']) await setDoc(doc(db, 'empresas', A, 'fazendas', f), { nome: f });
    await setDoc(doc(db, 'empresas', B, 'fazendas', 'fB1'), { nome: 'fB1' });

    const talhao = (fazendaId) => ({ fazendaId, nome: 'T', culturaId: 'limao-tahiti', protocolo: PROTOCOLO });
    await setDoc(doc(db, 'empresas', A, 'talhoes', 'tA1'), talhao('fA1'));
    await setDoc(doc(db, 'empresas', A, 'talhoes', 'tA2'), talhao('fA2'));
    await setDoc(doc(db, 'empresas', B, 'talhoes', 'tB1'), talhao('fB1'));

    const av = (fazendaId, talhaoId, semanaISO, responsavelUid, status) => ({
      fazendaId, talhaoId, semanaISO, data: '2026-09-15', responsavelUid, status, protocolo: PROTOCOLO,
    });
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV1), av('fA1', 'tA1', '2026-W38', 'pragA1', 'rascunho'));
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV1_FIN), av('fA1', 'tA1', '2026-W37', 'pragA1', 'finalizada'));
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV2), av('fA2', 'tA2', '2026-W38', 'pragA2', 'rascunho'));
    await setDoc(doc(db, 'empresas', B, 'avaliacoes', 'tB1_2026-W38_pragB1'),
      av('fB1', 'tB1', '2026-W38', 'pragB1', 'rascunho'));
    await setDoc(doc(db, 'empresas', A, 'avaliacoes', AV1, 'plantas', '1'), { n: 1, obs: {} });

    const convite = (extra) => ({
      email: 'novo@x.com', papel: 'pragueiro', fazendaIds: ['fA1'], expiraEm: amanha(), usadoPor: null, criadoPor: 'adA', ...extra,
    });
    await setDoc(doc(db, 'empresas', A, 'convites', 'convite-valido-1234567890abcdef'), convite());
    await setDoc(doc(db, 'empresas', A, 'convites', 'convite-expirado-1234567890abc'), convite({ expiraEm: ontem() }));
    await setDoc(doc(db, 'empresas', A, 'convites', 'convite-usado-1234567890abcdef'), convite({ usadoPor: 'alguem' }));

    await setDoc(doc(db, 'empresas', A, 'decisoes', AV1_FIN), {
      avaliacaoId: AV1_FIN, talhaoId: 'tA1', fazendaId: 'fA1', tds: ['TD2'], status: 'aprovada',
      decididoPor: 'agA', decididoEm: Timestamp.now(),
    });
  });
});

const como = (uid, claims) => env.authenticatedContext(uid, claims).firestore();
const p = (db, ...caminho) => doc(db, ...caminho);

describe('isolamento entre empresas (ataques)', () => {
  test('usuário da empresa B não lê nada da empresa A', async () => {
    for (const uid of ['adB', 'pragB1']) {
      const db = como(uid);
      await assertFails(getDoc(p(db, 'empresas', A)));
      await assertFails(getDoc(p(db, 'empresas', A, 'fazendas', 'fA1')));
      await assertFails(getDoc(p(db, 'empresas', A, 'talhoes', 'tA1')));
      await assertFails(getDoc(p(db, 'empresas', A, 'avaliacoes', AV1)));
      await assertFails(getDoc(p(db, 'empresas', A, 'decisoes', AV1_FIN)));
      await assertFails(getDoc(p(db, 'empresas', A, 'membros', 'adA')));
      await assertFails(getDocs(collection(db, 'empresas', A, 'avaliacoes')));
    }
  });

  test('usuário da empresa A não lê nem escreve na empresa B', async () => {
    for (const uid of ['adA', 'agA', 'pragA1']) {
      const db = como(uid);
      await assertFails(getDoc(p(db, 'empresas', B, 'talhoes', 'tB1')));
      await assertFails(getDoc(p(db, 'empresas', B, 'avaliacoes', 'tB1_2026-W38_pragB1')));
      await assertFails(setDoc(p(db, 'empresas', B, 'fazendas', 'novo'), { nome: 'X' }));
    }
  });

  test('admin de uma empresa não cria vínculo na outra (nem para si mesmo)', async () => {
    await assertFails(setDoc(p(como('adA'), 'empresas', B, 'membros', 'adA'), membro('adA', 'admin_empresa', ['*'])));
    await assertFails(setDoc(p(como('adB'), 'empresas', A, 'membros', 'adB'), membro('adB', 'admin_empresa', ['*'])));
  });

  test('avaliação não pode ser criada apontando para talhão de outra empresa', async () => {
    const db = como('pragA1');
    await assertFails(
      setDoc(p(db, 'empresas', A, 'avaliacoes', 'tB1_2026-W39_pragA1'), {
        fazendaId: 'fA1', talhaoId: 'tB1', semanaISO: '2026-W39', data: '2026-09-22',
        responsavelUid: 'pragA1', status: 'rascunho', protocolo: PROTOCOLO,
      }),
    );
  });

  test('sem vínculo ou anônimo: nada', async () => {
    for (const db of [como('semVinculo'), env.unauthenticatedContext().firestore()]) {
      await assertFails(getDoc(p(db, 'empresas', A)));
      await assertFails(getDoc(p(db, 'empresas', A, 'talhoes', 'tA1')));
      await assertFails(getDocs(collection(db, 'empresas', A, 'avaliacoes')));
    }
  });

  test('vínculo desativado perde o acesso', async () => {
    const db = como('inativoA');
    await assertFails(getDoc(p(db, 'empresas', A, 'talhoes', 'tA1')));
    await assertFails(getDoc(p(db, 'empresas', A, 'avaliacoes', AV1)));
  });
});

describe('perfil, vínculo e plataforma', () => {
  test('users: só o nome, só o próprio', async () => {
    const db = como('u1');
    await assertSucceeds(setDoc(p(db, 'users', 'u1'), { nome: 'Ana' }));
    await assertFails(setDoc(p(db, 'users', 'u1'), { nome: 'Ana', papel: 'admin' }));
    await assertFails(setDoc(p(db, 'users', 'u2'), { nome: 'Outra' }));
    await assertFails(getDoc(p(db, 'users', 'u2')));
  });

  test('ninguém sobe o próprio papel nem edita o próprio vínculo', async () => {
    await assertFails(updateDoc(p(como('pragA1'), 'empresas', A, 'membros', 'pragA1'), { papel: 'admin_empresa' }));
    await assertFails(updateDoc(p(como('pragA1'), 'empresas', A, 'membros', 'pragA1'), { fazendaIds: ['*'] }));
    await assertFails(setDoc(p(como('adA'), 'empresas', A, 'membros', 'adA'), membro('adA', 'admin_empresa', ['*'], false)));
  });

  test('admin da empresa cria e ajusta vínculos válidos; papel inválido não passa', async () => {
    const db = como('adA');
    await assertSucceeds(setDoc(p(db, 'empresas', A, 'membros', 'novoUid'), membro('novoUid', 'gerente', ['fA1'])));
    await assertSucceeds(updateDoc(p(db, 'empresas', A, 'membros', 'pragA1'), { ativo: false }));
    await assertFails(setDoc(p(db, 'empresas', A, 'membros', 'x1'), membro('x1', 'plataforma_admin', ['*'])));
    await assertFails(setDoc(p(db, 'empresas', A, 'membros', 'x2'), { ...membro('x2', 'gerente', ['*']), extra: 1 }));
    await assertFails(setDoc(p(db, 'empresas', A, 'membros', 'x3'), membro('outro', 'gerente', ['*'])));
  });

  test('pragueiro, gerente e agrônomo não gerenciam vínculos', async () => {
    for (const uid of ['pragA1', 'gerA1', 'agA']) {
      await assertFails(setDoc(p(como(uid), 'empresas', A, 'membros', 'novoUid'), membro('novoUid', 'pragueiro', ['fA1'])));
    }
  });

  test('cada usuário descobre os próprios vínculos (grupo de coleções), e só os próprios', async () => {
    const db = como('pragA1');
    await assertSucceeds(getDocs(query(collectionGroup(db, 'membros'), where('uid', '==', 'pragA1'))));
    await assertFails(getDocs(query(collectionGroup(db, 'membros'), where('uid', '==', 'adA'))));
    await assertFails(getDocs(collectionGroup(db, 'membros')));
  });

  test('só o admin da plataforma cria empresa; ele não lê avaliações', async () => {
    await assertSucceeds(setDoc(p(como('plat'), 'empresas', 'empresaC'), { nome: 'C', status: 'ativa' }));
    await assertFails(setDoc(p(como('adA'), 'empresas', 'empresaD'), { nome: 'D', status: 'ativa' }));
    await assertFails(getDoc(p(como('plat'), 'empresas', A, 'avaliacoes', AV1)));
    await assertFails(getDoc(p(como('plat'), 'empresas', A, 'decisoes', AV1_FIN)));
    // mas cria o primeiro admin de uma empresa nova
    await assertSucceeds(setDoc(p(como('plat'), 'empresas', A, 'membros', 'primeiro'), membro('primeiro', 'admin_empresa', ['*'])));
  });

  test('plataforma_admins não é gravável pelo cliente', async () => {
    await assertFails(setDoc(p(como('adA'), 'plataforma_admins', 'adA'), { criadoEm: 1 }));
    await assertFails(setDoc(p(como('plat'), 'plataforma_admins', 'outro'), { criadoEm: 1 }));
  });

  test('protocolos globais: qualquer logado lê; só a plataforma publica', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'protocolos', 'limao'), { nome: 'Limão' });
    });
    await assertSucceeds(getDoc(p(como('pragB1'), 'protocolos', 'limao')));
    await assertFails(getDoc(p(env.unauthenticatedContext().firestore(), 'protocolos', 'limao')));
    await assertFails(setDoc(p(como('adA'), 'protocolos', 'limao'), { nome: 'X' }));
    await assertSucceeds(setDoc(p(como('plat'), 'protocolos', 'limao'), { nome: 'Limão v2' }));
    await assertSucceeds(setDoc(p(como('plat'), 'protocolos', 'limao', 'versoes', '1'), { regras: [] }));
  });
});

describe('convites', () => {
  const CONVITE = 'convite-valido-1234567890abcdef';
  const convidado = (extra = {}) =>
    env.authenticatedContext('novoUid', { email: 'novo@x.com', email_verified: true, ...extra }).firestore();

  async function aceitar(db, conviteId, dadosMembro) {
    const lote = writeBatch(db);
    lote.set(p(db, 'empresas', A, 'membros', 'novoUid'), { ...dadosMembro, conviteId });
    lote.update(p(db, 'empresas', A, 'convites', conviteId), { usadoPor: 'novoUid', usadoEm: serverTimestamp() });
    return lote.commit();
  }
  const termosDoConvite = membro('novoUid', 'pragueiro', ['fA1']);

  test('admin cria convite com código longo; código curto ou papel inválido não', async () => {
    const db = como('adA');
    const base = { email: 'a@x.com', papel: 'gerente', fazendaIds: ['fA1'], expiraEm: amanha(), usadoPor: null, criadoPor: 'adA' };
    await assertSucceeds(setDoc(p(db, 'empresas', A, 'convites', 'codigo-longo-aleatorio-123456'), base));
    await assertFails(setDoc(p(db, 'empresas', A, 'convites', 'curto'), base));
    await assertFails(setDoc(p(db, 'empresas', A, 'convites', 'codigo-longo-aleatorio-654321'), { ...base, papel: 'root' }));
    await assertFails(setDoc(p(como('pragA1'), 'empresas', A, 'convites', 'codigo-longo-aleatorio-999999'), { ...base, criadoPor: 'pragA1' }));
  });

  test('convidado com e-mail verificado aceita o convite nos termos dele', async () => {
    await assertSucceeds(aceitar(convidado(), CONVITE, termosDoConvite));
  });

  test('e-mail não verificado não aceita', async () => {
    await assertFails(aceitar(convidado({ email_verified: false }), CONVITE, termosDoConvite));
  });

  test('e-mail diferente do convidado não aceita', async () => {
    await assertFails(aceitar(convidado({ email: 'outro@x.com' }), CONVITE, termosDoConvite));
  });

  test('não dá para pedir papel ou fazenda maior que a do convite', async () => {
    await assertFails(aceitar(convidado(), CONVITE, membro('novoUid', 'admin_empresa', ['fA1'])));
    await assertFails(aceitar(convidado(), CONVITE, membro('novoUid', 'pragueiro', ['*'])));
  });

  test('convite expirado ou já usado não vale', async () => {
    await assertFails(aceitar(convidado(), 'convite-expirado-1234567890abc', termosDoConvite));
    await assertFails(aceitar(convidado(), 'convite-usado-1234567890abcdef', termosDoConvite));
  });

  test('criar o vínculo sem marcar o convite como usado (reaproveitável) é negado', async () => {
    const db = convidado();
    await assertFails(
      setDoc(p(db, 'empresas', A, 'membros', 'novoUid'), { ...termosDoConvite, conviteId: CONVITE }),
    );
  });

  test('criar o vínculo em nome de outro uid usando um convite é negado', async () => {
    const db = convidado();
    const lote = writeBatch(db);
    lote.set(p(db, 'empresas', A, 'membros', 'outroUid'), { ...membro('outroUid', 'pragueiro', ['fA1']), conviteId: CONVITE });
    lote.update(p(db, 'empresas', A, 'convites', CONVITE), { usadoPor: 'novoUid', usadoEm: serverTimestamp() });
    await assertFails(lote.commit());
  });

  test('listar convites é só do admin', async () => {
    await assertSucceeds(getDocs(collection(como('adA'), 'empresas', A, 'convites')));
    await assertFails(getDocs(collection(convidado(), 'empresas', A, 'convites')));
    await assertFails(getDocs(collection(como('pragA1'), 'empresas', A, 'convites')));
  });
});

describe('escopo por fazenda e papéis', () => {
  test('cadastros: leem quem tem a fazenda no escopo; só o admin escreve', async () => {
    await assertSucceeds(getDoc(p(como('pragA1'), 'empresas', A, 'fazendas', 'fA1')));
    await assertFails(getDoc(p(como('pragA1'), 'empresas', A, 'fazendas', 'fA2')));
    await assertSucceeds(getDoc(p(como('agA'), 'empresas', A, 'talhoes', 'tA2')));
    await assertFails(getDoc(p(como('gerA1'), 'empresas', A, 'talhoes', 'tA2')));

    await assertFails(setDoc(p(como('pragA1'), 'empresas', A, 'fazendas', 'nova'), { nome: 'X' }));
    await assertFails(setDoc(p(como('gerA1'), 'empresas', A, 'fazendas', 'nova'), { nome: 'X' }));
    await assertSucceeds(setDoc(p(como('adA'), 'empresas', A, 'fazendas', 'nova'), { nome: 'X' }));
  });

  test('admin cadastra talhão válido; protocolo malformado ou fazenda trocada não passam', async () => {
    const db = como('adA');
    const bom = { fazendaId: 'fA1', nome: 'T9', culturaId: 'limao-tahiti', protocolo: PROTOCOLO, areaHa: 5 };
    await assertSucceeds(setDoc(p(db, 'empresas', A, 'talhoes', 'tNovo'), bom));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 'tRuim'), { ...bom, protocolo: 'texto' }));
    await assertFails(setDoc(p(db, 'empresas', A, 'talhoes', 'tRuim2'), { ...bom, areaHa: -1 }));
    await assertFails(updateDoc(p(db, 'empresas', A, 'talhoes', 'tA1'), { fazendaId: 'fA2' }));
  });

  test('avaliações: pragueiro só as próprias; gerente e agrônomo conforme o escopo', async () => {
    await assertSucceeds(getDoc(p(como('pragA1'), 'empresas', A, 'avaliacoes', AV1)));
    await assertFails(getDoc(p(como('pragA1'), 'empresas', A, 'avaliacoes', AV2)));
    await assertSucceeds(getDoc(p(como('gerA1'), 'empresas', A, 'avaliacoes', AV1)));
    await assertFails(getDoc(p(como('gerA1'), 'empresas', A, 'avaliacoes', AV2)));
    await assertSucceeds(getDoc(p(como('agA'), 'empresas', A, 'avaliacoes', AV2)));
    await assertSucceeds(getDoc(p(como('adA'), 'empresas', A, 'avaliacoes', AV2)));
  });

  test('consulta do pragueiro precisa filtrar por responsavelUid', async () => {
    const db = como('pragA1');
    await assertSucceeds(getDocs(query(collection(db, 'empresas', A, 'avaliacoes'), where('responsavelUid', '==', 'pragA1'))));
    await assertFails(getDocs(collection(db, 'empresas', A, 'avaliacoes')));
  });

  test('agrônomo lista todas as avaliações da empresa', async () => {
    await assertSucceeds(getDocs(collection(como('agA'), 'empresas', A, 'avaliacoes')));
  });
});

describe('avaliação (cabeçalho)', () => {
  const nova = (extra = {}) => ({
    fazendaId: 'fA1', talhaoId: 'tA1', semanaISO: '2026-W39', data: '2026-09-22',
    responsavelUid: 'pragA1', status: 'rascunho', protocolo: PROTOCOLO, ...extra,
  });
  const ID_NOVA = 'tA1_2026-W39_pragA1';
  const ref = (db, id = ID_NOVA) => p(db, 'empresas', A, 'avaliacoes', id);

  test('pragueiro cria a própria, com id no padrão talhão_semana_uid', async () => {
    await assertSucceeds(setDoc(ref(como('pragA1')), nova()));
  });

  test('id fora do padrão, dono trocado ou já finalizada: negado', async () => {
    const db = como('pragA1');
    await assertFails(setDoc(ref(db, 'qualquer-id'), nova()));
    await assertFails(setDoc(ref(db), nova({ responsavelUid: 'pragA2' })));
    await assertFails(setDoc(ref(db), nova({ status: 'finalizada' })));
  });

  test('fazenda fora do escopo, talhão de outra fazenda ou protocolo diferente do talhão: negado', async () => {
    const db = como('pragA1');
    await assertFails(setDoc(ref(db, 'tA2_2026-W39_pragA1'), nova({ fazendaId: 'fA2', talhaoId: 'tA2' })));
    await assertFails(setDoc(ref(db, 'tA2_2026-W39_pragA1'), nova({ talhaoId: 'tA2' })));
    await assertFails(setDoc(ref(db), nova({ protocolo: { id: 'outro', versao: 9 } })));
  });

  test('campos inválidos ou extras: negado', async () => {
    const db = como('pragA1');
    await assertFails(setDoc(ref(db), nova({ semanaISO: '39' })));
    await assertFails(setDoc(ref(db), nova({ data: '22/09/2026' })));
    await assertFails(setDoc(ref(db), nova({ admin: true })));
  });

  test('só pragueiro cria avaliação', async () => {
    for (const uid of ['gerA1', 'agA', 'adA']) {
      await assertFails(setDoc(ref(como(uid)), nova({ responsavelUid: uid })));
    }
  });

  test('pragueiro edita o rascunho e finaliza com carimbo de hora do servidor', async () => {
    const r = p(como('pragA1'), 'empresas', A, 'avaliacoes', AV1);
    await assertSucceeds(updateDoc(r, { faseCultura: ['chumbinho'], notas: 'ok' }));
    await assertFails(updateDoc(r, { status: 'finalizada' })); // sem finalizadaEm
    await assertSucceeds(updateDoc(r, { status: 'finalizada', finalizadaEm: serverTimestamp() }));
  });

  test('identidade da avaliação não muda; finalizada é imutável', async () => {
    const r = p(como('pragA1'), 'empresas', A, 'avaliacoes', AV1);
    await assertFails(updateDoc(r, { talhaoId: 'tA2' }));
    await assertFails(updateDoc(r, { responsavelUid: 'pragA2' }));
    await assertFails(updateDoc(r, { semanaISO: '2026-W40' }));
    await assertFails(updateDoc(r, { protocolo: { id: 'x', versao: 1 } }));
    const fin = p(como('pragA1'), 'empresas', A, 'avaliacoes', AV1_FIN);
    await assertFails(updateDoc(fin, { status: 'rascunho' }));
    await assertFails(updateDoc(fin, { notas: 'depois' }));
  });

  test('ninguém apaga', async () => {
    for (const uid of ['pragA1', 'agA', 'adA']) {
      await assertFails(deleteDoc(p(como(uid), 'empresas', A, 'avaliacoes', AV1)));
    }
  });
});

describe('plantas', () => {
  const planta = (n) => p(como('pragA1'), 'empresas', A, 'avaliacoes', AV1, 'plantas', String(n));

  test('pragueiro grava plantas 1 a 30 na própria avaliação em rascunho', async () => {
    await assertSucceeds(setDoc(planta(2), { n: 2, obs: { tripes_flor: { A: 1, B: null } } }));
    await assertSucceeds(setDoc(planta(30), { n: 30, obs: {} }));
    await assertSucceeds(updateDoc(planta(1), { 'obs.tripes_flor': { A: 3, B: 0 } }));
  });

  test('plantas fora de 1 a 30, campos extras ou obs inválido: negado', async () => {
    await assertFails(setDoc(planta(0), { n: 0, obs: {} }));
    await assertFails(setDoc(planta(31), { n: 31, obs: {} }));
    await assertFails(setDoc(planta('01'), { n: 1, obs: {} }));
    await assertFails(setDoc(planta(3), { n: 3, obs: {}, admin: true }));
    await assertFails(setDoc(planta(3), { n: 3, obs: 'texto' }));
    await assertFails(setDoc(planta(3), { n: '3', obs: {} }));
  });

  test('avaliação finalizada não aceita mais plantas', async () => {
    const db = como('pragA1');
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'empresas', A, 'avaliacoes', AV1_FIN, 'plantas', '1'), { n: 1, obs: {} });
    });
    await assertFails(setDoc(p(db, 'empresas', A, 'avaliacoes', AV1_FIN, 'plantas', '2'), { n: 2, obs: {} }));
    await assertFails(updateDoc(p(db, 'empresas', A, 'avaliacoes', AV1_FIN, 'plantas', '1'), { notas: 'x' }));
  });

  test('outro pragueiro (mesma empresa) não lê nem grava planta alheia', async () => {
    const db = como('pragA2');
    await assertFails(getDoc(p(db, 'empresas', A, 'avaliacoes', AV1, 'plantas', '1')));
    await assertFails(setDoc(p(db, 'empresas', A, 'avaliacoes', AV1, 'plantas', '2'), { n: 2, obs: {} }));
  });

  test('gerente e agrônomo leem conforme o escopo, mas não gravam', async () => {
    await assertSucceeds(getDoc(p(como('agA'), 'empresas', A, 'avaliacoes', AV1, 'plantas', '1')));
    await assertSucceeds(getDoc(p(como('gerA1'), 'empresas', A, 'avaliacoes', AV1, 'plantas', '1')));
    await assertFails(getDoc(p(como('gerA2'), 'empresas', A, 'avaliacoes', AV1, 'plantas', '1')));
    await assertFails(setDoc(p(como('agA'), 'empresas', A, 'avaliacoes', AV1, 'plantas', '2'), { n: 2, obs: {} }));
  });

  test('ninguém apaga planta', async () => {
    await assertFails(deleteDoc(planta(1)));
  });
});

describe('decisões (agrônomo decide, gerente executa)', () => {
  const nova = (extra = {}) => ({
    avaliacaoId: AV1_FIN, talhaoId: 'tA1', fazendaId: 'fA1', tds: ['TD2'], status: 'aprovada',
    decididoPor: 'agA', decididoEm: serverTimestamp(), ...extra,
  });
  const semDecisao = async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await deleteDoc(doc(ctx.firestore(), 'empresas', A, 'decisoes', AV1_FIN));
    });
  };

  test('agrônomo decide uma avaliação finalizada, com id = id da avaliação', async () => {
    await semDecisao();
    await assertSucceeds(setDoc(p(como('agA'), 'empresas', A, 'decisoes', AV1_FIN), nova()));
  });

  test('não decide avaliação em rascunho, com id trocado ou em nome de outro', async () => {
    await semDecisao();
    const db = como('agA');
    await assertFails(setDoc(p(db, 'empresas', A, 'decisoes', AV1), nova({ avaliacaoId: AV1 })));
    await assertFails(setDoc(p(db, 'empresas', A, 'decisoes', 'outro-id'), nova()));
    await assertFails(setDoc(p(db, 'empresas', A, 'decisoes', AV1_FIN), nova({ decididoPor: 'adA' })));
    await assertFails(setDoc(p(db, 'empresas', A, 'decisoes', AV1_FIN), nova({ status: 'executada' })));
    await assertFails(setDoc(p(db, 'empresas', A, 'decisoes', AV1_FIN), nova({ fazendaId: 'fA2' })));
  });

  test('gerente, pragueiro e admin não criam decisão', async () => {
    await semDecisao();
    for (const uid of ['gerA1', 'pragA1', 'adA']) {
      await assertFails(setDoc(p(como(uid), 'empresas', A, 'decisoes', AV1_FIN), nova({ decididoPor: uid })));
    }
  });

  test('decisão já tomada não é reescrita pelo agrônomo', async () => {
    await assertFails(setDoc(p(como('agA'), 'empresas', A, 'decisoes', AV1_FIN), nova()));
    await assertFails(updateDoc(p(como('agA'), 'empresas', A, 'decisoes', AV1_FIN), { status: 'rejeitada' }));
  });

  test('gerente da fazenda marca como executada; só esses campos', async () => {
    const r = p(como('gerA1'), 'empresas', A, 'decisoes', AV1_FIN);
    await assertFails(updateDoc(r, { status: 'executada', executadoPor: 'gerA1', executadoEm: serverTimestamp(), tds: ['TD1'] }));
    await assertFails(updateDoc(r, { status: 'executada', executadoPor: 'outro', executadoEm: serverTimestamp() }));
    await assertSucceeds(updateDoc(r, { status: 'executada', executadoPor: 'gerA1', executadoEm: serverTimestamp(), observacaoExecucao: 'feito' }));
    await assertFails(updateDoc(r, { status: 'aprovada' })); // já executada
  });

  test('gerente de outra fazenda não executa', async () => {
    await assertFails(
      updateDoc(p(como('gerA2'), 'empresas', A, 'decisoes', AV1_FIN), {
        status: 'executada', executadoPor: 'gerA2', executadoEm: serverTimestamp(),
      }),
    );
  });

  test('leitura: gestão conforme o escopo; pragueiro não lê', async () => {
    await assertSucceeds(getDoc(p(como('agA'), 'empresas', A, 'decisoes', AV1_FIN)));
    await assertSucceeds(getDoc(p(como('gerA1'), 'empresas', A, 'decisoes', AV1_FIN)));
    await assertFails(getDoc(p(como('gerA2'), 'empresas', A, 'decisoes', AV1_FIN)));
    await assertFails(getDoc(p(como('pragA1'), 'empresas', A, 'decisoes', AV1_FIN)));
  });

  test('ninguém apaga decisão', async () => {
    await assertFails(deleteDoc(p(como('agA'), 'empresas', A, 'decisoes', AV1_FIN)));
  });
});

describe('eventos (trilha de auditoria)', () => {
  test('cada um registra o próprio evento; não falsifica autor nem hora', async () => {
    const db = como('pragA1');
    await assertSucceeds(setDoc(p(db, 'empresas', A, 'eventos', 'e1'), { uid: 'pragA1', acao: 'finalizou', em: serverTimestamp() }));
    await assertFails(setDoc(p(db, 'empresas', A, 'eventos', 'e2'), { uid: 'agA', acao: 'finalizou', em: serverTimestamp() }));
    await assertFails(setDoc(p(db, 'empresas', A, 'eventos', 'e3'), { uid: 'pragA1', acao: 'finalizou', em: Timestamp.fromDate(new Date('2020-01-01')) }));
  });

  test('não se altera nem se apaga; leitura só de admin e agrônomo', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'empresas', A, 'eventos', 'e9'), { uid: 'pragA1', acao: 'x', em: Timestamp.now() });
    });
    await assertFails(updateDoc(p(como('pragA1'), 'empresas', A, 'eventos', 'e9'), { acao: 'y' }));
    await assertFails(deleteDoc(p(como('adA'), 'empresas', A, 'eventos', 'e9')));
    await assertSucceeds(getDoc(p(como('adA'), 'empresas', A, 'eventos', 'e9')));
    await assertSucceeds(getDoc(p(como('agA'), 'empresas', A, 'eventos', 'e9')));
    await assertFails(getDoc(p(como('pragA1'), 'empresas', A, 'eventos', 'e9')));
  });
});

test('coleções inexistentes na proposta continuam fechadas', async () => {
  await assertFails(getDoc(p(como('adA'), 'resultados', 'x')));
  await assertFails(setDoc(p(como('adA'), 'qualquer', 'x'), { a: 1 }));
  await assertFails(setDoc(p(como('adA'), 'empresas', A, 'segredos', 'x'), { a: 1 }));
});
