// Converte regras/regras-iniciais.json (formato do kit inicial) na ficha versionada limao-tahiti v1,
// no catálogo de alvos e na cultura. Função pura: o script e os testes usam a mesma.
import { metricaExiste } from '../motor/metricas.js';

export const FICHA_ID = 'limao-tahiti';
export const CULTURA_ID = 'limao-tahiti';

const ORGAOS = ['fruto', 'folha', 'broto', 'flor', 'tronco', 'planta'];

const FASES = [
  { grupo: 'Crescimento', itens: [{ id: 'crescimento_vegetativo', nome: 'Crescimento vegetativo' }, { id: 'amadurecimento_ramos', nome: 'Amadurecimento de ramos' }] },
  { grupo: 'Floração', itens: [{ id: 'cabeca_de_fosforo', nome: 'Cabeça de fósforo' }, { id: 'cotonete', nome: 'Cotonete' }] },
  {
    grupo: 'Frutificação',
    itens: [
      { id: 'chumbinho', nome: 'Chumbinho' },
      { id: 'azeitona', nome: 'Azeitona' },
      { id: 'bola_de_gude', nome: 'Bola de gude' },
      { id: 'pingue_pongue', nome: 'Pingue-pongue' },
      { id: 'bilhar', nome: 'Bilhar' },
      { id: 'fruto_para_colheita', nome: 'Fruto para colheita' },
      { id: 'pos_colheita', nome: 'Pós-colheita' },
    ],
  },
];

// Gravidade dos TDs, usada para decidir qual nível "vence" dentro de uma regra:
// pulverizar (2, 3, 4) > podar (TD5) > inspecionar todas as plantas (TD6) > não pulverizar (TD1).
const GRAVIDADE_TD = { TD1: 0, TD6: 1, TD5: 2, TD2: 3, TD3: 3, TD4: 3 };

// Cada item da ficha observa um alvo (praga, doença ou inimigo natural) do catálogo.
const ALVO_DO_ITEM = {
  ferrugem_bgude: 'acaro-da-ferrugem',
  ferrugem_pingue_pongue: 'acaro-da-ferrugem',
  acaro_branco_chumbinho: 'acaro-branco',
  acaro_branco_azeitona: 'acaro-branco',
  acaro_branco_bgude: 'acaro-branco',
  leprose_fruto: 'acaro-da-leprose',
  acaros_predadores: 'acaros-predadores',
  larva_minadora_broto: 'larva-minadora',
  ageniaspis_pupa: 'ageniaspis',
  podridao_floral_flor: 'podridao-floral',
  ortezia_folha: 'ortezia',
  escama_farinha_tronco: 'escama-farinha',
  escama_farinha_fruto: 'escama-farinha',
  parlatoria_tronco: 'parlatoria',
  rosada_folha: 'cochonilha-rosada',
  branca_folha: 'cochonilha-branca',
  branca_fruto: 'cochonilha-branca',
  branca_tronco: 'cochonilha-branca',
  parda_folha: 'cochonilha-parda',
  parda_fruto: 'cochonilha-parda',
  parda_tronco: 'cochonilha-parda',
  tripes_flor: 'tripes',
  gomose: 'gomose',
  pulgao: 'pulgao',
  mosca_negra: 'mosca-negra',
  bicho_furao: 'bicho-furao',
  declinio: 'declinio',
  bicho_lixeiro: 'bicho-lixeiro',
  joaninha: 'joaninha',
  flores_abertas: 'floracao',
};

