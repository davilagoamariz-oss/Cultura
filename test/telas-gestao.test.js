// Renderiza as telas de acompanhamento e de vínculos (com a ficha real) e confere o que cada papel vê e toca.
import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { agruparPorOrgao, definirGrupo, definirValor, obsParaGravar } from '../src/campo/ficha-campo.js';
import { montarResumo } from '../src/campo/resumo.js';
import { avaliar } from '../src/dominio/motor/index.js';
import { tdsDaFicha, situacaoDaDecisao, prazoDeAplicacao } from '../src/gestao/decisao.js';

let R;
before(async () => {
  const raiz = fileURLToPath(new URL('../', import.meta.url));
  const saida = `${raiz}node_modules/.cache/ronda-telas`;
  mkdirSync(saida, { recursive: true });
  const bundle = await rolldown({ input: `${raiz}test/telas/entrada.jsx`, platform: 'node', logLevel: 'silent', transform: { define: { 'import.meta.env': '({})' } } });
  const arquivo = `${saida}/telas-gestao.mjs`;
  await bundle.write({ file: arquivo, format: 'esm' });
  R = await import(`${pathToFileURL(arquivo).href}?t=${Date.now()}`);
});

const ficha = JSON.parse(readFileSync(new URL('../catalogo/fichas/limao-tahiti.v1.json', import.meta.url), 'utf8'));
const item = (id) => ficha.itens.find((i) => i.id === id);
const limpar = (h) => h.replaceAll('<!-- -->', '').replaceAll('&quot;', '"').replaceAll('&gt;', '>').replaceAll('&lt;', '<').replaceAll('&amp;', '&');
const tela = (nome, props, rota) => limpar(R.renderizarGestao(nome, props, rota));
const conta = (t, trecho) => t.split(trecho).length - 1;
const tudoAusente = () => agruparPorOrgao(ficha).reduce((o, g) => definirGrupo(o, g, 0), {});

function modeloDe({ tripes = 0, ferrugem = 0 } = {}) {
  const plantas = Array.from({ length: 30 }, (_, i) => {
    let obs = tudoAusente();
    if (i < tripes) obs = definirValor(obs, item('tripes_flor'), 'A', 2);
    if (i < ferrugem) obs = definirValor(obs, item('ferrugem_bgude'), 'A', 1);
    return { n: i + 1, obs: obsParaGravar(ficha, obs) };
  });
  return montarResumo(avaliar({ ficha, plantas, atributos: { tipoPomar: 'adulto' } }), ficha);
}
const tdsDisponiveis = tdsDaFicha(ficha).map((c) => ({ codigo: c, texto: ficha.tds[c] }));
const tdsTexto = ficha.tds;
const nomes = { agro1: 'Alberto Agrônomo', ger1: 'Gil Gerente', pau1: 'Paulo Pragueiro' };

// ---------------------------------------------------------------- lista da semana

const linha = (extra) => ({ id: 'av-1', talhaoNome: 'Talhão 01', pragueiro: 'Paulo', dataTexto: '22/09/2026', status: 'finalizada', decisaoStatus: null, pendente: false, ...extra });
const propsLista = (extra = {}) => ({
  semana: '2026-W39', rotuloSemana: '21/09 a 27/09/2026', semanaAnterior: '2026-W38', semanaSeguinte: '2026-W40', ehSemanaAtual: true, linhas: [], ...extra,
});

