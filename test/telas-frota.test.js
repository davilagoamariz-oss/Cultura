// Renderiza as telas da Frota (módulo, administração do maquinário e a tela de uso) e confere o que
// cada papel vê e toca.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';

let R;
before(async () => {
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  const saida = `${raiz}node_modules/.cache/ronda-telas`;
  mkdirSync(saida, { recursive: true });
  const bundle = await rolldown({ input: `${raiz}test/telas/entrada.jsx`, platform: 'node', logLevel: 'silent', transform: { define: { 'import.meta.env': '({})' } } });
  const arquivo = `${saida}/telas-frota.mjs`;
  await bundle.write({ file: arquivo, format: 'esm' });
  R = await import(`${pathToFileURL(arquivo).href}?t=${Date.now()}`);
});

const limpar = (h) => h.replaceAll('<!-- -->', '').replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
const conta = (h, trecho) => h.split(trecho).length - 1;

// ---------------------------------------------------------------- módulo (escolha de setor)

const setores = { 'frota-1': { nome: 'Frota', unidadeId: 'un-1', modulos: ['frota'], ativo: true } };
const vinc = (funcoes, papel = 'funcionario') => [{ setorId: 'frota-1', unidadeId: 'un-1', papel, funcoes, ativo: true }];

test('módulo Frota: operador vê seu papel e o cartão de Máquinas', () => {
  const h = limpar(R.renderizar('Frota', R.sessaoDeMentira({ vinculos: vinc(['operador']), setores, unidades: { 'un-1': { nome: 'Fazenda 1' } } })));
  assert.match(h, /Operador/);
  assert.match(h, /href="\/frota\/maquinas"/);
  assert.match(h, />Máquinas</);
});

// ---------------------------------------------------------------- administração do maquinário

const unidades = [{ id: 'un-1', nome: 'Fazenda 1', ativa: true }, { id: 'un-2', nome: 'Fazenda 2', ativa: true }];
const maquina = (extra = {}) => ({ id: 'trator-01', unidadeId: 'un-1', nome: 'Trator 01', ativo: true, disponibilidade: 'disponivel', status: 'operacional', combustivel: 0.8, ...extra });
const nada = () => true;

test('admin: máquinas agrupadas por fazenda, com o cadastro e a edição', () => {
  const h = limpar(R.renderizarAdmin('Maquinas', { unidades, maquinas: [maquina()], aoCriar: nada, aoAlterar: nada, aoMarcarUrgente: nada, aoConcluir: nada, ocupado: false }));
  assert.match(h, /aria-label="Máquinas de Fazenda 1"/);
  assert.match(h, /aria-label="Máquinas de Fazenda 2"/);
  assert.match(h, /Trator 01/);
  assert.match(h, /Disponível · Operacional · combustível 80%/);
  assert.match(h, /Sem máquinas\./); // Fazenda 2 não tem nenhuma
  assert.match(h, /\+ Nova máquina/);
  assert.match(h, /Combustível inicial/);
  assert.match(h, /Editar Trator 01/);
});

test('admin: a manutenção só oferece o botão que faz sentido no status atual', () => {
  const operacional = limpar(R.renderizarAdmin('Maquinas', { unidades, maquinas: [maquina()], aoCriar: nada, aoAlterar: nada, aoMarcarUrgente: nada, aoConcluir: nada, ocupado: false }));
  assert.match(operacional, /Marcar urgente/);
  assert.doesNotMatch(operacional, /Concluir manutenção/);
  const precisaManutencao = limpar(R.renderizarAdmin('Maquinas', { unidades, maquinas: [maquina({ status: 'precisa_manutencao' })], aoCriar: nada, aoAlterar: nada, aoMarcarUrgente: nada, aoConcluir: nada, ocupado: false }));
  assert.doesNotMatch(precisaManutencao, /Marcar urgente/);
  assert.match(precisaManutencao, /Concluir manutenção/);
});

