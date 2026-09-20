// Motor de regras v2 do monitoramento. Função pura, sem dependência de Firebase: roda igual no
// celular (prévia offline) e no painel, e é testável isoladamente.
//
// Reproduz a ficha FFPRO02 (NI = plantas com valor > 0 / plantas avaliadas) e acrescenta:
//  - métricas plugáveis (registro em metricas.js);
//  - vários níveis por regra: vence o mais grave e o resultado diz qual nível disparou;
//  - limite por contexto (atributos do talhão, intensidade) e ajustes da empresa, sem campos
//    fixos de uma cultura;
//  - a regra de ouro: praga detectada num item sem limite definido NUNCA vira TD1 (REVISAR).
import { obterMetrica } from './metricas.js';
import { calcularNI, plantasComIntensidade } from './valores.js';

const EPS = 1e-9;
const TDS_QUE_PULVERIZAM = ['TD2', 'TD3', 'TD4'];

function atingiu(valor, limite, operador = '>=') {
  if (valor === null || valor === undefined || Number.isNaN(valor)) return false;
  return operador === '>' ? valor > limite + EPS : valor + EPS >= limite;
}

function atributosBatem(exigidos, atributos) {
  return Object.entries(exigidos).every(([chave, valor]) => atributos[chave] === valor);
}

function paraMillis(v) {
  if (v === null || v === undefined) return Number.NaN;
  if (typeof v === 'number') return v;
  if (v instanceof Date) return v.getTime();
  if (typeof v.toMillis === 'function') return v.toMillis(); // Timestamp do Firestore
  return Number.NaN;
}

/**
 * Escolhe o ajuste da empresa que vale para um nível, ou null.
 * Ajuste: { culturaId?, itemId? | alvoId?, nivelId?, limite, vigenteDe }.
 * - "itemId" é mais específico que "alvoId" (que vale para todos os itens do alvo);
 * - sem "nivelId", o ajuste só vale em regras de nível único;
 * - vale o mais recente com vigenteDe <= referencia (o histórico nunca é reescrito).
 */
function escolherAjuste(ajustes, ficha, regra, nivel, referenciaMs) {
  const nivelUnico = regra.niveis.length === 1;
  let melhor = null;
  for (const a of ajustes) {
    if (a.culturaId !== undefined && a.culturaId !== ficha.culturaId) continue;
    if (typeof a.limite !== 'number' || !Number.isFinite(a.limite) || a.limite < 0) continue;
    const desde = paraMillis(a.vigenteDe);
    if (Number.isNaN(desde) || desde > referenciaMs) continue;

    const especificidade = a.itemId !== undefined ? 2 : a.alvoId !== undefined ? 1 : 0;
    if (especificidade === 0) continue;
    if (especificidade === 2 ? a.itemId !== regra.itemId : a.alvoId !== regra.alvoId) continue;
    if ((a.nivelId ?? (nivelUnico ? nivel.id : null)) !== nivel.id) continue;

    if (!melhor || especificidade > melhor.especificidade || (especificidade === melhor.especificidade && desde > melhor.desde)) {
      melhor = { ajuste: a, especificidade, desde };
    }
  }
  return melhor?.ajuste ?? null;
}

/**
 * Avalia uma inspeção completa.
 * @param ficha      ficha versionada (catalogo/fichas/...), já validada
 * @param plantas    [{ n, obs: { itemId: { A, B } } }]
 * @param atributos  atributos do talhão no momento da avaliação, ex.: { tipoPomar: 'adulto', citrosVizinhos: true }
 * @param ajustes    histórico de ajustes da empresa (vários por alvo; vale o vigente na referência)
 * @param referencia quando avaliar os ajustes (Date, ms ou Timestamp); padrão: todos os ajustes
 */
