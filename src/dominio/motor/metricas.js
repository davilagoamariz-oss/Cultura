// Registro de métricas do motor. Uma métrica transforma o que foi observado num item em um
// número que é comparado com o limite de um nível de ação.
//
// Contexto recebido por toda métrica:
//   { itemId, plantas, ni, avaliadas, positivas }
//   ni = positivas / avaliadas (null se não houve plantas avaliadas)
//
// Para acrescentar uma métrica nova (ex.: contagem de adultos na armadilha do bicho-furão),
// registre-a aqui e use o nome dela nos níveis da ficha. O motor não muda.

const registro = new Map();

export function registrarMetrica(nome, calcular) {
  if (typeof nome !== 'string' || nome.length === 0) throw new Error('nome de métrica inválido');
  if (typeof calcular !== 'function') throw new Error(`métrica ${nome}: precisa de uma função`);
  if (registro.has(nome)) throw new Error(`métrica ${nome} já registrada`);
  registro.set(nome, calcular);
}

export function obterMetrica(nome) {
  return registro.get(nome) ?? null;
}

export function metricaExiste(nome) {
  return registro.has(nome);
}

export function nomesDeMetricas() {
  return [...registro.keys()];
}

// Porcentagem de plantas com a praga (0 a 1). É o comportamento da ficha FFPRO02:
// NI = COUNTIF(>0) / COUNT. Sem plantas avaliadas o NI é null ("sem dados"), nunca 0.
registrarMetrica('percent_plantas', ({ ni }) => ni);

// Quantas plantas têm a praga (contagem). Serve para focos: "uma planta positiva".
registrarMetrica('plantas_positivas', ({ positivas }) => positivas);
