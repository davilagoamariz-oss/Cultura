import 'fake-indexeddb/auto';
import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { IDBFactory } from 'fake-indexeddb';
import {
  planejarReducao, proximaQualidade, primeiraQualidade, abrirFila, guardarFoto, obterFoto, listarPendentes, contarPendentes,
  fotosDaAvaliacao, removerFoto, enviarPendentes, ALVO_BYTES, LADO_MAXIMO, LIMITE_BYTES,
} from '../src/offline/fotos.js';

let banco;
beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory(); // banco novo a cada teste
  banco = await abrirFila(globalThis.indexedDB);
});

const foto = (bytes = 1000, tipo = 'image/jpeg') => new Blob([new Uint8Array(bytes)], { type: tipo });
const ctx = { empresaId: 'demo-1', avaliacaoId: 'av-1', planta: 3 };

// ---------------------------------------------------------------- planejamento

test('redução mantém a proporção e nunca aumenta a imagem', () => {
  assert.deepEqual(planejarReducao(4000, 3000), { largura: 1600, altura: 1200 });
  assert.deepEqual(planejarReducao(3000, 4000), { largura: 1200, altura: 1600 });
  assert.deepEqual(planejarReducao(800, 600), { largura: 800, altura: 600 });
  assert.deepEqual(planejarReducao(1600, 1600), { largura: 1600, altura: 1600 });
  assert.throws(() => planejarReducao(0, 100), /dimensões/);
  assert.throws(() => planejarReducao(100, NaN), /dimensões/);
  assert.equal(LADO_MAXIMO, 1600);
});

test('qualidade JPEG desce em degraus e acaba (então reduz as dimensões)', () => {
  const sequencia = [];
  for (let q = primeiraQualidade(); q !== null; q = proximaQualidade(q)) sequencia.push(q);
  assert.deepEqual(sequencia, [0.8, 0.7, 0.6, 0.5, 0.4, 0.3]);
  assert.equal(proximaQualidade(0.3), null);
  assert.equal(proximaQualidade(0.99), null);
  assert.equal(ALVO_BYTES, 300_000);
});

// ---------------------------------------------------------------- fila

test('guardar devolve a referência local e a foto fica pendente, com o arquivo intacto', async () => {
  const { id, caminho } = await guardarFoto(banco, { blob: foto(250_000), ...ctx, itemId: 'tripes_flor', quadrante: 'A' });
  assert.equal(caminho, `local:${id}`);
  assert.match(id, /^[0-9a-f-]{36}$/);
  const salva = await obterFoto(banco, id);
  assert.equal(salva.status, 'pendente');
  assert.equal(salva.tamanho, 250_000);
  assert.equal(salva.blob.size, 250_000);
  assert.equal(salva.blob.type, 'image/jpeg');
  assert.deepEqual([salva.avaliacaoId, salva.planta, salva.itemId, salva.quadrante], ['av-1', 3, 'tripes_flor', 'A']);
  assert.equal(await contarPendentes(banco), 1);
});

test('a fila sobrevive a fechar e reabrir o banco (é o que vale no campo)', async () => {
  const { id } = await guardarFoto(banco, { blob: foto(), ...ctx });
  banco.close();
  const reaberto = await abrirFila(globalThis.indexedDB);
  assert.equal((await obterFoto(reaberto, id)).id, id);
  assert.equal(await contarPendentes(reaberto), 1);
});

test('pendentes em ordem de chegada; por avaliação; remover tira da fila', async () => {
  // sem espera entre elas: várias caem no mesmo milissegundo, e a ordem de chegada tem que se manter
  const a = await guardarFoto(banco, { blob: foto(), ...ctx });
  const b = await guardarFoto(banco, { blob: foto(), ...ctx, planta: 4 });
  const c = await guardarFoto(banco, { blob: foto(), ...ctx, avaliacaoId: 'av-2' });
  assert.deepEqual((await listarPendentes(banco)).map((f) => f.id), [a.id, b.id, c.id]);
  assert.equal((await fotosDaAvaliacao(banco, 'av-1')).length, 2);
  assert.equal((await fotosDaAvaliacao(banco, 'av-2')).length, 1);
  await removerFoto(banco, a.id);
  assert.equal(await obterFoto(banco, a.id), undefined);
  assert.equal(await contarPendentes(banco), 2);
});