test('lista da semana: agrupa por o que falta fazer, com a contagem de cada grupo', () => {
  const h = tela('ListaAcompanhamento', propsLista({
    linhas: [
      linha({ id: 'a1', talhaoNome: 'Talhão 01' }), // aguardando decisão
      linha({ id: 'a2', talhaoNome: 'Talhão 02', decisaoStatus: 'aprovada' }),
      linha({ id: 'a3', talhaoNome: 'Talhão 03', decisaoStatus: 'executada' }),
      linha({ id: 'a4', talhaoNome: 'Talhão 04', decisaoStatus: 'rejeitada' }),
      linha({ id: 'a5', talhaoNome: 'Talhão 05', status: 'rascunho' }),
    ],
  }));
  assert.match(h, /<b>5<\/b> avaliações:/);
  assert.match(h, /<b>1<\/b> aguardando decisão/);
  assert.match(h, /<b>1<\/b> aguardando execução/);
  assert.match(h, /<b>1<\/b> em andamento/);
  assert.match(h, /<b>2<\/b> concluída/);
  assert.match(h, /Aguardando decisão do agrônomo \(1\)/);
  assert.match(h, /Aprovadas, aguardando execução \(1\)/);
  assert.match(h, /Concluídas \(2\)/);
  assert.match(h, /Em andamento \(o pragueiro ainda está avaliando\) \(1\)/);
  assert.match(h, /href="\/fitossanidade\/acompanhamento\/a1"/);
  // a ordem dos grupos é a da urgência: decidir, executar, concluídas, em andamento
  assert.ok(h.indexOf('Aguardando decisão') < h.indexOf('Aprovadas, aguardando') && h.indexOf('Aprovadas, aguardando') < h.indexOf('Concluídas') && h.indexOf('Concluídas') < h.indexOf('Em andamento'));
  assert.match(h, /Paulo · inspeção em 22\/09\/2026/);
  assert.match(h, /Executada/);
  assert.match(h, /Rejeitada/);
});

test('lista da semana: navegação entre semanas e a semana atual', () => {
  const h = tela('ListaAcompanhamento', propsLista());
  assert.match(h, /href="[^"]*\?semana=2026-W38"[^>]*>‹ Anterior/);
  assert.match(h, /href="[^"]*\?semana=2026-W40"[^>]*>Próxima ›/);
  assert.match(h, /<b>2026-W39<\/b>/);
  assert.match(h, /21\/09 a 27\/09\/2026 · esta semana/);
  assert.match(h, /Nenhuma avaliação neste setor nesta semana/);
  assert.doesNotMatch(h, /aria-label="Resumo da semana"/); // sem linha nenhuma, o resumo some (o "vazio" já diz isso)
  assert.doesNotMatch(tela('ListaAcompanhamento', propsLista({ ehSemanaAtual: false })), /· esta semana/);
});

test('resumo da semana: "1 avaliação" no singular, e só aparece a situação que existe', () => {
  const h = tela('ListaAcompanhamento', propsLista({ linhas: [linha({ decisaoStatus: 'aprovada' })] }));
  assert.match(h, /<b>1<\/b> avaliação:/);
  assert.match(h, /<b>1<\/b> aguardando execução/);
  assert.doesNotMatch(h, /aguardando decisão|em andamento|concluída/);
});

test('exportar CSV: o botão só aparece com pelo menos uma avaliação', () => {
  const semLinhas = tela('ListaAcompanhamento', propsLista());
  assert.doesNotMatch(semLinhas, /Exportar esta semana/);
  const comLinhas = tela('ListaAcompanhamento', propsLista({ linhas: [linha()] }));
  assert.match(comLinhas, /Exportar esta semana \(CSV\)/);
});

test('lista da semana: avisa o que ainda aguarda envio', () => {
  const h = tela('ListaAcompanhamento', propsLista({ linhas: [linha({ pendente: true })] }));
  assert.match(h, /aguardando envio/);
});

// ---------------------------------------------------------------- detalhe e decisão

