// Renderiza as telas de administração (com a ficha real) e confere o que o admin vê e toca.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { linhasDeLimites } from '../src/admin/limites.js';
import { lerUnidade, lerSetor, lerTalhao, lerAjuste, lerMembro } from '../src/admin/formularios.js';
import { montarTalhao } from '../src/admin/cadastros.js';

let R;
before(async () => {
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  const saida = `${raiz}node_modules/.cache/ronda-telas`;
  mkdirSync(saida, { recursive: true });
  const bundle = await rolldown({ input: `${raiz}test/telas/entrada.jsx`, platform: 'node', logLevel: 'silent', transform: { define: { 'import.meta.env': '({})' } } });
  const arquivo = `${saida}/telas-admin.mjs`;
  await bundle.write({ file: arquivo, format: 'esm' });
  R = await import(`${pathToFileURL(arquivo).href}?t=${Date.now()}`);
});

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));
const limpar = (h) => h.replaceAll('<!-- -->', '').replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
const tela = (nome, props) => limpar(R.renderizarAdmin(nome, props));
const conta = (t, trecho) => t.split(trecho).length - 1;
const nada = () => true;

const culturas = [{ id: 'limao-tahiti', nome: 'Limão Tahiti', fichaAtual: { fichaId: 'limao-tahiti', versao: 1 } }];
const fichasPorCultura = { 'limao-tahiti': ficha };
const acoes = { aoCriarUnidade: nada, aoAlterarUnidade: nada, aoCriarSetor: nada, aoAlterarSetor: nada, aoCriarTalhao: nada, aoAlterarTalhao: nada };
const base = { unidades: [], setores: [], talhoes: [], culturas, fichasPorCultura, ocupado: false, ...acoes };

// ---------------------------------------------------------------- estrutura

test('sem nenhuma unidade: orientação e o formulário da primeira já aberto', () => {
  const t = tela('Estrutura', base);
  assert.match(t, /Ainda não há unidades/);
  assert.match(t, /<details class="cartao" open=""><summary[^>]*>\+ Nova unidade/);
  assert.match(t, /Criar unidade/);
});

test('unidade com setor e talhão: mostra o que cada um tem e os formulários de edição e criação', () => {
  const t = tela('Estrutura', {
    ...base,
    unidades: [{ id: 'un-1', nome: 'Fazenda Um', municipio: 'Petrolina', ativa: true }, { id: 'un-2', nome: 'Sítio Dois', ativa: false }],
    setores: [{ id: 'fit-1', unidadeId: 'un-1', nome: 'Fitossanidade', modulos: ['fitossanidade'], ativo: true }, { id: 'frota-1', unidadeId: 'un-1', nome: 'Frota', modulos: [], ativo: false }],
    talhoes: [{ id: 't1', unidadeId: 'un-1', nome: 'Talhão 01', culturaId: 'limao-tahiti', variedade: 'Tahiti CPB', areaHa: 7.5, atributos: { tipoPomar: 'novo', citrosVizinhos: true }, ativo: true }],
  });
  assert.match(t, /aria-label="Unidade Fazenda Um"/);
  assert.match(t, /Petrolina/);
  assert.match(t, /Sítio Dois <span class="selo selo--alerta">Desativado/); // unidade desativada aparece marcada
  assert.match(t, /<strong>Fitossanidade <\/strong>/); // setor
  assert.match(t, /Nenhum módulo ligado/);
  assert.match(t, /Limão Tahiti · Tahiti CPB · 7,5 ha · Há outros citros \(laranja, lima, tangerina\) perto · Pomar novo/); // resumo do talhão com os atributos
  assert.match(t, /A mudança vale para as avaliações novas/);
  assert.equal(conta(t, '+ Novo setor'), 2); // um por unidade
  assert.equal(conta(t, '+ Novo talhão'), 2);
  assert.match(t, /Criar setor/);
  assert.match(t, /Criar talhão/);
});

