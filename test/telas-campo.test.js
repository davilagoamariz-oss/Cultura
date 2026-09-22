// Renderiza as telas de campo (com a ficha REAL do limão) e confere o que a pessoa vê e toca.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { agruparPorOrgao, definirGrupo, definirValor, definirItem, obsParaGravar } from '../src/campo/ficha-campo.js';
import { progresso, plantasIncompletas, opcoesDeFase } from '../src/campo/avaliacao.js';
import { montarResumo } from '../src/campo/resumo.js';
import { avaliar } from '../src/dominio/motor/index.js';
import { textoPendentes } from '../src/offline/pendentes.js';

let R;
before(async () => {
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  const saida = `${raiz}node_modules/.cache/ronda-telas`;
  mkdirSync(saida, { recursive: true });
  const bundle = await rolldown({ input: `${raiz}test/telas/entrada.jsx`, platform: 'node', logLevel: 'silent', transform: { define: { 'import.meta.env': '({})' } } });
  const arquivo = `${saida}/telas-campo.mjs`;
  await bundle.write({ file: arquivo, format: 'esm' });
  R = await import(`${pathToFileURL(arquivo).href}?t=${Date.now()}`);
});

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));
const item = (id) => ficha.itens.find((i) => i.id === id);
// tira os comentários do React e volta os caracteres escapados, para comparar o texto que a pessoa lê
const limpar = (h) => h.replaceAll('<!-- -->', '').replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
const tela = (nome, props, rota) => limpar(R.renderizarCampo(nome, props, rota));
const conta = (texto, trecho) => texto.split(trecho).length - 1;
const AID = 't-01_2026-W39_u9';
const tudoAusente = () => agruparPorOrgao(ficha).reduce((o, g) => definirGrupo(o, g, 0), {});

const propsPlanta = (extra = {}) => ({
  ficha, obs: {}, n: 5, total: 30, notas: '', fotos: [], somenteLeitura: false, semFotos: false, aid: AID,
  aoQuadrante() {}, aoItemNulo() {}, aoGrupo() {}, aoNotas() {}, aoFoto() {}, ...extra,
});

// ---------------------------------------------------------------- ficha por planta

test('a ficha por planta é gerada da ficha: 6 órgãos e os 30 itens', () => {
  const h = tela('FormularioPlanta', propsPlanta());
  for (const rotulo of ['Fruto', 'Folha', 'Broto', 'Flor', 'Tronco', 'Planta inteira']) assert.match(h, new RegExp(`>${rotulo}[ <]`), rotulo);
  for (const i of ficha.itens) assert.ok(h.includes(`>${i.nome}<`), i.nome);
  assert.match(h, /Planta 5/);
  assert.match(h, /Toque para mudar/);
  assert.equal(conta(h, 'Tudo ausente'), 6); // um por órgão
  assert.match(h, /Sem fruto \(–\)/);
  assert.match(h, /Sem planta inteira \(–\)/);
});

test('cada item tem dois quadrantes; o bicho-furão tem só o lado da armadilha', () => {
  const h = tela('FormularioPlanta', propsPlanta());
  const botoes = conta(h, 'aria-label="') ;
  assert.ok(botoes > 0);
  // 29 itens de 2 quadrantes + 1 de lado único (só B): 59 células tocáveis + 1 inativa + 30 botões "–" por item
  assert.equal(conta(h, 'celula--inativa'), 1);
  assert.equal(conta(h, 'lado A: '), 29);
  assert.equal(conta(h, 'lado B: '), 30);
  assert.match(h, /só o lado da armadilha/);
});

test('as células mostram o que foi respondido: vazio, não avaliável, ausente e as intensidades', () => {
  let obs = {};
  obs = definirValor(obs, item('tripes_flor'), 'A', 2);
  obs = definirValor(obs, item('tripes_flor'), 'B', 0);
  obs = definirValor(obs, item('joaninha'), 'A', 3);
  obs = definirValor(obs, item('joaninha'), 'B', null);
  obs = definirValor(obs, item('pulgao'), 'A', 1);
  const h = tela('FormularioPlanta', propsPlanta({ obs }));
  assert.match(h, /Tripes, lado A: 2/);
  assert.match(h, /Tripes, lado B: 0/);
  assert.match(h, /Joaninha, lado A: 3/);
  assert.match(h, /Joaninha, lado B: não avaliável/);
  assert.match(h, /Pulgão, lado A: 1/);
  assert.match(h, /Pulgão, lado B: não respondido/);
  for (const c of ['celula--v0', 'celula--v1', 'celula--v2', 'celula--v3', 'celula--nulo', 'celula--vazio']) assert.ok(h.includes(c), c);
});

