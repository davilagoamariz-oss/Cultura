// Trilha de auditoria (eventos/{id}): quem fez o quê, quando. Só acrescenta, nunca se altera nem se
// apaga. Lida por admin, e por gerente/agrônomo do setor do evento (firestore.rules). Função pura:
// quem grava (o repositório) carimba a hora do servidor e escreve no MESMO lote da ação registrada,
// para o evento nunca existir sem a ação (nem a ação sem o evento).
const MAX_ACAO = 40; // limite das firestore.rules
const MAX_ALVO = 200;
const MAX_DETALHE = 500;

function cortar(texto, max) {
  const t = String(texto ?? '').trim();
  return t.length > max ? t.slice(0, max) : t;
}

/** @returns { uid, acao, alvo?, setorId?, detalhe? } pronto para gravar (sem "em", que é serverTimestamp()). */
export function montarEvento({ uid, acao, alvo, setorId, detalhe }) {
  if (!uid) throw new Error('evento sem uid');
  const a = cortar(acao, MAX_ACAO);
  if (!a) throw new Error('evento sem ação');
  const alvoTexto = alvo ? cortar(alvo, MAX_ALVO) : '';
  const detalheTexto = detalhe ? cortar(detalhe, MAX_DETALHE) : '';
  return {
    uid,
    acao: a,
    ...(alvoTexto ? { alvo: alvoTexto } : {}),
    ...(setorId ? { setorId } : {}),
    ...(detalheTexto ? { detalhe: detalheTexto } : {}),
  };
}