test('o formulário de talhão pede os atributos da ficha; ao editar, a cultura fica fixa e o valor atual vem marcado', () => {
  const novo = tela('FormTalhao', { culturas, fichasPorCultura, aoEnviar: nada, rotuloEnviar: 'Criar talhão' });
  assert.match(novo, /name="atributo:limao-tahiti:tipoPomar"/);
  assert.match(novo, /name="atributo:limao-tahiti:citrosVizinhos"/);
  assert.match(novo, /Pomar adulto/);
  assert.match(novo, /Pomar novo/);
  assert.match(novo, /Variedade/);
  assert.match(novo, /Área em hectares/);
  const edicao = tela('FormTalhao', { inicial: { nome: 'T1', culturaId: 'limao-tahiti', atributos: { tipoPomar: 'novo', citrosVizinhos: true } }, culturas, fichasPorCultura, culturaFixa: true, aoEnviar: nada });
  assert.match(edicao, /<option value="novo" selected="">Pomar novo/);
  assert.match(edicao, /name="atributo:limao-tahiti:citrosVizinhos" checked="" value="sim"/);
  assert.match(edicao, /<select name="culturaId" disabled=""/);
  assert.match(edicao, /<input type="hidden" name="culturaId" value="limao-tahiti"/); // o valor ainda é enviado
});

test('o formulário de setor lista os módulos que o sistema conhece', () => {
  const t = tela('Estrutura', { ...base, unidades: [{ id: 'un-1', nome: 'U', ativa: true }] });
  assert.match(t, /name="modulos" value="fitossanidade"/);
  assert.doesNotMatch(t, /value="frota"/); // módulo que não existe ainda não é oferecido
});

// ---------------------------------------------------------------- limites

test('limites: cada nível com o que vale hoje, de onde vem, e o formulário de ajuste só onde dá', () => {
  const ajustes = [{ id: 'a1', culturaId: 'limao-tahiti', itemId: 'larva_minadora_broto', nivelId: 'pomar-adulto', limite: 0.3, vigenteDe: 1000, criadoPor: 'u9', motivo: 'safra seca' }];
  const linhas = linhasDeLimites(ficha, ajustes, 2000);
  const t = tela('Limites', { linhas, historico: (i, n) => ajustes.filter((a) => a.itemId === i && a.nivelId === n), formatarQuando: () => 'ontem', nomeDe: () => 'Ana', aoAjustar: nada, ocupado: false });
  assert.match(t, /Vale hoje: <b>30%<\/b> · Ajustado pela empresa \(a ficha diz 40%\)/);
  assert.match(t, /Vale hoje: <b>10%<\/b> · Da ficha/);
  assert.match(t, /Sem limite \(o agrônomo decide\)/); // pendentes
  assert.match(t, /Opções da ficha: 5%, 10%, 15%/); // ácaro da ferrugem
  assert.match(t, /Histórico de ajustes \(1\)/);
  assert.match(t, /30% desde ontem · por Ana · safra seca/);
  assert.match(t, /Ajustar/);
  assert.match(t, /nunca é reescrito/);
  // nível sem métrica ajustável não oferece formulário
  const semForm = linhas.filter((l) => !l.ajustavel).length;
  assert.equal(conta(t, 'Este limite não é ajustado por aqui.'), semForm);
});

// ---------------------------------------------------------------- membros e ficha

test('membros: ativos primeiro, o próprio registro sem edição, adicionar pelo código do usuário', () => {
  const t = tela('Membros', {
    membros: [{ id: 'u2', nome: 'Zé', papelEmpresa: 'membro', ativo: false }, { id: 'u1', nome: 'Ana', papelEmpresa: 'admin', ativo: true }, { id: 'abcdef123', papelEmpresa: 'membro', ativo: true }],
    meuUid: 'u1', aoCriar: nada, aoAlterar: nada, ocupado: false,
  });
  assert.ok(t.indexOf('Ana') < t.indexOf('Zé'));
  assert.match(t, /Sem nome \(abcdef…\)/);
  assert.match(t, /Você não altera o próprio registro/);
  assert.equal(conta(t, 'Editar</summary>'), 2); // Zé e o sem nome; a Ana (eu) não
  assert.match(t, /Código do usuário \(UID\)/);
  assert.match(t, /Administrador da empresa/);
});

