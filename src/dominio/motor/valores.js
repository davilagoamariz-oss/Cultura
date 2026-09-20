// Leitura dos valores observados nas plantas. Funções puras.
//
// Cada quadrante (A, B) de um item guarda um de:
//   null  não avaliável (o "-" da ficha; fica FORA da conta)
//   0     ausente
//   1..3  presente, com a intensidade (1 = até 5 pragas, 2 = de 6 a 15, 3 = mais de 15)
// A diferença entre null e 0 é essencial: "não medi" não é "não há praga".

/**
 * Valor de uma planta para um item.
 * - { valor: n }  usa n diretamente (contagens, ou a fixture da ficha)
 * - { A, B }      número de quadrantes com presença (0, 1 ou 2)
 * - só um lado preenchido (ex.: bicho-furão) considera apenas esse lado
 * - tudo nulo/ausente -> null (não avaliável)
 */
export function valorPlanta(obs) {
  if (obs === null || obs === undefined) return null;
  if (obs.valor !== undefined) return obs.valor;
  const lados = [obs.A, obs.B].filter((v) => v !== null && v !== undefined);
  if (lados.length === 0) return null;
  return lados.reduce((soma, v) => soma + (v > 0 ? 1 : 0), 0);
}

/** Maior intensidade (0 a 3) entre os quadrantes de uma planta; null se não avaliável. */
export function intensidadePlanta(obs) {
  if (obs === null || obs === undefined) return null;
  if (obs.valor !== undefined) return obs.valor;
  const lados = [obs.A, obs.B].filter((v) => v !== null && v !== undefined);
  if (lados.length === 0) return null;
  return Math.max(...lados.map((v) => (v > 0 ? v : 0)));
}

/** Nível de infestação de um item: plantas com valor > 0 / plantas avaliadas. */
export function calcularNI(plantas, itemId) {
  let avaliadas = 0;
  let positivas = 0;
  for (const planta of plantas) {
    const v = valorPlanta(planta.obs?.[itemId]);
    if (v === null || v === undefined) continue;
    avaliadas += 1;
    if (v > 0) positivas += 1;
  }
  return { avaliadas, positivas, ni: avaliadas === 0 ? null : positivas / avaliadas };
}

/** Quantas plantas têm intensidade >= minima no item. */
export function plantasComIntensidade(plantas, itemId, minima) {
  let total = 0;
  for (const planta of plantas) {
    const i = intensidadePlanta(planta.obs?.[itemId]);
    if (i !== null && i !== undefined && i >= minima) total += 1;
  }
  return total;
}