function propsDetalhe({ cenario = { tripes: 7 }, avaliacaoStatus = 'finalizada', decisao = null, podeDecidir = false, ehGerente = false, formulario, extra = {} } = {}) {
  const avaliacao = { status: avaliacaoStatus, notas: '', outrasPragas: '' };
  const situacao = situacaoDaDecisao({ avaliacao, decisao, podeDecidir, ehGerente });
  const modelo = modeloDe(cenario);
  return {
    titulo: 'Talhão 01', semana: '2026-W39', dataTexto: '22/09/2026', pragueiro: 'Paulo Pragueiro', fichaVersao: 1, avaliacao, modelo,
    prazo: prazoDeAplicacao('2026-09-22', new Date(2026, 8, 23)), armadilha: { atual: 4, anterior: 7, semanaAnterior: '2026-W38' },
    situacao, decisao, tdsDisponiveis, tdsTexto, nomes,
    formulario: formulario ?? { status: 'aprovada', tds: ['TD3'], observacao: '' },
    aoMudarFormulario() {}, aoDecidir() {}, decidindo: false, confirmandoDecisao: false, aoConfirmarDecisao() {},
    execObservacao: '', aoMudarExecObservacao() {}, aoExecutar() {}, executando: false, confirmandoExecucao: false, aoConfirmarExecucao() {}, erro: null,
    ...extra,
  };
}
const decisaoDe = (extra) => ({ status: 'aprovada', tds: ['TD3'], observacao: 'aplicar amanhã cedo', decididoPor: 'agro1', decididoQuando: '23/09/2026 08:10', pendente: false, ...extra });

test('detalhe: mostra o resultado calculado (NI, TD), a armadilha das duas semanas e o pragueiro', () => {
  const h = tela('DetalheAvaliacao', propsDetalhe());
  assert.match(h, /Semana 2026-W39 · inspeção em 22\/09\/2026 · pragueiro: Paulo Pragueiro · ficha v1/);
  assert.match(h, /<b>TD3<\/b> Pulverizar com inseticida/);
  assert.match(h, /Tripes/);
  assert.match(h, /23,3%/);
  assert.match(h, /esta semana 4 · semana anterior \(2026-W38\) 7/);
  assert.match(h, /ainda não foi confirmada/);
  assert.match(h, /Inspeção há 1 dia/);
});

test('detalhe: armadilha sem informação diz "não informado"', () => {
  const h = tela('DetalheAvaliacao', propsDetalhe({ extra: { armadilha: { atual: null, anterior: null, semanaAnterior: '2026-W38' } } }));
  assert.match(h, /esta semana não informado · semana anterior \(2026-W38\) não informado/);
});

test('agrônomo diante de uma avaliação finalizada: formulário de decisão com a sugestão marcada', () => {
  const h = tela('DetalheAvaliacao', propsDetalhe({ podeDecidir: true }));
  assert.match(h, /<h2>Sua decisão<\/h2>/);
  assert.match(h, /Aprovar: executar as tomadas de decisão abaixo/);
  assert.match(h, /Rejeitar a sugestão/);
  assert.equal(conta(h, 'type="checkbox"'), 6); // TD1 a TD6
  assert.equal(conta(h, 'chip chip--ligado'), 2); // "Aprovar" e o TD3 sugerido
  assert.match(h, /TD3 · Pulverizar com inseticida/);
  assert.match(h, /Registrar decisão/);
  assert.doesNotMatch(h, /Aguardando a decisão do agrônomo/);
});

test('quando o cálculo pede REVISAR, o agrônomo é avisado e escolhe as tomadas de decisão', () => {
  const h = tela('DetalheAvaliacao', propsDetalhe({ cenario: { ferrugem: 4 }, podeDecidir: true, formulario: { status: 'aprovada', tds: [], observacao: '' } }));
  assert.match(h, /O cálculo pediu revisão/);
  assert.match(h, /Escolha você as tomadas de decisão/);
  assert.equal(conta(h, 'chip chip--ligado'), 1); // só "Aprovar": nenhuma TD marcada por ele
});

test('decisão exige confirmação e explica que é definitiva; rejeitar pede a observação', () => {
  const confirmando = tela('DetalheAvaliacao', propsDetalhe({ podeDecidir: true, extra: { confirmandoDecisao: true } }));
  assert.match(confirmando, /não pode ser alterada depois\. Confirma\?/);
  assert.match(confirmando, /Sim, registrar a decisão/);
  const rejeitando = tela('DetalheAvaliacao', propsDetalhe({ podeDecidir: true, formulario: { status: 'rejeitada', tds: ['TD3'], observacao: '' } }));
  assert.match(rejeitando, /\(obrigatória para rejeitar\)/);
  assert.match(tela('DetalheAvaliacao', propsDetalhe({ podeDecidir: true })), /Observação \(opcional\)/);
});