test('ficha do catálogo: mostra a vigente e só oferece publicar depois de ler o arquivo', () => {
  const sem = tela('PublicarFicha', { culturas, resumo: null, aoLerArquivo: nada, aoPublicar: nada, ocupado: false });
  assert.match(sem, /Ficha vigente: versão 1/);
  assert.doesNotMatch(sem, /Publicar como versão nova/);
  const com = tela('PublicarFicha', { culturas, resumo: { culturaId: 'limao-tahiti', itens: 30, regras: 30, pendentes: 22 }, aoLerArquivo: nada, aoPublicar: nada, ocupado: false });
  assert.match(com, /30 itens · 30 regras · 22 limites pendentes/);
  assert.match(com, /Publicar como versão nova/);
});

// ---------------------------------------------------------------- leitura dos formulários

const fd = (pares) => {
  const f = new FormData();
  for (const [k, v] of pares) f.append(k, v);
  return f;
};

test('ler formulários: caixas marcadas viram verdadeiro, desmarcadas falso', () => {
  assert.deepEqual(lerUnidade(fd([['nome', ' Faz '], ['municipio', ''], ['ativa', 'sim']])), { nome: 'Faz', municipio: '', ativa: true });
  assert.equal(lerUnidade(fd([['nome', 'x']])).ativa, false);
  assert.deepEqual(lerSetor(fd([['nome', 'S'], ['modulos', 'fitossanidade'], ['ativo', 'sim']])), { nome: 'S', modulos: ['fitossanidade'], ativo: true });
  assert.deepEqual(lerSetor(fd([['nome', 'S']])), { nome: 'S', modulos: [], ativo: false });
  assert.deepEqual(lerAjuste(fd([['entrada', ' 12,5 '], ['motivo', ' x ']])), { entrada: '12,5', motivo: 'x' });
  assert.deepEqual(lerMembro(fd([['uid', ' abc '], ['nome', 'A']])), { uid: 'abc', nome: 'A', papelEmpresa: 'membro', ativo: true });
  assert.equal(lerMembro(fd([['uid', 'a'], ['ativo', 'nao']])).ativo, false);
});

test('ler talhão: só os atributos da cultura escolhida e o resultado passa pela validação do cadastro', () => {
  const dados = lerTalhao(fd([['nome', 'T1'], ['culturaId', 'limao-tahiti'], ['areaHa', '7,5'], ['atributo:limao-tahiti:tipoPomar', 'novo'], ['atributo:limao-tahiti:citrosVizinhos', 'sim'], ['atributo:outra:tipoPomar', 'adulto'], ['ativo', 'sim']]), fichasPorCultura);
  assert.deepEqual(dados.atributos, { citrosVizinhos: true, tipoPomar: 'novo' });
  const t = montarTalhao({ ficha, unidadeId: 'un-1', ...dados });
  assert.equal(t.areaHa, 7.5);
  // sem escolher o tipo de pomar: o formulário devolve indefinido e o cadastro recusa
  const semTipo = lerTalhao(fd([['nome', 'T2'], ['culturaId', 'limao-tahiti'], ['ativo', 'sim']]), fichasPorCultura);
  assert.throws(() => montarTalhao({ ficha, unidadeId: 'un-1', ...semTipo }), /Tipo de pomar/);
  // cultura desconhecida não quebra a leitura
  assert.deepEqual(lerTalhao(fd([['nome', 'T'], ['culturaId', 'manga']]), fichasPorCultura).atributos, {});
});
