import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ouvirComRetentativa } from '../src/campo/retentativa.js';

// agenda de mentira: guarda as tentativas e roda quando mandamos
function agenda() {
  const fila = [];
  return {
    agendar: (f, ms) => { fila.push({ f, ms }); return fila.length - 1; },
    cancelarAgenda: (id) => { if (fila[id]) fila[id].f = null; },
    fila,
    rodar: () => { const t = fila.shift(); t?.f?.(); return t?.ms; },
  };
}
const erro = (code) => Object.assign(new Error(code), { code });

test('erro passageiro: reinscreve com espera crescente e volta a funcionar', () => {
  const a = agenda();
  const tentativas = [];
  const recebidos = [];
  const assinar = (mudou, falhou) => {
    tentativas.push({ mudou, falhou });
    return () => {};
  };
  ouvirComRetentativa(assinar, (d) => recebidos.push(d), () => assert.fail('não devia desistir'), { agendar: a.agendar, cancelarAgenda: a.cancelarAgenda });

  tentativas[0].falhou(erro('permission-denied')); // servidor ainda não conhece a avaliação
  assert.equal(a.rodar(), 500);
  tentativas[1].falhou(erro('permission-denied'));
  assert.equal(a.rodar(), 1000);
  tentativas[2].falhou(erro('unavailable'));
  assert.equal(a.rodar(), 2000);
  assert.equal(tentativas.length, 4);
  tentativas[3].mudou({ pendentes: 0 }); // o cabeçalho chegou: agora vale
  assert.deepEqual(recebidos, [{ pendentes: 0 }]);
});

test('a espera tem teto; funcionar zera a contagem', () => {
  const a = agenda();
  const t = [];
  ouvirComRetentativa((m, f) => { t.push({ m, f }); return () => {}; }, () => {}, () => assert.fail('x'), { agendar: a.agendar, cancelarAgenda: a.cancelarAgenda, atrasoMaximoMs: 2000 });
  const esperas = [];
  for (let i = 0; i < 5; i += 1) { t[i].f(erro('permission-denied')); esperas.push(a.rodar()); }
  assert.deepEqual(esperas, [500, 1000, 2000, 2000, 2000]);
  t[5].m({}); // sucesso
  t[5].f(erro('unavailable'));
  assert.equal(a.rodar(), 500); // recomeça do menor atraso
});

test('erro que não passa, ou tentativas esgotadas: desiste e avisa', () => {
  const a = agenda();
  const t = [];
  const falhas = [];
  ouvirComRetentativa((m, f) => { t.push({ m, f }); return () => {}; }, () => {}, (e) => falhas.push(e.code), { agendar: a.agendar, cancelarAgenda: a.cancelarAgenda, maxTentativas: 2 });
  t[0].f(erro('failed-precondition')); // ex.: índice ainda em construção
  assert.deepEqual(falhas, ['failed-precondition']);
  assert.equal(a.fila.length, 0);

  const b = agenda();
  const u = [];
  const f2 = [];
  ouvirComRetentativa((m, f) => { u.push({ m, f }); return () => {}; }, () => {}, (e) => f2.push(e.code), { agendar: b.agendar, cancelarAgenda: b.cancelarAgenda, maxTentativas: 2 });
  u[0].f(erro('permission-denied')); b.rodar();
  u[1].f(erro('permission-denied')); b.rodar();
  u[2].f(erro('permission-denied')); // terceira falha: esgotou
  assert.deepEqual(f2, ['permission-denied']);
  assert.equal(b.fila.length, 0);
});

test('cancelar para tudo: a assinatura atual e a tentativa agendada', () => {
  const a = agenda();
  let cancelou = 0;
  const t = [];
  const parar = ouvirComRetentativa((m, f) => { t.push({ m, f }); return () => { cancelou += 1; }; }, () => {}, () => {}, { agendar: a.agendar, cancelarAgenda: a.cancelarAgenda });
  t[0].f(erro('permission-denied')); // agenda nova tentativa
  parar();
  a.rodar(); // a tentativa agendada não deve reinscrever
  assert.equal(t.length, 1);

  const b = agenda();
  const u = [];
  let c2 = 0;
  const parar2 = ouvirComRetentativa((m, f) => { u.push({ m, f }); return () => { c2 += 1; }; }, () => {}, () => {}, { agendar: b.agendar, cancelarAgenda: b.cancelarAgenda });
  parar2();
  assert.equal(c2, 1);
  u[0].f(erro('permission-denied')); // erro tardio depois de parar: ignorado
  assert.equal(b.fila.length, 0);
});