test('quem não é agrônomo vê que aguarda a decisão, sem formulário', () => {
  const h = tela('DetalheAvaliacao', propsDetalhe({ podeDecidir: false }));
  assert.match(h, /Aguardando a decisão do agrônomo/);
  assert.doesNotMatch(h, /Sua decisão/);
  assert.doesNotMatch(h, /Registrar decisão/);
});

test('decisão aprovada: aparece com quem, quando e as TDs; o gerente vê o formulário de execução', () => {
  const comoGerente = tela('DetalheAvaliacao', propsDetalhe({ decisao: decisaoDe(), ehGerente: true }));
  assert.match(comoGerente, /<b>Aprovada<\/b>/);
  assert.match(comoGerente, /TD3 \(Pulverizar com inseticida\)/);
  assert.match(comoGerente, /Observação do agrônomo: aplicar amanhã cedo/);
  assert.match(comoGerente, /Decidida por Alberto Agrônomo em 23\/09\/2026 08:10/);
  assert.match(comoGerente, /<h2>Execução<\/h2>/);
  assert.match(comoGerente, /Marcar como executada/);
  assert.doesNotMatch(comoGerente, /Sua decisão/);

  const comoAgronomo = tela('DetalheAvaliacao', propsDetalhe({ decisao: decisaoDe(), ehGerente: false }));
  assert.match(comoAgronomo, /Aguardando a execução pelo gerente do setor/);
  assert.doesNotMatch(comoAgronomo, /Marcar como executada/);
});

test('execução: confirmação antes de marcar; executada mostra quem fez e o que foi feito', () => {
  const confirmando = tela('DetalheAvaliacao', propsDetalhe({ decisao: decisaoDe(), ehGerente: true, extra: { confirmandoExecucao: true } }));
  assert.match(confirmando, /não dá para desfazer\. Confirma\?/);
  assert.match(confirmando, /Sim, marcar como executada/);

  const feita = tela('DetalheAvaliacao', propsDetalhe({ decisao: decisaoDe({ status: 'executada', executadoPor: 'ger1', executadoQuando: '23/09/2026 09:30', observacaoExecucao: 'aplicado às 6h' }), ehGerente: true }));
  assert.match(feita, /<b>Executada<\/b>/);
  assert.match(feita, /Executada por Gil Gerente em 23\/09\/2026 09:30: aplicado às 6h/);
  assert.doesNotMatch(feita, /<h2>Execução<\/h2>/);
  assert.doesNotMatch(feita, /Inspeção há/); // já executada: o prazo deixou de importar
});

test('decisão rejeitada: registrada, sem execução; e a pendência de envio aparece', () => {
  const h = tela('DetalheAvaliacao', propsDetalhe({ decisao: decisaoDe({ status: 'rejeitada', observacao: 'aguardar a próxima semana', pendente: true }), ehGerente: true }));
  assert.match(h, /<b>Rejeitada \(aguardando envio\)<\/b>/);
  assert.match(h, /aguardar a próxima semana/);
  assert.doesNotMatch(h, /Marcar como executada/);
});

test('avaliação em andamento: só prévia, sem decisão e sem prazo', () => {
  const h = tela('DetalheAvaliacao', propsDetalhe({ avaliacaoStatus: 'rascunho', podeDecidir: true }));
  assert.match(h, /O pragueiro ainda não finalizou esta avaliação/);
  assert.doesNotMatch(h, /Sua decisão/);
  assert.doesNotMatch(h, /Inspeção há/);
});

