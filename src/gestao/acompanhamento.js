// Lógica pura da lista de acompanhamento da semana: em qual grupo cada linha cai, e o resumo do
// topo (para o agrônomo e o gerente terem uma visão rápida antes de entrar talhão por talhão).

/** Em qual grupo a linha cai: em andamento (não finalizada), aguardando decisão, aprovada ou concluída. */
export function grupoDaLinha(l) {
  if (l.status !== 'finalizada') return 'em_andamento';
  if (!l.decisaoStatus) return 'aguardando_decisao';
  if (l.decisaoStatus === 'aprovada') return 'aprovada';
  return 'concluida';
}

/** Quantas linhas em cada situação, e o total. */
export function resumirSemana(linhas) {
  const contagem = { em_andamento: 0, aguardando_decisao: 0, aprovada: 0, concluida: 0 };
  for (const l of linhas) contagem[grupoDaLinha(l)] += 1;
  return { total: linhas.length, ...contagem };
}