export const ALVOS = [
  { id: 'acaro-da-ferrugem', nome: 'Ácaro da ferrugem', tipo: 'praga' },
  { id: 'acaro-branco', nome: 'Ácaro branco', tipo: 'praga' },
  { id: 'acaro-da-leprose', nome: 'Ácaro da leprose', tipo: 'praga' },
  { id: 'acaros-predadores', nome: 'Ácaros predadores', tipo: 'inimigo_natural' },
  { id: 'larva-minadora', nome: 'Larva minadora', tipo: 'praga' },
  { id: 'ageniaspis', nome: 'Ageniaspis', tipo: 'inimigo_natural' },
  { id: 'podridao-floral', nome: 'Podridão floral (estrelinha)', tipo: 'doenca' },
  { id: 'ortezia', nome: 'Cochonilha ortézia', tipo: 'praga' },
  { id: 'escama-farinha', nome: 'Cochonilha escama-farinha', tipo: 'praga' },
  { id: 'parlatoria', nome: 'Cochonilha parlatória', tipo: 'praga' },
  { id: 'cochonilha-rosada', nome: 'Cochonilha rosada', tipo: 'praga' },
  { id: 'cochonilha-branca', nome: 'Cochonilha branca', tipo: 'praga' },
  { id: 'cochonilha-parda', nome: 'Cochonilha parda', tipo: 'praga' },
  { id: 'tripes', nome: 'Tripes', tipo: 'praga' },
  { id: 'gomose', nome: 'Gomose', tipo: 'doenca' },
  { id: 'pulgao', nome: 'Pulgão', tipo: 'praga' },
  { id: 'mosca-negra', nome: 'Mosca-negra', tipo: 'praga' },
  { id: 'bicho-furao', nome: 'Bicho-furão', tipo: 'praga' },
  { id: 'declinio', nome: 'Declínio', tipo: 'doenca' },
  { id: 'bicho-lixeiro', nome: 'Bicho-lixeiro', tipo: 'inimigo_natural' },
  { id: 'joaninha', nome: 'Joaninha', tipo: 'inimigo_natural' },
  { id: 'floracao', nome: 'Flores abertas', tipo: 'indicador' },
];

// Critério de presença: quando o inspetor deve anotar "presente" (Manual Embrapa Doc. 183).
const CRITERIO_FERRUGEM = { texto: '30 ou mais ácaros por visada (lupa 10x, base de 1 cm²), em 3 frutos por planta.', fonte: 'Manual Embrapa Doc. 183, p.16' };
const CRITERIO_BRANCO = { texto: '5 ou mais ácaros por visada (lupa 10x, base de 1 cm²), em 3 frutos de cada tamanho por planta.', fonte: 'Manual Embrapa Doc. 183, p.17' };
const CRITERIO_LEPROSE = { texto: '5 ou mais ácaros por visada (lupa 10x, base de 1 cm²), em 3 frutos por planta.', fonte: 'Manual Embrapa Doc. 183, p.18' };
const CRITERIOS = {
  ferrugem_bgude: CRITERIO_FERRUGEM,
  ferrugem_pingue_pongue: CRITERIO_FERRUGEM,
  acaro_branco_chumbinho: CRITERIO_BRANCO,
  acaro_branco_azeitona: CRITERIO_BRANCO,
  acaro_branco_bgude: CRITERIO_BRANCO,
  leprose_fruto: CRITERIO_LEPROSE,
};

// Propostas para os limites pendentes. Ficam DESATIVADAS (nível com limite null): o app continua
// dizendo REVISAR até alguém confirmar e ativar. Não são decisão do sistema.
const foco = (pagina) => [
  {
    id: 'foco', metrica: 'plantas_positivas', operador: '>=', limite: 1, td: 'TD6',
    texto: 'Ao achar a praga em uma planta, inspecionar todas as plantas do talhão para localizar o foco.',
    fonte: `Manual Embrapa Doc. 183, p.${pagina}`,
  },
  {
    id: 'talhao-todo', metrica: 'percent_plantas', operador: '>=', limite: 1, td: 'TD3',
    texto: 'Com todas as plantas amostradas infestadas, controle em todo o pomar (ou só nos focos, se o ataque for em plantas isoladas ou reboleiras).',
    fonte: `Manual Embrapa Doc. 183, p.${pagina}`,
  },
];
const PROPOSTAS = {
  ortezia_folha: foco(22),
  escama_farinha_tronco: foco(23),
  escama_farinha_fruto: foco(23),
  parlatoria_tronco: foco(24),
  gomose: [{
    id: 'planta-afetada', metrica: 'plantas_positivas', operador: '>=', limite: 1, td: 'TD6',
    texto: 'Inspecionar todas as plantas do talhão e tratar a planta afetada ou a reboleira.',
    fonte: 'Manual Embrapa Doc. 183, p.26',
  }],
  declinio: [{
    id: 'levantamento-total', metrica: 'plantas_positivas', operador: '>=', limite: 1, td: 'TD6',
    texto: 'Levantamento total das plantas do talhão.',
    fonte: 'Manual Embrapa Doc. 183, p.27',
  }],
  bicho_furao: [{
    id: 'armadilha', metrica: 'contagem_armadilha', operador: '>=', limite: 10, td: 'TD3',
    texto: 'Controle com 10 adultos na armadilha, ou 6 adultos em duas semanas seguidas. Precisa de uma métrica nova (contagem na armadilha, com a semana anterior).',
    fonte: 'Cliente (2026-09-20), a confirmar',
  }],
};