test('prazo estourado vira aviso destacado; notas e outras pragas do pragueiro aparecem', () => {
  const p = propsDetalhe({ podeDecidir: true });
  const atrasado = tela('DetalheAvaliacao', { ...p, prazo: prazoDeAplicacao('2026-09-18', new Date(2026, 8, 25)), avaliacao: { status: 'finalizada', notas: 'talhão com reboleira', outrasPragas: 'broca no talhão vizinho' } });
  assert.match(atrasado, /faixa faixa--aviso[^>]*>Inspeção há 7 dias: passou do prazo recomendado de 3 dias/);
  assert.match(atrasado, /Observações do pragueiro:<\/b> talhão com reboleira/);
  assert.match(atrasado, /Outras pragas informadas:<\/b> broca no talhão vizinho/);
});

test('erro é mostrado com alerta', () => {
  assert.match(tela('DetalheAvaliacao', propsDetalhe({ extra: { erro: 'O servidor recusou a decisão (permission-denied).' } })), /role="alert"[^>]*>O servidor recusou a decisão/);
});

// ---------------------------------------------------------------- vínculos

const vinculo = (extra) => ({ id: 'p1_fit-1', pessoaUid: 'p1', nome: 'Paulo', papel: 'funcionario', funcoes: ['pragueiro'], ativo: true, versao: 1, pode: true, podeMudarPapel: false, motivo: null, ...extra });
const propsVinculos = (extra = {}) => ({
  titulo: 'Vínculos do setor', setorNome: 'Fitossanidade · Fazenda 1', linhas: [], podeAdicionar: false, motivoSemAdicionar: 'Para ligar uma pessoa nova a este setor, peça ao administrador.',
  candidatos: [], formNovo: { pessoaUid: '', papel: 'funcionario', funcoes: ['pragueiro'] }, aoMudarFormNovo() {}, aoLigar() {}, ligando: false, podeEscolherPapel: false,
  historicoAberto: null, aoAbrirHistorico() {}, aoAlterar() {}, ocupado: false, erro: null, ...extra,
});

test('vínculos do gerente: altera funcionário, não altera a si nem outro gerente, e diz por quê', () => {
  const h = tela('GestaoVinculos', propsVinculos({
    linhas: [
      vinculo(),
      vinculo({ id: 'g1_fit-1', pessoaUid: 'g1', nome: 'Gil Gerente', papel: 'gerente', funcoes: [], pode: false, motivo: 'Você não altera o próprio vínculo.' }),
      vinculo({ id: 'g2_fit-1', pessoaUid: 'g2', nome: 'Outro Gerente', papel: 'gerente', funcoes: [], pode: false, motivo: 'Só o administrador altera um gerente.' }),
    ],
  }));
  assert.match(h, /<b>Paulo<\/b>/);
  assert.match(h, /Desativar/);
  assert.equal(conta(h, 'Desativar'), 1); // só o funcionário
  assert.doesNotMatch(h, /Promover a gerente/); // o gerente não promove
  assert.match(h, /Você não altera o próprio vínculo\./);
  assert.match(h, /Só o administrador altera um gerente\./);
  assert.equal(conta(h, 'Ver histórico'), 3); // o histórico pode ser visto em todos
  assert.equal(conta(h, '<fieldset class="chips" disabled="">'), 2); // funções travadas onde não pode
});

test('vínculos do admin: também promove e rebaixa', () => {
  const h = tela('GestaoVinculos', propsVinculos({
    linhas: [vinculo({ podeMudarPapel: true }), vinculo({ id: 'g2_fit-1', pessoaUid: 'g2', nome: 'Outro Gerente', papel: 'gerente', funcoes: [], podeMudarPapel: true })],
  }));
  assert.match(h, /Promover a gerente/);
  assert.match(h, /Passar a funcionário/);
});

