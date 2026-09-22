// Visão comparativa entre talhões: junta os itens que pediram atenção (ação ou revisar) em VÁRIAS
// avaliações já calculadas, para o agrônomo priorizar sem abrir talhão por talhão. Funções puras: quem
// calcula cada avaliação é o motor (avaliar + montarResumo); isto só junta e ordena o resultado.

const SECOES_DE_ATENCAO = ['acao', 'limite_nao_definido'];

/**
 * @param avaliacoesComResumo  [{ talhaoNome, resumo }]  resumo = saída de montarResumo()
 * @returns uma linha por (talhão, item) que pediu atenção, do mais crítico (maior NI) para o menos.
 *          Itens sem NI (limite não definido, nunca detectado) ficam por último.
 */
export function linhasComparativas(avaliacoesComResumo) {
  const linhas = [];
  for (const { talhaoNome, resumo } of avaliacoesComResumo) {
    for (const secao of resumo.secoes) {
      if (!SECOES_DE_ATENCAO.includes(secao.chave)) continue;
      for (const item of secao.itens) {
        linhas.push({ talhaoNome, itemNome: item.nome, orgao: item.orgao, status: item.status, ni: item.ni, niTexto: item.niTexto, td: item.td });
      }
    }
  }
  return linhas.sort((a, b) => (b.ni ?? -1) - (a.ni ?? -1) || a.talhaoNome.localeCompare(b.talhaoNome, 'pt-BR'));
}

/** Por item: em quantos e em quais talhões apareceu, do mais recorrente para o menos (achar um foco espalhado). */
export function resumoPorItem(linhas) {
  const mapa = new Map();
  for (const l of linhas) {
    if (!mapa.has(l.itemNome)) mapa.set(l.itemNome, { itemNome: l.itemNome, talhoes: [] });
    mapa.get(l.itemNome).talhoes.push(l.talhaoNome);
  }
  return [...mapa.values()].sort((a, b) => b.talhoes.length - a.talhoes.length || a.itemNome.localeCompare(b.itemNome, 'pt-BR'));
}