const PROPOSTAS_DA_FICHA = [
  {
    id: 'intensidade-1-2-3',
    texto: 'Cada quadrante recebe 0 (ausente) ou 1, 2, 3 = até 5, de 6 a 15, mais de 15 pragas. Com intensidade 3 o controle pode antecipar para 5% das plantas (em vez de 10%).',
    fonte: 'Cliente (2026-09-20), a confirmar',
    status: 'proposta',
  },
];

function nivel(base) {
  const { id, metrica, operador, limite, td, quando, proposta } = base;
  return {
    id,
    metrica,
    operador,
    limite,
    td,
    gravidade: GRAVIDADE_TD[td],
    ...(quando ? { quando } : {}),
    ...(proposta ? { proposta } : {}),
  };
}

function converterRegra(antiga) {
  const item = {
    id: antiga.id,
    alvoId: ALVO_DO_ITEM[antiga.id],
    nome: antiga.nome,
    orgao: antiga.orgao,
    tipo: antiga.ladoUnico ? 'lado_unico' : 'presenca_quadrante',
    ...(CRITERIOS[antiga.id] ? { criterio: CRITERIOS[antiga.id] } : {}),
  };

  const regra = { itemId: antiga.id, alvoId: item.alvoId };
  if (antiga.condicao === 'citros_vizinhos') regra.aplicaSe = { atributos: { citrosVizinhos: true } };
  if (antiga.pendente) regra.pendente = true;
  if (antiga.opcoesLimite) regra.opcoesLimite = antiga.opcoesLimite;
  if (antiga.nota) regra.nota = antiga.nota;

  if (antiga.informativo) {
    regra.informativo = true;
    regra.niveis = [];
  } else if (antiga.limitePorTipoPomar) {
    regra.niveis = Object.entries(antiga.limitePorTipoPomar).map(([tipo, limite]) =>
      nivel({
        id: `pomar-${tipo}`, metrica: 'percent_plantas', operador: antiga.operador ?? '>=', limite, td: antiga.td,
        quando: { atributos: { tipoPomar: tipo } },
      }));
  } else if (antiga.pendente && PROPOSTAS[antiga.id]) {
    regra.niveis = PROPOSTAS[antiga.id].map((p) =>
      nivel({
        id: p.id,
        // nível inerte (limite null): usa a métrica da proposta só se ela já existir no registro
        metrica: metricaExiste(p.metrica) ? p.metrica : 'percent_plantas',
        operador: p.operador,
        limite: null,
        td: p.td,
        proposta: { metrica: p.metrica, operador: p.operador, limite: p.limite, texto: p.texto, fonte: p.fonte },
      }));
  } else {
    regra.niveis = [nivel({ id: 'padrao', metrica: 'percent_plantas', operador: antiga.operador ?? '>=', limite: antiga.limite ?? null, td: antiga.td })];
  }
  return { item, regra };
}

/** @returns { ficha, alvos, cultura } */
export function converterRegrasIniciais(regrasIniciais) {
  const convertidas = regrasIniciais.regras.map(converterRegra);
  for (const antiga of regrasIniciais.regras) {
    if (!ALVO_DO_ITEM[antiga.id]) throw new Error(`item sem alvo no catálogo: ${antiga.id}`);
  }

  const ficha = {
    fichaId: FICHA_ID,
    versao: 1,
    culturaId: CULTURA_ID,
    origem: regrasIniciais.origem,
    amostragem: {
      tipo: 'plantas_quadrantes',
      plantas: 30,
      lados: ['A', 'B'],
      intensidade: { escala: [0, 1, 2, 3], legenda: { 1: 'até 5 pragas', 2: 'de 6 a 15 pragas', 3: 'mais de 15 pragas' } },
    },
    orgaos: ORGAOS,
    fases: FASES,
    tds: regrasIniciais.tds,
    tdsQuePulverizam: ['TD2', 'TD3', 'TD4'],
    itens: convertidas.map((c) => c.item),
    regras: convertidas.map((c) => c.regra),
    propostas: PROPOSTAS_DA_FICHA,
  };

  const cultura = {
    id: CULTURA_ID,
    nome: 'Limão Tahiti',
    fichaAtual: { fichaId: FICHA_ID, versao: 1 },
  };

  return { ficha, alvos: ALVOS, cultura };
}
