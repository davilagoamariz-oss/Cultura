/** Texto do indicador do cabeçalho, ou null quando não há nada aguardando envio. */
export function textoPendentes(total) {
  if (!total) return null;
  return total === 1 ? '1 item aguardando envio' : `${total} itens aguardando envio`;
}