export function avaliar({ ficha, plantas, atributos = {}, ajustes = [], referencia = null }) {
  if (!ficha?.regras || !ficha?.itens) throw new Error('avaliar: ficha inválida');
  const referenciaMs = referencia === null || referencia === undefined ? Number.POSITIVE_INFINITY : paraMillis(referencia);
  const itens = new Map(ficha.itens.map((i) => [i.id, i]));

  const resultados = ficha.regras.map((regra) => {
    const item = itens.get(regra.itemId);
    const base = {
      id: item.id,
      nome: item.nome,
      orgao: item.orgao,
      alvoId: regra.alvoId ?? item.alvoId,
      td: regra.niveis[0]?.td ?? null,
    };

    if (regra.aplicaSe && !atributosBatem(regra.aplicaSe.atributos, atributos)) {
      return { ...base, status: 'nao_aplicavel', ni: null, avaliadas: 0, positivas: 0, limite: null };
    }

    const { ni, avaliadas, positivas } = calcularNI(plantas, regra.itemId);
    const comum = { ...base, ni, avaliadas, positivas, nivelDisparado: null, niveis: [] };

    if (regra.informativo) return { ...comum, limite: null, status: 'informativo' };

    // Níveis que valem para este talhão e esta inspeção (gatilhos "quando").
    const aplicaveis = regra.niveis.filter((nivel) => {
      const q = nivel.quando;
      if (!q) return true;
      if (q.atributos && !atributosBatem(q.atributos, atributos)) return false;
      if (q.intensidade && plantasComIntensidade(plantas, regra.itemId, q.intensidade.minima) < q.intensidade.plantas) return false;
      return true;
    });

    const contexto = { itemId: regra.itemId, plantas, ni, avaliadas, positivas };
    const avaliados = aplicaveis.map((nivel) => {
      const ajuste = escolherAjuste(ajustes, ficha, regra, nivel, referenciaMs);
      const limite = ajuste ? ajuste.limite : nivel.limite;
      const metrica = obterMetrica(nivel.metrica);
      const valor = limite !== null && metrica ? metrica(contexto) : null;
      return {
        id: nivel.id,
        td: nivel.td,
        gravidade: nivel.gravidade,
        operador: nivel.operador,
        limite,
        origemLimite: ajuste ? 'ajuste' : 'ficha',
        valor,
        atingido: limite !== null && atingiu(valor, limite, nivel.operador),
      };
    });
    const publicos = avaliados.map(({ id, td, operador, limite, origemLimite, valor, atingido }) => ({ id, td, operador, limite, origemLimite, valor, atingido }));
    const primeiroDefinido = avaliados.find((n) => n.limite !== null);
    const comNiveis = { ...comum, niveis: publicos, operador: primeiroDefinido?.operador ?? '>=', limite: primeiroDefinido?.limite ?? null };

    if (avaliadas === 0) return { ...comNiveis, status: 'sem_dados' };

    const disparados = avaliados.filter((n) => n.atingido);
    if (disparados.length > 0) {
      // vence o mais grave; em empate, o primeiro da ficha
      const vencedor = disparados.reduce((a, b) => (b.gravidade > a.gravidade ? b : a));
      return { ...comNiveis, status: 'acao', td: vencedor.td, limite: vencedor.limite, operador: vencedor.operador, nivelDisparado: vencedor.id };
    }

    // Sem nível disparado: se algum nível aplicável não tem limite (ou nenhum nível se aplica),
    // não dá para afirmar que está abaixo do limite.
    const semLimite = aplicaveis.length === 0 || avaliados.some((n) => n.limite === null);
    return { ...comNiveis, status: semLimite ? 'limite_nao_definido' : 'abaixo' };
  });

  const acoes = resultados.filter((r) => r.status === 'acao');
  const tds = [...new Set(acoes.map((r) => r.td))].sort();
  // Praga detectada, mas sem regra: o app nunca deve dizer "não pulverizar" nesse caso.
  const revisarManual = resultados.filter((r) => r.status === 'limite_nao_definido' && r.ni > 0);
  const inimigosPresentes = resultados.filter((r) => r.status === 'informativo' && r.ni > 0);
  const quePulverizam = ficha.tdsQuePulverizam ?? TDS_QUE_PULVERIZAM;
  const precisaAplicacao = tds.some((td) => quePulverizam.includes(td));

  let tdFinal;
  if (tds.length > 0) tdFinal = tds;
  else if (revisarManual.length > 0) tdFinal = ['REVISAR'];
  else tdFinal = ['TD1'];

  return {
    resultados,
    decisao: {
      tds: tdFinal,
      precisaAplicacao,
      usarProdutoSeletivo: precisaAplicacao && inimigosPresentes.length > 0,
      motivos: acoes.map((r) => ({ id: r.id, nome: r.nome, ni: r.ni, limite: r.limite, td: r.td, nivel: r.nivelDisparado })),
      revisarManual: revisarManual.map((r) => ({ id: r.id, nome: r.nome, ni: r.ni })),
      inimigosPresentes: inimigosPresentes.map((r) => ({ id: r.id, nome: r.nome, ni: r.ni })),
    },
  };
}
