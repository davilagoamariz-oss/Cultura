import { test } from 'node:test';
import assert from 'node:assert/strict';
import { criarSalvador } from '../src/campo/autosave.js';

// relógio de mentira
function relogio() {
  const tarefas = [];
  let id = 0;
  return {
    agendar: (f, ms) => { id += 1; tarefas.push({ id, f, ms }); return id; },
    cancelar: (i) => { const k = tarefas.findIndex((t) => t.id === i); if (k >= 0) tarefas.splice(k, 1); },
    tarefas,
    passar: () => { const t = tarefas.shift(); t?.f(); return t?.ms; },
  };
}
const novo = (extra = {}) => {
  const r = relogio();
  const gravados = [];
  const s = criarSalvador({ salvar: (e) => gravados.push(e), agendar: r.agendar, cancelar: r.cancelar, ...extra });
  return { r, s, gravados };
};

test('toques seguidos viram UMA gravação, com o último estado', () => {
  const { r, s, gravados } = novo();
  s.mudou({ obs: 1 });
  s.mudou({ obs: 2 });
  s.mudou({ obs: 3 });
  assert.equal(r.tarefas.length, 1); // cada toque reagenda; só resta uma espera
  assert.equal(s.pendente, true);
  assert.equal(r.passar(), 300);
  assert.deepEqual(gravados, [{ obs: 3 }]);
  assert.equal(s.pendente, false);
});

test('nunca grava um estado antigo: cada gravação leva o mais recente', () => {
  const { r, s, gravados } = novo();
  s.mudou({ obs: 'a' });
  r.passar();
  s.mudou({ obs: 'b' });
  s.mudou({ obs: 'c' });
  r.passar();
  assert.deepEqual(gravados, [{ obs: 'a' }, { obs: 'c' }]);
});

test('sair da tela grava na hora, sem esperar os 300 ms', () => {
  const { r, s, gravados } = novo();
  s.mudou({ obs: 'ultimo toque' });
  assert.equal(s.flush(), true);
  assert.deepEqual(gravados, [{ obs: 'ultimo toque' }]);
  assert.equal(r.tarefas.length, 0); // a espera pendente foi cancelada: não grava de novo
  assert.equal(s.pendente, false);
});

test('flush sem nada alterado não grava (abrir e sair não escreve no banco)', () => {
  const { s, gravados } = novo();
  assert.equal(s.flush(), false);
  s.mudou({ obs: 1 });
  s.flush();
  assert.equal(s.flush(), false); // já gravado
  assert.equal(gravados.length, 1);
});

test('gravar duas vezes o mesmo estado não acontece', () => {
  const { r, s, gravados } = novo();
  s.mudou({ obs: 1 });
  r.passar();
  assert.equal(r.tarefas.length, 0);
  s.flush();
  assert.equal(gravados.length, 1);
});

test('mexer de novo depois de gravar volta a gravar', () => {
  const { r, s, gravados } = novo();
  s.mudou({ obs: 1 });
  s.flush();
  s.mudou({ obs: 2 });
  assert.equal(s.pendente, true);
  r.passar();
  assert.deepEqual(gravados, [{ obs: 1 }, { obs: 2 }]);
});

test('a espera é configurável e a gravação pode ser descartada', () => {
  const { r, s, gravados } = novo({ esperaMs: 1000 });
  s.mudou({ obs: 1 });
  assert.equal(r.tarefas[0].ms, 1000);
  s.descartar();
  assert.equal(r.tarefas.length, 0);
  assert.equal(s.pendente, false);
  s.flush();
  assert.deepEqual(gravados, []);
});

test('se salvar falhar, o erro chega a quem chamou e o salvador continua funcionando', () => {
  const r = relogio();
  let falhar = true;
  const gravados = [];
  const s = criarSalvador({ salvar: (e) => { if (falhar) throw new Error('sem espaço'); gravados.push(e); }, agendar: r.agendar, cancelar: r.cancelar });
  s.mudou({ obs: 1 });
  assert.throws(() => s.flush(), /sem espaço/);
  falhar = false;
  s.mudou({ obs: 2 });
  s.flush();
  assert.deepEqual(gravados, [{ obs: 2 }]);
});

test('cada tela tem o seu salvador: um não grava o estado do outro (planta 3 x planta 4)', () => {
  const r = relogio();
  const gravados = [];
  const planta3 = criarSalvador({ salvar: (e) => gravados.push(['planta 3', e]), agendar: r.agendar, cancelar: r.cancelar });
  const planta4 = criarSalvador({ salvar: (e) => gravados.push(['planta 4', e]), agendar: r.agendar, cancelar: r.cancelar });
  planta3.mudou({ obs: 'da 3' });
  planta3.flush(); // sai da planta 3
  planta4.mudou({ obs: 'da 4' });
  planta4.flush();
  assert.deepEqual(gravados, [['planta 3', { obs: 'da 3' }], ['planta 4', { obs: 'da 4' }]]);
});
