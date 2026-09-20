import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decidirAcesso, destinoDaRaiz, destinoSemEmpresa } from '../src/nucleo/acesso.js';
import { montarMenu } from '../src/nucleo/menu.js';

const setores = { 'fit-1': { nome: 'Fito', unidadeId: 'un-1', modulos: ['fitossanidade'], ativo: true } };
const menuFito = montarMenu({ vinculos: [{ setorId: 'fit-1', unidadeId: 'un-1', papel: 'funcionario', funcoes: ['pragueiro'], ativo: true }], setores });

const base = { carregando: false, user: { uid: 'u1' }, status: 'ok', ehPlataforma: false, ehAdminEmpresa: false, estruturaPronta: true, menu: menuFito };
const com = (extra) => ({ ...base, ...extra });
const ir = (para) => ({ tipo: 'redirecionar', para });

test('carregando espera; sem login vai para o login (menos a raiz, que decide sozinha)', () => {
  assert.deepEqual(decidirAcesso(com({ carregando: true }), 'empresa'), { tipo: 'esperar' });
  for (const area of ['empresa', 'admin', 'plataforma', 'modulo:fitossanidade']) {
    assert.deepEqual(decidirAcesso(com({ user: null }), area), ir('/login'), area);
  }
});

test('dentro da empresa: só com status ok; senão vai para a tela certa', () => {
  assert.deepEqual(decidirAcesso(base, 'empresa'), { tipo: 'entrar' });
  assert.deepEqual(decidirAcesso(com({ status: 'escolher_empresa' }), 'empresa'), ir('/escolher-empresa'));
  assert.deepEqual(decidirAcesso(com({ status: 'plataforma_apenas' }), 'empresa'), ir('/plataforma'));
  for (const status of ['sem_empresa', 'acesso_desativado', 'offline', 'erro']) {
    assert.deepEqual(decidirAcesso(com({ status }), 'empresa'), ir('/sem-acesso'), status);
  }
});

test('módulo: só quem o tem no menu; espera a estrutura carregar', () => {
  assert.deepEqual(decidirAcesso(base, 'modulo:fitossanidade'), { tipo: 'entrar' });
  assert.deepEqual(decidirAcesso(com({ menu: [] }), 'modulo:fitossanidade'), ir('/inicio')); // motorista
  assert.deepEqual(decidirAcesso(com({ menu: [] }), 'modulo:frota'), ir('/inicio')); // módulo que não existe
  assert.deepEqual(decidirAcesso(com({ estruturaPronta: false, menu: [] }), 'modulo:fitossanidade'), { tipo: 'esperar' });
  assert.deepEqual(decidirAcesso(com({ status: 'escolher_empresa' }), 'modulo:fitossanidade'), ir('/escolher-empresa'));
});

test('administração: só o admin da empresa', () => {
  assert.deepEqual(decidirAcesso(com({ ehAdminEmpresa: true }), 'admin'), { tipo: 'entrar' });
  assert.deepEqual(decidirAcesso(base, 'admin'), ir('/inicio'));
  assert.deepEqual(decidirAcesso(com({ ehPlataforma: true }), 'admin'), ir('/inicio')); // dono da plataforma não é admin de empresa
});

test('plataforma: só o dono; não depende de empresa', () => {
  assert.deepEqual(decidirAcesso(com({ ehPlataforma: true }), 'plataforma'), { tipo: 'entrar' });
  assert.deepEqual(decidirAcesso(com({ ehPlataforma: true, status: 'plataforma_apenas', menu: [] }), 'plataforma'), { tipo: 'entrar' });
  assert.deepEqual(decidirAcesso(base, 'plataforma'), ir('/'));
});

test('área desconhecida nunca abre', () => {
  assert.deepEqual(decidirAcesso(base, 'segredo'), ir('/inicio'));
});

test('a raiz leva cada situação ao destino certo', () => {
  assert.equal(destinoDaRaiz(com({ carregando: true })), null);
  assert.equal(destinoDaRaiz(com({ user: null })), '/login');
  assert.equal(destinoDaRaiz(base), '/inicio');
  assert.equal(destinoDaRaiz(com({ status: 'escolher_empresa' })), '/escolher-empresa');
  assert.equal(destinoDaRaiz(com({ status: 'plataforma_apenas' })), '/plataforma');
  assert.equal(destinoDaRaiz(com({ status: 'sem_empresa' })), '/sem-acesso');
  assert.equal(destinoSemEmpresa('erro'), '/sem-acesso');
});
