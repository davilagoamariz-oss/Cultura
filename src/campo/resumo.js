// Modelo do resumo (prévia do NI e da TD) a partir do resultado do motor. Função pura.
import { corDoResultado } from '../dominio/motor/cor.js';

const pct = (v) => (v === null || v === undefined ? '—' : `${(v * 100).toFixed(1).replace('.', ',')}%`);
export const formatarPercentual = pct;

/** "≥ 10%" ou "> 20%" (percentual) ou "≥ 1 planta" (contagem); null = sem limite definido. */
export function textoDoLimite(nivel) {
  if (!nivel || nivel.limite === null || nivel.limite === undefined) return 'sem limite definido';
  const op = nivel.operador === '>' ? '>' : '≥';
  return `${op} ${pct(nivel.limite)}`;
}

const SECOES = [
  { chave: 'acao', titulo: 'Atingiram o nível de ação' },
  { chave: 'limite_nao_definido', titulo: 'Sem limite definido (revisar)' },
  { chave: 'abaixo', titulo: 'Abaixo do nível de ação' },
  { chave: 'sem_limite_nada', titulo: 'Sem limite definido (nada detectado)' },
  { chave: 'sem_dados', titulo: 'Sem dados' },
  { chave: 'informativo', titulo: 'Inimigos naturais e indicadores' },
  { chave: 'nao_aplicavel', titulo: 'Não se aplicam a este talhão' },
];

function linha(r) {
  const principal = r.niveis?.find((n) => n.id === r.nivelDisparado) ?? r.niveis?.find((n) => n.limite !== null) ?? r.niveis?.[0];
  return {
    id: r.id,
    nome: r.nome,
    orgao: r.orgao,
    status: r.status,
    // "sem limite definido" só pede revisão quando a praga foi DETECTADA; sem detecção, fica numa seção discreta
    secao: r.status === 'limite_nao_definido' && !(r.ni > 0) ? 'sem_limite_nada' : r.status,
    ni: r.ni,
    niTexto: pct(r.ni),
    avaliadas: r.avaliadas,
    positivas: r.positivas,
    td: r.status === 'acao' ? r.td : null,
    limiteTexto: r.status === 'informativo' || r.status === 'nao_aplicavel' ? null : textoDoLimite(principal),
    nivelDisparado: r.nivelDisparado ?? null,
    cor: corDoResultado(r),
  };
}

/** Frase principal do resumo. Deixa claro que REVISAR não é "não pulverizar". */
function manchete(tds, revisar) {
  if (tds.length === 1 && tds[0] === 'REVISAR') {
    return {
      tipo: 'revisar',
      texto: 'REVISAR: há praga detectada sem limite definido. Isto NÃO significa "não pulverizar": o agrônomo precisa decidir.',
    };
  }
  if (tds.length === 1 && tds[0] === 'TD1') return { tipo: 'nenhuma_acao', texto: 'Nenhum item atingiu o nível de ação.' };
  return {
    tipo: 'acao',
    texto: revisar.length > 0 ? 'Há itens que atingiram o nível de ação, e há itens sem limite definido para revisar.' : 'Há itens que atingiram o nível de ação.',
  };
}

/**
 * @param resultado  saída de avaliar()
 * @param ficha      para os textos dos TDs
 */
export function montarResumo(resultado, ficha) {
  const { resultados, decisao } = resultado;
  const linhas = resultados.map(linha);
  const secoes = SECOES.map((s) => ({
    ...s,
    itens: linhas.filter((l) => l.secao === s.chave).sort((a, b) => (b.ni ?? -1) - (a.ni ?? -1) || a.nome.localeCompare(b.nome, 'pt-BR')),
  })).filter((s) => s.itens.length > 0);

  return {
    manchete: manchete(decisao.tds, decisao.revisarManual),
    tds: decisao.tds.map((codigo) => ({ codigo, texto: ficha.tds?.[codigo] ?? (codigo === 'REVISAR' ? 'Revisar manualmente' : codigo) })),
    precisaAplicacao: decisao.precisaAplicacao,
    usarProdutoSeletivo: decisao.usarProdutoSeletivo,
    avisoSeletivo: decisao.usarProdutoSeletivo ? 'Há inimigos naturais presentes: prefira produto seletivo (a escolha do produto é do agrônomo).' : null,
    revisar: decisao.revisarManual.map((r) => ({ id: r.id, nome: r.nome, niTexto: pct(r.ni) })),
    motivos: decisao.motivos.map((m) => ({ id: m.id, nome: m.nome, niTexto: pct(m.ni), limiteTexto: `≥ ${pct(m.limite)}`, td: m.td, nivel: m.nivel })),
    secoes,
  };
}
