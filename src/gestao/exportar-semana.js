// Exporta a lista da semana (Acompanhamento) para CSV, para guardar ou mandar para fora do app
// (auditoria, certificação). Tudo no aparelho: sem servidor, sem biblioteca nova. Funções puras.
import { ROTULO_STATUS_DECISAO } from './decisao.js';

const CABECALHO = ['Talhão', 'Pragueiro', 'Data da inspeção', 'Situação', 'Tomadas de decisão'];

const SITUACAO_SEM_DECISAO = { rascunho: 'Em andamento', finalizada: 'Aguardando decisão' };

/**
 * Escapa uma célula para CSV: aspas quando tem ";", aspas ou quebra de linha; aspas internas
 * dobradas. Um "'" na frente de quem começa com =, +, -, @, tab ou CR neutraliza "injeção de
 * fórmula" (a célula abriria como fórmula executável no Excel/Sheets); o apóstrofo faz o programa
 * tratar como texto. O nome do talhão e o nome da pessoa vêm de texto livre digitado no cadastro.
 */
function celula(valor) {
  let texto = String(valor ?? '');
  if (/^[=+\-@\t\r]/.test(texto)) texto = `'${texto}`;
  return /[;"\n]/.test(texto) ? `"${texto.replaceAll('"', '""')}"` : texto;
}

function linhaCsv(l) {
  const situacao = l.decisaoStatus ? ROTULO_STATUS_DECISAO[l.decisaoStatus] : SITUACAO_SEM_DECISAO[l.status] ?? l.status;
  return [l.talhaoNome, l.pragueiro ?? '', l.dataTexto ?? '', situacao, (l.tds ?? []).join(' ')];
}

/** Monta o texto do CSV (separador ";", como o Excel em pt-BR exporta). Uma linha por avaliação. */
export function csvDaSemana(linhas) {
  const todas = [CABECALHO, ...linhas.map(linhaCsv)];
  return todas.map((campos) => campos.map(celula).join(';')).join('\r\n');
}

/** Nome do arquivo: "acompanhamento-2026-W39.csv". */
export const nomeDoArquivo = (semana) => `acompanhamento-${semana}.csv`;