test('a intensidade nunca depende só da cor: o número está escrito em cada célula', () => {
  const obs = definirItem({}, item('tripes_flor'), 3);
  const h = tela('FormularioPlanta', propsPlanta({ obs }));
  assert.match(h, /celula celula--v3[^>]*>[^<]*<span class="celula__lado">A<\/span>3<\/button>/);
});

test('grupo respondido ganha o selo "completo"; os critérios do manual aparecem nos ácaros', () => {
  const fruto = agruparPorOrgao(ficha)[0];
  const h = tela('FormularioPlanta', propsPlanta({ obs: definirGrupo({}, fruto, 0) }));
  assert.equal(conta(h, 'class="selo">completo'), 1);
  assert.match(h, /30 ou mais ácaros por visada/);
  assert.match(h, /5 ou mais ácaros por visada/);
});

test('notas e foto: campo de 1000 caracteres, câmera traseira, e a foto fica no aparelho', () => {
  const h = tela('FormularioPlanta', propsPlanta({ fotos: [{ caminho: 'local:a' }, { caminho: 'local:b' }], notas: 'foco perto da cerca' }));
  assert.match(h, /maxLength="1000"/);
  assert.match(h, /foco perto da cerca/);
  assert.match(h, /accept="image\/\*"/);
  assert.match(h, /capture="environment"/);
  assert.match(h, /2 foto\(s\) guardada\(s\) neste aparelho \(o envio ainda não está ligado\)/);
  assert.match(tela('FormularioPlanta', propsPlanta()), /Nenhuma foto nesta planta/);
});

test('navegação entre plantas: barra fixa com anterior, posição e próxima; a 30 leva ao resumo', () => {
  const meio = tela('FormularioPlanta', propsPlanta({ n: 5 }));
  assert.match(meio, new RegExp(`href="/fitossanidade/campo/${AID}/planta/4"`));
  assert.match(meio, new RegExp(`href="/fitossanidade/campo/${AID}/planta/6"`));
  assert.match(meio, /5 \/ 30/);
  assert.match(meio, /class="barra-fixa"/);

  const primeira = tela('FormularioPlanta', propsPlanta({ n: 1 }));
  assert.doesNotMatch(primeira, /planta\/0/);
  const ultima = tela('FormularioPlanta', propsPlanta({ n: 30 }));
  assert.match(ultima, /Resumo ›/);
  assert.match(ultima, new RegExp(`href="/fitossanidade/campo/${AID}/resumo"`));
  assert.doesNotMatch(ultima, /planta\/31/);
});

test('repetir planta anterior: só aparece quando o contêiner passa a ação (há o que copiar)', () => {
  const sem = tela('FormularioPlanta', propsPlanta({ n: 5, aoCopiarAnterior: null }));
  assert.doesNotMatch(sem, /Repetir planta/);
  const com = tela('FormularioPlanta', propsPlanta({ n: 5, aoCopiarAnterior: () => {} }));
  assert.match(com, /Repetir planta 4 \(ajuste só as diferenças\)/);
});

test('avaliação finalizada: só leitura (sem ações em bloco, sem foto, células desabilitadas)', () => {
  const h = tela('FormularioPlanta', propsPlanta({ somenteLeitura: true, obs: tudoAusente() }));
  assert.match(h, /Só leitura/);
  assert.equal(conta(h, 'Tudo ausente'), 0);
  assert.equal(conta(h, 'Tirar ou escolher foto'), 0);
  assert.ok(conta(h, 'disabled') >= 59);
});

