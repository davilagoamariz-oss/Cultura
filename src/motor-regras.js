// Motor de regras do monitoramento de pragas e doenças do limão Tahiti.
// Função pura, sem dependência de Firebase: roda igual no celular (prévia offline)
// e no servidor (Cloud Function), e é testável isoladamente.
//
// Reproduz a lógica da ficha FFPRO02:
//   NI = plantas com valor > 0 / plantas avaliadas  (célula vazia = não avaliada)
// Diferença deliberada: sem nenhuma planta avaliada o NI é null ("sem dados"),
// e não 0 como na planilha, para não confundir "não medi" com "não há praga".

const EPS = 1e-9;
const TDS_QUE_PULVERIZAM = ['TD2', 'TD3', 'TD4'];

/**
 * Valor de uma planta para um item da ficha.
 * - { valor: n }  -> usa n diretamente (contagens, ou a fixture da ficha)
 * - { A: 0|1, B: 0|1 } -> número de quadrantes com presença (0, 1 ou 2)
 * - só um lado preenchido (ex.: bicho-furão) -> considera apenas esse lado
 * - tudo nulo/ausente -> null (não avaliável, o "-" da ficha)
 */
export function valorPlanta(obs) {
  if (obs === null || obs === undefined) return null;
  if (obs.valor !== undefined) return obs.valor;
  const lados = [obs.A, obs.B].filter((v) => v !== null && v !== undefined);
  if (lados.length === 0) return null;
  return lados.reduce((soma, v) => soma + (v > 0 ? 1 : 0), 0);
}

/** Nível de infestação de um item numa lista de plantas. */
export function calcularNI(plantas, itemId) {
  let avaliadas = 0;
  let positivas = 0;
  for (const planta of plantas) {
    const v = valorPlanta(planta.obs?.[itemId]);
    if (v === null || v === undefined) continue;
    avaliadas += 1;
    if (v > 0) positivas += 1;
  }
  return { avaliadas, positivas, ni: avaliadas === 0 ? null : positivas / avaliadas };
}

/** Limite efetivo de uma regra (considera tipo de pomar). */
export function limiteDaRegra(regra, tipoPomar) {
  if (regra.limitePorTipoPomar) return regra.limitePorTipoPomar[tipoPomar] ?? null;
  return regra.limite ?? null;
}

/** Aplica limites escolhidos por fazenda, ex.: { ferrugem_bgude: 0.10 }. */
export function aplicarOverrides(regras, overrides = {}) {
  return regras.map((r) => (overrides[r.id] !== undefined ? { ...r, limite: overrides[r.id] } : r));
}

function atingiu(ni, limite, operador = '>=') {
  return operador === '>' ? ni > limite + EPS : ni + EPS >= limite;
}

/**
 * Avalia uma inspeção completa.
 * @param avaliacao { tipoPomar: 'adulto'|'novo', contexto?: { citrosVizinhos?: boolean }, plantas: [{ n, obs }] }
 * @param regras    lista de regras (regras-iniciais.json -> .regras), já com overrides aplicados
 */
export function avaliar(avaliacao, regras) {
  const { plantas, tipoPomar, contexto = {} } = avaliacao;

  const resultados = regras.map((regra) => {
    const base = {
      id: regra.id, nome: regra.nome, orgao: regra.orgao, td: regra.td ?? null,
    };
    if (regra.condicao === 'citros_vizinhos' && !contexto.citrosVizinhos) {
      return { ...base, status: 'nao_aplicavel', ni: null, avaliadas: 0, positivas: 0, limite: null };
    }
    const { ni, avaliadas, positivas } = calcularNI(plantas, regra.id);
    const limite = limiteDaRegra(regra, tipoPomar);
    const comum = { ...base, ni, avaliadas, positivas, limite, operador: regra.operador ?? '>=' };

    if (regra.informativo) return { ...comum, status: 'informativo' };
    if (avaliadas === 0) return { ...comum, status: 'sem_dados' };
    if (limite === null) return { ...comum, status: 'limite_nao_definido' };
    return { ...comum, status: atingiu(ni, limite, regra.operador) ? 'acao' : 'abaixo' };
  });

  const acoes = resultados.filter((r) => r.status === 'acao');
  const tds = [...new Set(acoes.map((r) => r.td))].sort();
  // Praga detectada, mas sem regra: o app nunca deve dizer "não pulverizar" nesse caso.
  const revisarManual = resultados.filter((r) => r.status === 'limite_nao_definido' && r.ni > 0);
  const inimigosPresentes = resultados.filter((r) => r.status === 'informativo' && r.ni > 0);
  const precisaAplicacao = tds.some((td) => TDS_QUE_PULVERIZAM.includes(td));

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
      motivos: acoes.map((r) => ({ id: r.id, nome: r.nome, ni: r.ni, limite: r.limite, td: r.td })),
      revisarManual: revisarManual.map((r) => ({ id: r.id, nome: r.nome, ni: r.ni })),
      inimigosPresentes: inimigosPresentes.map((r) => ({ id: r.id, nome: r.nome, ni: r.ni })),
    },
  };
}