test('admin: máquina desativada aparece marcada', () => {
  const h = limpar(R.renderizarAdmin('Maquinas', { unidades, maquinas: [maquina({ ativo: false })], aoCriar: nada, aoAlterar: nada, aoMarcarUrgente: nada, aoConcluir: nada, ocupado: false }));
  assert.match(h, /Trator 01 <span class="selo selo--alerta">Desativado/);
});

// ---------------------------------------------------------------- tela de uso (operador)

test('operador: máquina disponível oferece "Iniciar uso"; sem a função, só um aviso', () => {
  const doOperador = limpar(R.renderizarFrota('Maquinas', { maquinas: [maquina()], ehOperador: true, meuUid: 'u1', aoIniciar: nada, aoEncerrar: nada, aoSugerir: nada, ocupado: false }));
  assert.match(doOperador, /Iniciar uso/);
  const semFuncao = limpar(R.renderizarFrota('Maquinas', { maquinas: [maquina()], ehOperador: false, meuUid: 'u1', aoIniciar: nada, aoEncerrar: nada, aoSugerir: nada, ocupado: false }));
  assert.doesNotMatch(semFuncao, /Iniciar uso/);
  assert.match(semFuncao, /não tem a função de operador/);
});

test('operador: em uso por mim mostra encerrar (com combustível); em uso por outro só avisa', () => {
  const porMim = limpar(R.renderizarFrota('Maquinas', {
    maquinas: [maquina({ disponibilidade: 'em_uso', usoAtual: { usoId: 'u1', operadorUid: 'eu', setorId: 'frota-1' } })],
    ehOperador: true, meuUid: 'eu', aoIniciar: nada, aoEncerrar: nada, aoSugerir: nada, ocupado: false,
  }));
  assert.match(porMim, /Encerrar uso/);
  assert.match(porMim, /Combustível ao encerrar/);
  assert.doesNotMatch(porMim, /Iniciar uso/);

  const porOutro = limpar(R.renderizarFrota('Maquinas', {
    maquinas: [maquina({ disponibilidade: 'em_uso', usoAtual: { usoId: 'u1', operadorUid: 'outra-pessoa', setorId: 'frota-1' } })],
    ehOperador: true, meuUid: 'eu', aoIniciar: nada, aoEncerrar: nada, aoSugerir: nada, ocupado: false,
  }));
  assert.doesNotMatch(porOutro, /Encerrar uso/);
  assert.doesNotMatch(porOutro, /Iniciar uso/);
  assert.match(porOutro, /Em uso por outra pessoa/);
});

test('qualquer um sinaliza um problema quando a máquina está operacional; some quando já está sinalizada', () => {
  const ok = limpar(R.renderizarFrota('Maquinas', { maquinas: [maquina()], ehOperador: false, meuUid: 'u1', aoIniciar: nada, aoEncerrar: nada, aoSugerir: nada, ocupado: false }));
  assert.match(ok, /Sinalizar um problema/);
  const jaSinalizada = limpar(R.renderizarFrota('Maquinas', { maquinas: [maquina({ status: 'manutencao_sugerida' })], ehOperador: false, meuUid: 'u1', aoIniciar: nada, aoEncerrar: nada, aoSugerir: nada, ocupado: false }));
  assert.doesNotMatch(jaSinalizada, /Sinalizar um problema/);
  assert.match(jaSinalizada, /class="selo selo--alerta">Manutenção sugerida/); // status de atenção fica marcado
});

test('sem máquina ativa nenhuma: orientação para o admin cadastrar', () => {
  const h = limpar(R.renderizarFrota('Maquinas', { maquinas: [], ehOperador: true, meuUid: 'u1', aoIniciar: nada, aoEncerrar: nada, aoSugerir: nada, ocupado: false }));
  assert.match(h, /Nenhuma máquina ativa nesta fazenda/);
});