test('muitas fotos seguidas mantêm a ordem de chegada', async () => {
  const ids = [];
  for (let i = 0; i < 25; i += 1) ids.push((await guardarFoto(banco, { blob: foto(), ...ctx, planta: (i % 30) + 1 })).id);
  assert.deepEqual((await listarPendentes(banco)).map((f) => f.id), ids);
});

test('recusa o que não é imagem, é grande demais ou não é arquivo', async () => {
  await assert.rejects(guardarFoto(banco, { blob: foto(10, 'application/pdf'), ...ctx }), /só imagens/);
  await assert.rejects(guardarFoto(banco, { blob: foto(LIMITE_BYTES + 1), ...ctx }), /grande demais/);
  await assert.rejects(guardarFoto(banco, { blob: null, ...ctx }), /inválida/);
  await assert.rejects(guardarFoto(banco, { blob: { size: 'x' }, ...ctx }), /inválida/);
  assert.equal(await contarPendentes(banco), 0);
});

// ---------------------------------------------------------------- envio (desligado no plano Spark)

test('com o envio desligado nada é enviado e as fotos continuam pendentes', async () => {
  await guardarFoto(banco, { blob: foto(), ...ctx });
  let chamou = false;
  const r = await enviarPendentes(banco, { ligado: false, enviar: async () => { chamou = true; return 'x'; } });
  assert.equal(chamou, false);
  assert.deepEqual([r.enviadas, r.restantes, r.motivo], [0, 1, 'envio desligado']);
  const sem = await enviarPendentes(banco, { ligado: true, enviar: undefined });
  assert.equal(sem.motivo, 'envio desligado'); // ligado mas sem a função de envio: também não faz nada
  assert.equal(await contarPendentes(banco), 1);
});

test('com o envio ligado envia na ordem e marca como enviadas (liberando o arquivo)', async () => {
  const a = await guardarFoto(banco, { blob: foto(), ...ctx });
  await new Promise((r) => setTimeout(r, 3));
  const b = await guardarFoto(banco, { blob: foto(), ...ctx, planta: 4 });
  const ordem = [];
  const r = await enviarPendentes(banco, { ligado: true, enviar: async (f) => { ordem.push(f.id); return `remoto/${f.id}`; } });
  assert.deepEqual(ordem, [a.id, b.id]);
  assert.deepEqual([r.enviadas, r.restantes, r.motivo], [2, 0, null]);
  const enviada = await obterFoto(banco, a.id);
  assert.equal(enviada.status, 'enviada');
  assert.equal(enviada.caminhoRemoto, `remoto/${a.id}`);
  assert.equal(enviada.blob, undefined);
  assert.equal(await contarPendentes(banco), 0);
});

test('uma falha no envio para e mantém a foto na fila', async () => {
  const a = await guardarFoto(banco, { blob: foto(), ...ctx });
  await new Promise((r) => setTimeout(r, 3));
  const b = await guardarFoto(banco, { blob: foto(), ...ctx, planta: 4 });
  let n = 0;
  const r = await enviarPendentes(banco, { ligado: true, enviar: async () => { n += 1; if (n === 2) throw new Error('sem sinal'); return 'ok'; } });
  assert.deepEqual([r.enviadas, r.restantes], [1, 1]);
  assert.match(r.motivo, /sem sinal/);
  assert.equal((await obterFoto(banco, a.id)).status, 'enviada');
  assert.equal((await obterFoto(banco, b.id)).status, 'pendente');
});
