// Renderiza as telas reais para cada tipo de usuário e confere o que aparece e o que NÃO aparece.
// Não substitui olhar o app num celular, mas pega tela quebrada, texto errado e menu indevido.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

let R; // { renderizar, sessaoDeMentira }

before(async () => {
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  const saida = `${raiz}node_modules/.cache/ronda-telas`;
  mkdirSync(saida, { recursive: true });
  const bundle = await rolldown({
    input: `${raiz}test/telas/entrada.jsx`,
    platform: 'node',
    logLevel: 'silent',
    // sem variáveis do Vite: o app cai em "não configurado" e não inicializa o Firebase
    transform: { define: { 'import.meta.env': '({})' } },
  });
  const arquivo = `${saida}/telas.mjs`;
  await bundle.write({ file: arquivo, format: 'esm' });
  R = await import(`${pathToFileURL(arquivo).href}?t=${Date.now()}`);
});

const un = { 'un-1': { nome: 'Fazenda 1' } };
const setores = {
  'fit-1': { nome: 'Fitossanidade', unidadeId: 'un-1', modulos: ['fitossanidade'], ativo: true },
  'fit-2': { nome: 'Fito Norte', unidadeId: 'un-1', modulos: ['fitossanidade'], ativo: true },
  'frota-1': { nome: 'Frota', unidadeId: 'un-1', modulos: ['frota'], ativo: true },
  'geral-1': { nome: 'Administrativo', unidadeId: 'un-1', modulos: [], ativo: true },
};
const vinc = (setorId, papel, funcoes, ativo = true) => ({ setorId, unidadeId: 'un-1', papel, funcoes, ativo });
const sessao = (extra) => R.sessaoDeMentira({ setores, unidades: un, ...extra });
// o React separa textos adjacentes com <!-- -->; tira para comparar o texto que a pessoa lê
const html = (tela, extra, rota) => R.renderizar(tela, sessao(extra), rota).replaceAll('<!-- -->', '');

test('início do pragueiro: só Fitossanidade, com o papel dele', () => {
  const h = html('Inicio', { vinculos: [vinc('fit-1', 'funcionario', ['pragueiro'])] });
  assert.match(h, /Fazenda Demonstração/);
  assert.match(h, /href="\/fitossanidade"/);
  assert.match(h, /Pragueiro/);
  assert.doesNotMatch(h, /Nenhum módulo/);
  assert.doesNotMatch(h, /Administra/);
});

test('início de quem só tem vínculo num setor sem módulo: orientação, sem link nenhum', () => {
  const h = html('Inicio', { vinculos: [vinc('geral-1', 'funcionario', [])] });
  assert.match(h, /Nenhum módulo disponível para você/);
  assert.doesNotMatch(h, /Fitossanidade/);
  assert.doesNotMatch(h, /href="\/fitossanidade"/);
});

test('início do motorista (setor Frota, sem função ainda): vê a Frota, não a Fitossanidade', () => {
  const h = html('Inicio', { vinculos: [vinc('frota-1', 'funcionario', [])] });
  assert.match(h, /href="\/frota"/);
  assert.match(h, /Frota/);
  assert.doesNotMatch(h, /Fitossanidade/);
});

test('início do admin sem vínculo: sem módulos operacionais, mas com o caminho para a Administração', () => {
  const h = html('Inicio', { admin: true, vinculos: [] });
  assert.match(h, /Nenhum módulo disponível/);
  assert.match(h, /Administração/);
  assert.match(h, /precisa ter vínculo/);
});

test('cabeçalho: online, nome, empresa, sair; abas só com o que a pessoa pode usar', () => {
  const pragueiro = html('Layout', { vinculos: [vinc('fit-1', 'funcionario', ['pragueiro'])], nome: 'Paulo' });
  assert.match(pragueiro, /Ronda do Pomar/);
  assert.match(pragueiro, /Paulo/);
  assert.match(pragueiro, /Fazenda Demonstração/);
  assert.match(pragueiro, /Online/);
  assert.match(pragueiro, /Sair/);
  assert.match(pragueiro, />Início</);
  assert.match(pragueiro, />Fitossanidade</);
  assert.match(pragueiro, /<main class="conteudo" tabindex="-1">/); // recebe o foco a cada troca de rota (leitor de tela)
  assert.doesNotMatch(pragueiro, /selo--alerta/); // pragueiro não decide nem executa: sem selo de pendências
  assert.doesNotMatch(pragueiro, /Administração/);
  assert.doesNotMatch(pragueiro, /Plataforma/);
  assert.doesNotMatch(pragueiro, /Trocar empresa/);

  const motorista = html('Layout', { vinculos: [vinc('frota-1', 'funcionario', [])] });
  assert.doesNotMatch(motorista, /Fitossanidade/);

  const dono = html('Layout', { admin: true, plataforma: true, vinculos: [], empresas: 2 });
  assert.match(dono, />Administração</);
  assert.match(dono, />Plataforma</);
  assert.match(dono, />Trocar empresa</);
});

test('Fitossanidade do pragueiro: só "Avaliar plantas"', () => {
  const h = html('Fitossanidade', { vinculos: [vinc('fit-1', 'funcionario', ['pragueiro'])] });
  assert.match(h, /Avaliar plantas/);
  assert.doesNotMatch(h, /Acompanhar avaliações/);
  assert.doesNotMatch(h, /Vínculos do setor/);
  assert.match(h, /você é: Pragueiro/);
});

