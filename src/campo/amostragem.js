// Tamanho da amostra por área/espaçamento do talhão. Função pura.
//
// Fonte: Manual Embrapa Doc. 183 (Santos Filho et al., 2009), p.11-14.
//   "O talhão a ser amostrado (...) foi estabelecido em cinco hectares correspondendo a cerca de
//   1.500 plantas, dependendo do espaçamento, sendo a amostragem mínima definida como sendo 15
//   plantas por talhão, correspondendo a 1% do total (...) Em caso de áreas menores do que cinco
//   hectares considerar 10 plantas (...) Em caso de áreas maiores de cinco hectares, considerar 1%
//   do número total de plantas do talhão a ser amostrado."
//
// Um talhão maior que 5 ha não vira uma "sub-área" nova aqui dentro: o próprio talhão já é a
// unidade de amostragem e de decisão (ADR 024) — o cadastro (Admin) só avisa para considerar
// dividir o campo em vários talhões de ~5 ha quando a área ultrapassa isso.

const AREA_REFERENCIA_HA = 5;
const AMOSTRA_MENOR_QUE_REFERENCIA = 10;
const AMOSTRA_MINIMA = 10; // piso do manual, mesmo quando 1% do total daria menos que isso
const AMOSTRA_PADRAO_SEM_DADO = 15; // "amostragem mínima" do manual (a unidade de referência de 5 ha)

/** Plantas por hectare a partir do espaçamento (metros entre plantas x metros entre linhas). */
export function densidadePorHa(espacamento) {
  const { entrePlantas: p, entreLinhas: l } = espacamento ?? {};
  if (typeof p !== 'number' || typeof l !== 'number' || p <= 0 || l <= 0) return null;
  return 10000 / (p * l);
}

/** Total de plantas do talhão, a partir da área e do espaçamento; null se faltar algum dado. */
export function totalDePlantasDoTalhao(areaHa, espacamento) {
  const densidade = densidadePorHa(espacamento);
  if (densidade === null || typeof areaHa !== 'number' || areaHa <= 0) return null;
  return Math.round(areaHa * densidade);
}

/**
 * Tamanho da amostra (nº de plantas a avaliar), pelas faixas do manual.
 * Sem área e/ou espaçamento cadastrados, cai no piso do manual (15 — a "amostragem mínima" da
 * unidade de referência de 5 ha), documentado explicitamente como um valor padrão, não um cálculo.
 */
export function calcularTamanhoAmostra(areaHa, espacamento) {
  if (typeof areaHa !== 'number' || areaHa <= 0) return AMOSTRA_PADRAO_SEM_DADO;
  if (areaHa < AREA_REFERENCIA_HA) return AMOSTRA_MENOR_QUE_REFERENCIA;
  const total = totalDePlantasDoTalhao(areaHa, espacamento);
  if (total === null) return AMOSTRA_PADRAO_SEM_DADO;
  return Math.max(AMOSTRA_MINIMA, Math.round(total * 0.01));
}

/** Acima disso, o manual recomenda tratar como mais de uma unidade de amostragem (ADR 024). */
export const AREA_SUGERE_DIVIDIR_HA = AREA_REFERENCIA_HA;
