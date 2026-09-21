// Decisão do agrônomo sobre uma avaliação finalizada, e execução pelo gerente. Funções puras: montam os
// documentos exatamente como as firestore.rules exigem (uma decisão por avaliação, id = id da avaliação).

export const STATUS_DECISAO = ['aprovada', 'rejeitada'];
export const MAX_OBSERVACAO = 1000;
export const MAX_TDS = 8;
export const PRAZO_DIAS = 3; // manual da Embrapa: no máximo 3 dias entre a inspeção e a aplicação

export const ROTULO_STATUS_DECISAO = { aprovada: 'Aprovada', rejeitada: 'Rejeitada', executada: 'Executada' };

/** Códigos de TD que a ficha oferece (TD1 a TD6), em ordem. */
export const tdsDaFicha = (ficha) => Object.keys(ficha.tds ?? {}).sort();

/** TDs sugeridos pelo cálculo, sem o "REVISAR" (que não é uma decisão, é um pedido de revisão). */
export const tdsSugeridos = (modelo) => modelo.tds.map((t) => t.codigo).filter((c) => c !== 'REVISAR');

/** Resumo dos motivos que vai junto com a decisão (o que disparou cada TD). */
const motivosCompactos = (motivos = []) => motivos.slice(0, 30).map((m) => ({ id: m.id, nivel: m.nivel ?? null, td: m.td }));

/**
 * @param avaliacao  cabeçalho lido do banco, com `id`, `status`, `talhaoId`, `unidadeId`, `setorId`
 * @param status     'aprovada' (executar estes TDs) ou 'rejeitada' (não acatar a sugestão; exige observação)
 * @param tds        aprovada: os TDs decididos; rejeitada: os TDs que o cálculo sugeriu (fica o registro)
 */
export function montarDecisao({ ficha, avaliacao, uid, status, tds, motivos = [], observacao = '', decididoEm }) {
  if (avaliacao?.status !== 'finalizada') throw new Error('só se decide uma avaliação finalizada');
  if (!STATUS_DECISAO.includes(status)) throw new Error('escolha aprovar ou rejeitar');
  const validos = new Set(tdsDaFicha(ficha));
  const lista = [...new Set(tds)];
  if (lista.length === 0) throw new Error('escolha ao menos uma tomada de decisão');
  if (lista.length > MAX_TDS) throw new Error('tomadas de decisão demais');
  if (lista.some((t) => !validos.has(t))) throw new Error('tomada de decisão desconhecida');
  if (status === 'aprovada' && lista.includes('TD1') && lista.length > 1) throw new Error('"Não pulverizar" não combina com outras tomadas de decisão');
  const texto = (observacao ?? '').trim();
  if (texto.length > MAX_OBSERVACAO) throw new Error(`observação: no máximo ${MAX_OBSERVACAO} caracteres`);
  if (status === 'rejeitada' && texto.length < 5) throw new Error('para rejeitar, explique o motivo na observação');

  return {
    avaliacaoId: avaliacao.id,
    talhaoId: avaliacao.talhaoId,
    unidadeId: avaliacao.unidadeId,
    setorId: avaliacao.setorId,
    tds: lista,
    motivos: motivosCompactos(motivos),
    status,
    decididoPor: uid,
    decididoEm,
    ...(texto ? { observacao: texto } : {}),
  };
}

/** Campos que o gerente grava ao marcar a decisão aprovada como executada. */
export function dadosExecucao({ uid, observacao = '', executadoEm }) {
  const texto = (observacao ?? '').trim();
  if (texto.length > MAX_OBSERVACAO) throw new Error(`observação: no máximo ${MAX_OBSERVACAO} caracteres`);
  return { status: 'executada', executadoPor: uid, executadoEm, ...(texto ? { observacaoExecucao: texto } : {}) };
}

/** O que pode ser feito com a decisão, conforme a situação e a pessoa. */
export function situacaoDaDecisao({ avaliacao, decisao, podeDecidir, ehGerente }) {
  if (!avaliacao) return { fase: 'carregando' };
  if (avaliacao.status !== 'finalizada') return { fase: 'em_andamento' };
  if (!decisao) return { fase: 'aguardando_decisao', podeDecidir: Boolean(podeDecidir) };
  if (decisao.status === 'aprovada') return { fase: 'aprovada', podeExecutar: Boolean(ehGerente) };
  return { fase: decisao.status }; // rejeitada | executada
}

const diaLocal = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());

/**
 * Dias desde a inspeção. O manual recomenda aplicar em no máximo 3 dias; passou disso, avisa.
 * @param dataInspecao "AAAA-MM-DD" (a data gravada na avaliação)
 */
export function prazoDeAplicacao(dataInspecao, hoje = new Date(), limite = PRAZO_DIAS) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dataInspecao ?? '');
  if (!m) return null;
  const inspecao = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const dias = Math.round((diaLocal(hoje) - inspecao) / 86_400_000);
  if (dias < 0) return { dias: 0, atrasado: false, texto: 'Inspeção de hoje.' };
  const atrasado = dias > limite;
  const quando = dias === 0 ? 'hoje' : dias === 1 ? 'há 1 dia' : `há ${dias} dias`;
  return {
    dias,
    atrasado,
    texto: atrasado
      ? `Inspeção ${quando}: passou do prazo recomendado de ${limite} dias entre a inspeção e a aplicação.`
      : `Inspeção ${quando} (o recomendado é aplicar em até ${limite} dias).`,
  };
}