test('Fitossanidade do agrônomo: só "Acompanhar"; do gerente: "Acompanhar" e "Vínculos do setor"', () => {
  const agro = html('Fitossanidade', { vinculos: [vinc('fit-1', 'funcionario', ['agronomo'])] });
  assert.match(agro, /Acompanhar avaliações/);
  assert.doesNotMatch(agro, /Avaliar plantas/);
  assert.doesNotMatch(agro, /Vínculos do setor/);

  const gerente = html('Fitossanidade', { vinculos: [vinc('fit-1', 'gerente', [])] });
  assert.match(gerente, /Acompanhar avaliações/);
  assert.match(gerente, /Vínculos do setor/);
  assert.doesNotMatch(gerente, /Avaliar plantas/);
  assert.match(gerente, /você é: Gerente/);
});

test('Fitossanidade com dois setores: pede a escolha; com um escolhido, mostra e oferece trocar', () => {
  const vinculos = [vinc('fit-1', 'funcionario', ['pragueiro']), vinc('fit-2', 'funcionario', ['pragueiro'])];
  const semEscolha = html('Fitossanidade', { vinculos });
  assert.match(semEscolha, /Escolha o setor/);
  assert.match(semEscolha, /Fitossanidade · Fazenda 1/);
  assert.match(semEscolha, /Fito Norte · Fazenda 1/);
  assert.doesNotMatch(semEscolha, /Avaliar plantas/);

  const escolhido = html('Fitossanidade', { vinculos, setorSalvo: 'fit-2' });
  assert.match(escolhido, /Fito Norte/);
  assert.match(escolhido, /Avaliar plantas/);
  assert.match(escolhido, /Trocar de setor/);
});

test('telas de "sem acesso" explicam cada situação e oferecem sair', () => {
  const casos = [
    ['sem_empresa', /não foi ligada a nenhuma empresa/],
    ['acesso_desativado', /desativado/],
    ['offline', /Sem internet/],
    ['erro', /Não foi possível carregar/],
  ];
  for (const [status, esperado] of casos) {
    const h = html('SemAcesso', { status });
    assert.match(h, esperado, status);
    assert.match(h, /Sair/, status);
    assert.match(h, /Ronda do Pomar/, status);
  }
});

function comNavigator(valor, f) {
  const antes = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  Object.defineProperty(globalThis, 'navigator', { value: valor, configurable: true, writable: true });
  try {
    return f();
  } finally {
    if (antes) Object.defineProperty(globalThis, 'navigator', antes);
    else delete globalThis.navigator;
  }
}

test('indicador online/offline: alerta só quando o navegador diz que caiu a conexão', () => {
  const chip = (nav) => comNavigator(nav, () => html('Layout', { vinculos: [] }));

  const online = chip({ onLine: true });
  assert.match(online, /class="estado estado--online"/);
  assert.match(online, /Online/);
  assert.match(online, /role="status"/);

  const offline = chip({ onLine: false });
  assert.match(offline, /class="estado estado--offline"/);
  assert.match(offline, /Offline/);

  // sem a informação (ex.: ambiente sem onLine), não alarma
  assert.match(chip({}), /estado--online/);
  assert.match(comNavigator(undefined, () => html('Layout', { vinculos: [] })), /estado--online/);
});

test('cartões do módulo levam cada função ao seu lugar', () => {
  const pragueiro = html('Fitossanidade', { vinculos: [vinc('fit-1', 'funcionario', ['pragueiro'])] });
  assert.match(pragueiro, /href="\/fitossanidade\/campo"/);
  assert.doesNotMatch(pragueiro, /acompanhamento|\/fitossanidade\/vinculos/);

  const agronomo = html('Fitossanidade', { vinculos: [vinc('fit-1', 'funcionario', ['agronomo'])] });
  assert.match(agronomo, /href="\/fitossanidade\/acompanhamento"/);
  assert.doesNotMatch(agronomo, /href="\/fitossanidade\/campo"|\/fitossanidade\/vinculos/);

  const gerente = html('Fitossanidade', { vinculos: [vinc('fit-1', 'gerente', [])] });
  assert.match(gerente, /href="\/fitossanidade\/acompanhamento"/);
  assert.match(gerente, /href="\/fitossanidade\/vinculos"/);
  assert.doesNotMatch(gerente, /href="\/fitossanidade\/campo"/);

  const tudo = html('Fitossanidade', { vinculos: [vinc('fit-1', 'gerente', ['pragueiro', 'agronomo'])] });
  for (const rota of ['campo', 'acompanhamento', 'vinculos']) assert.match(tudo, new RegExp(`href="\\/fitossanidade\\/${rota}"`));
  assert.doesNotMatch(tudo, /Próxima fase/); // nada mais é "em breve" no módulo
});

test('administração: os quatro cadastros estão disponíveis e nada é "próxima fase"', () => {
  const h = html('Admin', {});
  for (const rota of ['estrutura', 'membros', 'vinculos', 'limites']) assert.match(h, new RegExp(`href="\\/admin\\/${rota}"`));
  assert.match(h, /Unidades, setores e talhões/);
  assert.match(h, /Limites de ação/);
  assert.doesNotMatch(h, /Próxima fase/);
});
