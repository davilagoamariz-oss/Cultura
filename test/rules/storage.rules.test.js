// Testes do storage.rules (fotos de avaliação), com DUAS empresas.
// Rodar: npm run test:rules   (precisa de Java 21, do firebase-tools e do emulador de Storage)
import { test, before, after } from 'node:test';
import { readFileSync } from 'node:fs';
import { initializeTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing';
import { ref, uploadBytes, getBytes } from 'firebase/storage';

let env;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-ronda',
    firestore: { rules: readFileSync(new URL('../../firestore.rules', import.meta.url), 'utf8') },
    storage: { rules: readFileSync(new URL('../../storage.rules', import.meta.url), 'utf8') },
  });

  // Preparação direta no Firestore (ignora as regras): a mesma estrutura mínima de membros usada
  // pelas storage.rules (firestore.get/exists), sem precisar do resto do cadastro.
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await db.doc('empresas/empA/membros/membroA').set({ uid: 'membroA', papelEmpresa: 'membro', ativo: true });
    await db.doc('empresas/empA/membros/inativoA').set({ uid: 'inativoA', papelEmpresa: 'membro', ativo: false });
    await db.doc('empresas/empB/membros/membroB').set({ uid: 'membroB', papelEmpresa: 'membro', ativo: true });
  });
});

after(async () => {
  await env.cleanup();
});

const como = (uid) => (uid ? env.authenticatedContext(uid) : env.unauthenticatedContext());
const CAMINHO = 'empresas/empA/avaliacoes/av-1/foto1.jpg';
const bytes = new Uint8Array([1, 2, 3, 4]);
const meta = { contentType: 'image/jpeg' };

test('membro ativo da empresa lê e envia foto no caminho da própria empresa', async () => {
  const storage = como('membroA').storage();
  await assertSucceeds(uploadBytes(ref(storage, CAMINHO), bytes, meta));
  await assertSucceeds(getBytes(ref(storage, CAMINHO)));
});

test('membro de OUTRA empresa não lê nem envia (vazamento entre empresas)', async () => {
  const storage = como('membroB').storage();
  await assertFails(getBytes(ref(storage, CAMINHO)));
  await assertFails(uploadBytes(ref(storage, 'empresas/empA/avaliacoes/av-2/foto.jpg'), bytes, meta));
});

test('membro desativado da empresa não lê', async () => {
  await assertFails(getBytes(ref(como('inativoA').storage(), CAMINHO)));
});

test('quem não está logado não lê nem envia', async () => {
  const storage = como(null).storage();
  await assertFails(getBytes(ref(storage, CAMINHO)));
  await assertFails(uploadBytes(ref(storage, 'empresas/empA/avaliacoes/av-3/foto.jpg'), bytes, meta));
});

test('foto maior que 2 MB ou que não é imagem é negada', async () => {
  const storage = como('membroA').storage();
  await assertFails(uploadBytes(ref(storage, 'empresas/empA/avaliacoes/av-4/grande.jpg'), new Uint8Array(3 * 1024 * 1024), meta));
  await assertFails(uploadBytes(ref(storage, 'empresas/empA/avaliacoes/av-5/arquivo.pdf'), bytes, { contentType: 'application/pdf' }));
});

test('uma foto já enviada não pode ser sobrescrita nem apagada', async () => {
  const storage = como('membroA').storage();
  await assertFails(uploadBytes(ref(storage, CAMINHO), new Uint8Array([9]), meta));
});
