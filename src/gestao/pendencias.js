// Quantos itens esperam a ação de quem está logado, para mostrar um número na aba do módulo. Sem push
// notification (Spark), é o jeito de o agrônomo e o gerente perceberem que há algo sem abrir a lista.
// Função pura: os dados já vêm de listeners que a tela já mantém.

/**
 * @param avaliacoes    avaliações finalizadas do setor (não precisa filtrar por decidida: filtra aqui)
 * @param decisoes      TODAS as decisões do setor (sem filtro de semana)
 * @param podeDecidir   a pessoa tem a função de agrônomo neste setor
 * @param ehGerente     a pessoa é gerente deste setor
 * @returns { aguardandoDecisao, aguardandoExecucao, total }
 */
export function contarPendencias({ avaliacoes = [], decisoes = [], podeDecidir = false, ehGerente = false }) {
  const decididas = new Set(decisoes.map((d) => d.avaliacaoId));
  const aguardandoDecisao = podeDecidir ? avaliacoes.filter((a) => a.status === 'finalizada' && !decididas.has(a.id)).length : 0;
  const aguardandoExecucao = ehGerente ? decisoes.filter((d) => d.status === 'aprovada').length : 0;
  return { aguardandoDecisao, aguardandoExecucao, total: aguardandoDecisao + aguardandoExecucao };
}