test('mostra o aviso de erro de gravação e a próxima planta incompleta', () => {
  const h = tela('FormularioPlanta', propsPlanta({ aviso: 'Não foi possível enviar esta planta (permission-denied).', proximaIncompleta: 9 }));
  assert.match(h, /role="alert"/);
  assert.match(h, /permission-denied/);
  assert.match(h, /Próxima planta incompleta: <a[^>]*planta\/9"[^>]*>9<\/a>/);
});

// ---------------------------------------------------------------- grade das 30 plantas

test('grade: 30 plantas com a situação de cada uma e o caminho para continuar', () => {
  const plantas = { 1: tudoAusente(), 2: tudoAusente(), 3: definirItem({}, item('tripes_flor'), 0) };
  const p = progresso(ficha, plantas);
  const h = tela('GradePlantas', { aid: AID, titulo: 't-01', semana: '2026-W39', progresso: p, pendentes: 3, finalizada: false, proxima: 3 });
  assert.equal(conta(h, 'class="ladrilho'), 30);
  assert.equal(conta(h, 'ladrilho--completa'), 2);
  assert.equal(conta(h, 'ladrilho--parcial'), 1);
  assert.equal(conta(h, 'ladrilho--vazia'), 27);
  assert.match(h, /2 de 30 plantas completas · 3 aguardando envio/);
  assert.match(h, /Planta 3: em andamento/);
  assert.match(h, /Continuar na planta 3/);
  assert.match(h, /Resumo e finalizar/);
});

test('grade: planta ainda não confirmada pelo servidor ganha o marcador de pendente', () => {
  const plantas = { 1: tudoAusente(), 2: tudoAusente() };
  const p = progresso(ficha, plantas);
  const h = tela('GradePlantas', { aid: AID, titulo: 't-01', semana: '2026-W39', progresso: p, pendentes: 1, pendentesPorPlanta: { 2: true }, finalizada: false, proxima: 3 });
  assert.equal(conta(h, 'ladrilho--pendente'), 1);
  assert.match(h, /Planta 2: completa, aguardando envio/);
  assert.doesNotMatch(h, /Planta 1: completa, aguardando envio/);
  const sem = tela('GradePlantas', { aid: AID, titulo: 't-01', semana: '2026-W39', progresso: p, pendentes: 0, finalizada: false, proxima: 3 });
  assert.doesNotMatch(sem, /ladrilho--pendente/); // sem a propriedade, nenhuma marcada (padrão seguro)
});

test('grade: sem nada feito convida a começar; finalizada é só leitura', () => {
  const vazia = tela('GradePlantas', { aid: AID, titulo: 't-01', semana: '2026-W39', progresso: progresso(ficha, {}), pendentes: 0, finalizada: false, proxima: 1 });
  assert.match(vazia, /Começar pela planta 1/);
  assert.doesNotMatch(vazia, /aguardando envio/);
  const fim = tela('GradePlantas', { aid: AID, titulo: 't-01', semana: '2026-W39', progresso: progresso(ficha, {}), pendentes: 0, finalizada: true, proxima: 1 });
  assert.match(fim, /Só leitura/);
  assert.match(fim, /Ver resultado/);
  assert.doesNotMatch(fim, /Começar pela planta|Continuar na planta/);
});

// ---------------------------------------------------------------- talhões

test('lista de talhões: cada situação leva ao lugar certo', () => {
  const talhoes = [
    { id: 't-01', nome: 'Talhão 01', areaHa: 5, atributos: { tipoPomar: 'adulto' } },
    { id: 't-02', nome: 'Talhão 02 (pomar novo)', areaHa: 3.5, atributos: { tipoPomar: 'novo' } },
    { id: 't-03', nome: 'Talhão 03', atributos: {} },
  ];
  const porTalhao = { 't-01': { id: 'av-1', status: 'rascunho', talhaoId: 't-01' }, 't-02': { id: 'av-2', status: 'finalizada', talhaoId: 't-02' } };
  const h = tela('ListaTalhoes', { semana: '2026-W39', talhoes, porTalhao, rascunhos: [], pendentesPorId: { 'av-1': true } });
  assert.match(h, /Semana 2026-W39/);
  assert.match(h, /href="\/fitossanidade\/campo\/av-1"/); // em andamento: continuar
  assert.match(h, /href="\/fitossanidade\/campo\/av-2\/resumo"/); // finalizada: ver resultado
  assert.match(h, /href="\/fitossanidade\/campo\/novo\/t-03"/); // livre: começar
  assert.match(h, /Em andamento · aguardando envio/);
  assert.match(h, /Finalizada/);
  assert.match(h, /5 ha · pomar adulto/);
  assert.match(h, /3,5 ha · pomar novo/);
});

test('lista de talhões: rascunhos de outras semanas aparecem à parte; sem talhão explica', () => {
  const h = tela('ListaTalhoes', { semana: '2026-W39', talhoes: [], porTalhao: {}, rascunhos: [{ id: 'av-9', talhaoId: 't-01', semanaISO: '2026-W37', status: 'rascunho' }, { id: 'av-8', talhaoId: 't-02', semanaISO: '2026-W39', status: 'rascunho' }] });
  assert.match(h, /Em andamento de outras semanas/);
  assert.match(h, /Semana 2026-W37 · continuar/);
  assert.doesNotMatch(h, /Semana 2026-W39 · continuar/); // a desta semana já está na lista de talhões
  assert.match(h, /Nenhum talhão ativo nesta unidade/);
});

// ---------------------------------------------------------------- começar

const propsNova = (extra = {}) => ({
  talhao: { id: 't-01', nome: 'Talhão 01' }, opcoesFase: opcoesDeFase(ficha), selecionadas: ['chumbinho'], aoAlternarFase() {}, aviso: { tipo: 'nenhuma' },
  aoComecar() {}, iniciando: false, erro: null, semana: '2026-W39', data: '2026-09-22', ...extra,
});

test('começar: fases da ficha em 3 grupos, com as escolhidas marcadas', () => {
  const h = tela('FormNovaAvaliacao', propsNova());
  assert.match(h, /Talhão 01/);
  for (const g of ['Crescimento', 'Floração', 'Frutificação']) assert.match(h, new RegExp(`<legend>${g}</legend>`));
  assert.equal(conta(h, 'type="checkbox"'), 11);
  assert.equal(conta(h, 'chip--ligado'), 1);
  assert.match(h, /Começar a avaliação/);
});

test('começar: já em andamento oferece continuar; já finalizada bloqueia', () => {
  const emAndamento = tela('FormNovaAvaliacao', propsNova({ aviso: { tipo: 'continuar', id: 'av-1', texto: 'Você já tem uma avaliação deste talhão em andamento nesta semana. Continue de onde parou.' } }));
  assert.match(emAndamento, /em andamento nesta semana/);
  assert.match(emAndamento, /href="\/fitossanidade\/campo\/av-1"[^>]*>Continuar/);
  assert.doesNotMatch(emAndamento, /Começar a avaliação/);

  const finalizada = tela('FormNovaAvaliacao', propsNova({ aviso: { tipo: 'finalizada', texto: 'Este talhão já foi avaliado e finalizado por você nesta semana. Uma avaliação finalizada não pode ser refeita.' } }));
  assert.match(finalizada, /não pode ser refeita/);
  assert.doesNotMatch(finalizada, /Começar a avaliação/);
  assert.doesNotMatch(finalizada, /type="checkbox"/);
});

test('começar: mostra erro e o estado "Abrindo…"', () => {
  const h = tela('FormNovaAvaliacao', propsNova({ erro: 'O servidor recusou a avaliação (permission-denied).', iniciando: true }));
  assert.match(h, /role="alert"/);
  assert.match(h, /Abrindo…/);
  assert.match(h, /disabled/);
});

// ---------------------------------------------------------------- resumo

function resumoDe({ tripes = 0, ferrugem = 0, joaninha = 0, completas = 30 } = {}) {
  const lista = Array.from({ length: 30 }, (_, i) => {
    let obs = tudoAusente();
    if (i < tripes) obs = definirValor(obs, item('tripes_flor'), 'A', 2);
    if (i < ferrugem) obs = definirValor(obs, item('ferrugem_bgude'), 'A', 1);
    if (i < joaninha) obs = definirValor(obs, item('joaninha'), 'A', 1);
    return { n: i + 1, obs: i < completas ? obsParaGravar(ficha, obs) : {} };
  });
  const porN = Object.fromEntries(lista.map((p) => [p.n, p.obs]));
  const modelo = montarResumo(avaliar({ ficha, plantas: lista, atributos: { tipoPomar: 'adulto' } }), ficha);
  return { modelo, progresso: progresso(ficha, porN), incompletas: plantasIncompletas(ficha, porN) };
}
const propsResumo = (extra = {}) => ({
  titulo: 't-01', semana: '2026-W39', aid: AID, finalizada: false, formulario: { adultosArmadilha: '', outrasPragas: '' },
  aoMudarFormulario() {}, aoFinalizar() {}, aoConfirmar() {}, finalizando: false, erro: null, confirmando: false, ...resumoDe(), ...extra,
});

test('resumo com nível de ação: TD, NI, limite, aviso de seletivo e o que revisar', () => {
  const h = tela('ResumoAvaliacao', propsResumo(resumoDe({ tripes: 7, ferrugem: 4, joaninha: 5 })));
  assert.match(h, /Prévia/);
  assert.match(h, /<b>TD3<\/b> Pulverizar com inseticida/);
  assert.match(h, /Atingiram o nível de ação/);
  assert.match(h, /Tripes[\s\S]*?23,0?3?%|23,3%/);
  assert.match(h, /> 20,0%/);
  assert.match(h, /7\/30/);
  assert.match(h, /Sem limite definido \(revisar\)/);
  assert.match(h, /Ácaro da ferrugem \(bola de gude\)/);
  // a seção de revisão só tem o que foi detectado; o resto sem limite fica numa seção discreta
  const revisar = h.split('Sem limite definido (revisar)')[1].split('</table>')[0];
  assert.equal(conta(revisar, '<tr class='), 1);
  assert.match(h, /Sem limite definido \(nada detectado\)/);
  assert.match(h, /produto seletivo/);
  assert.match(h, /Finalizar avaliação/);
  assert.match(h, /Adultos de bicho-furão na armadilha/);
});

test('resumo só com REVISAR deixa claro que NÃO é "não pulverizar"', () => {
  const h = tela('ResumoAvaliacao', propsResumo(resumoDe({ ferrugem: 4 })));
  assert.match(h, /REVISAR: há praga detectada sem limite definido/);
  assert.match(h, /NÃO significa "não pulverizar"/);
  assert.match(h, /<b>REVISAR<\/b>/);
  assert.match(h, /faixa faixa--aviso/);
});

test('resumo sem nada atingido: TD1 em faixa de tranquilidade', () => {
  const h = tela('ResumoAvaliacao', propsResumo(resumoDe()));
  assert.match(h, /Nenhum item atingiu o nível de ação/);
  assert.match(h, /<b>TD1<\/b> Não pulverizar/);
});

test('resumo com plantas incompletas: não deixa finalizar e mostra quais faltam', () => {
  const h = tela('ResumoAvaliacao', propsResumo(resumoDe({ completas: 27 })));
  assert.match(h, /Ainda não dá para finalizar: 3 planta\(s\)/);
  assert.equal(conta(h, 'ladrilho--vazia'), 3);
  assert.match(h, /planta\/28"/);
  assert.doesNotMatch(h, /Finalizar avaliação/);
  assert.doesNotMatch(h, /<form/);
});

test('resumo: pede confirmação antes de finalizar, e finalizada vira só leitura', () => {
  const confirmando = tela('ResumoAvaliacao', propsResumo({ confirmando: true }));
  assert.match(confirmando, /não pode mais ser editada\. Confirma\?/);
  assert.match(confirmando, /Sim, finalizar agora/);

  const feita = tela('ResumoAvaliacao', propsResumo({ finalizada: true }));
  assert.match(feita, /O agrônomo vai analisar/);
  assert.doesNotMatch(feita, /<form/);
  assert.doesNotMatch(feita, /Prévia/);
});

// ---------------------------------------------------------------- indicador de envio

test('texto do indicador: singular, plural e nada quando não há pendência', () => {
  assert.equal(textoPendentes(0), null);
  assert.equal(textoPendentes(1), '1 item aguardando envio');
  assert.equal(textoPendentes(30), '30 itens aguardando envio');
});

test('cabeçalho mostra "N itens aguardando envio", diferente online e offline', () => {
  const sessao = R.sessaoDeMentira({ setores: {}, unidades: {}, vinculos: [] });
  const nav = (onLine, f) => {
    const antes = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
    Object.defineProperty(globalThis, 'navigator', { value: { onLine }, configurable: true, writable: true });
    try { return f(); } finally { if (antes) Object.defineProperty(globalThis, 'navigator', antes); else delete globalThis.navigator; }
  };
  const online = limpar(nav(true, () => R.renderizarLayoutComPendentes(sessao, 30)));
  assert.match(online, /Enviando… 30 itens aguardando envio/);
  const offline = limpar(nav(false, () => R.renderizarLayoutComPendentes(sessao, 30)));
  assert.match(offline, /30 itens aguardando envio \(grava neste aparelho\)/);
  assert.match(offline, /Offline/);
  assert.doesNotMatch(limpar(R.renderizarLayoutComPendentes(sessao, 0)), /aguardando envio/);
});
