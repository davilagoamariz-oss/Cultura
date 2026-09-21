// Limites de ação: o que a ficha diz e o que a empresa ajustou por cima. Funções puras.
//
// A ficha nunca é alterada. A empresa acrescenta "ajustes" (só acrescenta, com a hora do servidor), e o motor usa o
// mais recente. Aqui: listar cada nível da ficha com o limite que vale hoje e montar um ajuste novo.
import { escolherAjuste } from '../dominio/motor/motor.js';

/** Métricas cujo limite a empresa pode ajustar, e como o número é digitado. */
const UNIDADES = {
  percent_plantas: { rotulo: '% das plantas', texto: (l) => `${arredondar(l * 100)}%`, aoGuardar: (n) => n / 100 },
  plantas_positivas: { rotulo: 'plantas positivas', texto: (l) => `${l} planta${l === 1 ? '' : 's'}`, aoGuardar: (n) => n },
};
const arredondar = (n) => Math.round(n * 100) / 100;

export const metricaAjustavel = (metrica) => Object.hasOwn(UNIDADES, metrica);

const rotuloQuando = (quando) => {
  const partes = [];
  for (const [k, v] of Object.entries(quando?.atributos ?? {})) partes.push(v === true ? k : v === false ? `sem ${k}` : String(v));
  if (quando?.intensidade) partes.push(`intensidade ${quando.intensidade}`);
  return partes.join(', ');
};

/**
 * Uma linha por nível de cada regra da ficha: o limite da ficha, o que vale hoje (com ajuste) e de onde vem.
 * @returns [{ chave, itemId, nivelId, itemNome, condicao, metrica, ajustavel, limiteFicha, limiteVigente, origem, textoVigente, textoFicha, opcoes }]
 */
export function linhasDeLimites(ficha, ajustes = [], agora = Date.now()) {
  const nomes = new Map((ficha.itens ?? []).map((i) => [i.id, i.nome]));
  const linhas = [];
  for (const regra of ficha.regras ?? []) {
    for (const nivel of regra.niveis ?? []) {
      const ajuste = escolherAjuste(ajustes, ficha, regra, nivel, agora);
      const u = UNIDADES[nivel.metrica];
      const texto = (l) => (l === null || l === undefined ? 'sem limite definido' : u ? u.texto(l) : String(l));
      const vigente = ajuste ? ajuste.limite : nivel.limite ?? null;
      linhas.push({
        chave: `${regra.itemId}/${nivel.id}`,
        itemId: regra.itemId,
        nivelId: nivel.id,
        itemNome: nomes.get(regra.itemId) ?? regra.itemId,
        condicao: rotuloQuando(nivel.quando),
        metrica: nivel.metrica,
        ajustavel: Boolean(u),
        rotuloUnidade: u?.rotulo ?? nivel.metrica,
        limiteFicha: nivel.limite ?? null,
        limiteVigente: vigente,
        origem: ajuste ? 'ajuste' : nivel.limite === null || nivel.limite === undefined ? 'pendente' : 'ficha',
        textoVigente: texto(vigente),
        textoFicha: texto(nivel.limite),
        opcoes: (regra.opcoesLimite ?? []).map((o) => ({ valor: o, texto: texto(o) })),
      });
    }
  }
  return linhas;
}

/** Digitado em "%" (ou em plantas) -> valor guardado (fração ou contagem). Vírgula ou ponto. */
export function lerLimite(metrica, entrada) {
  const u = UNIDADES[metrica];
  if (!u) throw new Error('Este limite não pode ser ajustado pelo app');
  const t = String(entrada ?? '').trim().replace(',', '.');
  if (t === '') throw new Error('Informe o limite');
  const n = Number(t);
  if (!Number.isFinite(n)) throw new Error('Limite: informe um número');
  if (metrica === 'percent_plantas') {
    if (n <= 0 || n > 100) throw new Error('Limite: informe de 0 a 100 (em %)');
    return u.aoGuardar(n);
  }
  if (!Number.isInteger(n) || n < 1 || n > 30) throw new Error('Limite: informe de 1 a 30 plantas');
  return u.aoGuardar(n);
}

/**
 * Ajuste novo para um nível da ficha. Sempre com item e nível (vale só para aquele nível). A hora (vigenteDe) e
 * quem criou (criadoPor) são carimbados pelo repositório; as regras exigem os dois.
 */
export function montarAjuste({ ficha, itemId, nivelId, entrada, motivo = '' }) {
  const regra = (ficha.regras ?? []).find((r) => r.itemId === itemId);
  const nivel = regra?.niveis?.find((n) => n.id === nivelId);
  if (!regra || !nivel) throw new Error('Limite não encontrado na ficha');
  const limite = lerLimite(nivel.metrica, entrada);
  const m = String(motivo ?? '').trim();
  if (m.length > 500) throw new Error('Motivo: no máximo 500 caracteres');
  return { culturaId: ficha.culturaId, itemId, nivelId, limite, ...(m ? { motivo: m } : {}) };
}

/** Histórico dos ajustes de um nível, do mais novo para o mais antigo (para mostrar quem mudou e quando). */
export function historicoDoNivel(ajustes, itemId, nivelId) {
  const ms = (a) => (typeof a.vigenteDe?.toMillis === 'function' ? a.vigenteDe.toMillis() : Number(a.vigenteDe) || 0);
  return ajustes.filter((a) => a.itemId === itemId && a.nivelId === nivelId).sort((a, b) => ms(b) - ms(a));
}