test('vínculo desativado é marcado e oferece reativar', () => {
  const h = tela('GestaoVinculos', propsVinculos({ linhas: [vinculo({ ativo: false, versao: 2 })] }));
  assert.match(h, /Desativado/);
  assert.match(h, /Reativar/);
  assert.doesNotMatch(h, />Desativar</);
  assert.match(h, /versão 2/);
  assert.match(h, /vinculo vinculo--inativo/);
});

test('funções aparecem como opções marcáveis, com os nomes do módulo', () => {
  const h = tela('GestaoVinculos', propsVinculos({ linhas: [vinculo({ funcoes: ['pragueiro', 'agronomo'] })] }));
  assert.match(h, /Pragueiro/);
  assert.match(h, /Agrônomo/);
  assert.equal(conta(h, 'chip chip--ligado'), 2);
});

test('histórico aberto mostra a linha do tempo, quem fez e o que mudou', () => {
  const h = tela('GestaoVinculos', propsVinculos({
    linhas: [vinculo()],
    historicoAberto: { id: 'p1_fit-1', linhas: [
      { versao: 2, quandoTexto: '23/09/2026 10:00', quemNome: 'Gil Gerente', mudancas: ['Desativado'] },
      { versao: 1, quandoTexto: '', quemNome: 'Ana Admin', mudancas: ['Vínculo criado como Funcionário (funções: Pragueiro)'] },
    ] },
  }));
  assert.match(h, /aria-label="Histórico de Paulo"/);
  assert.match(h, /Versão 2<\/b> · 23\/09\/2026 10:00 · Gil Gerente/);
  assert.match(h, /<li>Desativado<\/li>/);
  assert.match(h, /Versão 1<\/b> · aguardando envio · Ana Admin/);
  assert.match(h, /Esconder histórico/);
});

test('ligar pessoa nova: o admin escolhe pessoa, papel e funções; o gerente é orientado a pedir ao administrador', () => {
  const admin = tela('GestaoVinculos', propsVinculos({
    podeAdicionar: true, podeEscolherPapel: true, candidatos: [{ uid: 'c1', nome: 'Sem Vínculo' }, { uid: 'c2', nome: 'Mário Motorista' }],
    formNovo: { pessoaUid: 'c1', papel: 'funcionario', funcoes: ['pragueiro'] },
  }));
  assert.match(admin, /Ligar uma pessoa a este setor/);
  assert.match(admin, /<option value="c1"[^>]*>Sem Vínculo<\/option>/);
  assert.match(admin, /<option value="gerente">Gerente<\/option>/);
  assert.match(admin, /Ligar ao setor/);

  const gerente = tela('GestaoVinculos', propsVinculos({ podeAdicionar: false }));
  assert.match(gerente, /peça ao administrador/);
  assert.doesNotMatch(gerente, /<select/);

  const semCandidatos = tela('GestaoVinculos', propsVinculos({ podeAdicionar: true, podeEscolherPapel: true, candidatos: [] }));
  assert.match(semCandidatos, /Todos os membros ativos da empresa já estão ligados/);

  // o gerente que não é admin não escolhe o papel (a promoção é só do administrador)
  const semPapel = tela('GestaoVinculos', propsVinculos({ podeAdicionar: true, podeEscolherPapel: false, candidatos: [{ uid: 'c1', nome: 'X' }] }));
  assert.doesNotMatch(semPapel, /<option value="gerente">/);
});

test('vínculos: lista vazia e erro', () => {
  assert.match(tela('GestaoVinculos', propsVinculos()), /Ninguém está ligado a este setor/);
  assert.match(tela('GestaoVinculos', propsVinculos({ erro: 'O servidor recusou (permission-denied).' })), /role="alert"/);
});

// ---------------------------------------------------------------- selo de pendências na aba

test('selo de pendências: escondido em zero, mostra o total e um aria-label legível', () => {
  assert.equal(tela('SeloPendencias', { total: 0 }), '');
  const h = tela('SeloPendencias', { total: 3 });
  assert.match(h, /class="selo selo--alerta"/);
  assert.match(h, />3</);
  assert.match(h, /aria-label="3 aguardando você"/);
});
