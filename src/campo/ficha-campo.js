// Ficha de campo gerada a partir da ficha versionada (catalogo/fichas/...). Funções puras.
//
// Cada quadrante (A, B) de cada item guarda:
//   undefined  ainda não preenchido        (não é gravado)
//   null       não avaliável, o "-" da ficha (fica FORA da conta)
//   0          ausente
//   1, 2, 3    presente, com a intensidade (até 5 / de 6 a 15 / mais de 15 pragas)
// O item de "lado único" (bicho-furão, só o lado da armadilha) usa só o quadrante B; o A é sempre null.

export const ROTULOS_ORGAO = {
  fruto: 'Fruto', folha: 'Folha', broto: 'Broto', flor: 'Flor', tronco: 'Tronco', planta: 'Planta inteira',
};
export const LADO_UNICO = 'B';
export const VALORES = [null, 0, 1, 2, 3];
export const LEGENDA_INTENSIDADE = { 1: 'até 5', 2: '6 a 15', 3: 'mais de 15' };

const valorDefinido = (v) => v !== undefined;

/** [{ orgao, rotulo, itens }] na ordem dos órgãos da ficha; só órgãos que têm itens. */
export function agruparPorOrgao(ficha) {
  return ficha.orgaos
    .map((orgao) => ({ orgao, rotulo: ROTULOS_ORGAO[orgao] ?? orgao, itens: ficha.itens.filter((i) => i.orgao === orgao) }))
    .filter((g) => g.itens.length > 0);
}

/** Quadrantes que o pragueiro preenche neste item. */
export function quadrantesDoItem(item) {
  return item.tipo === 'lado_unico' ? [LADO_UNICO] : ['A', 'B'];
}

export function valorValido(v) {
  return VALORES.includes(v);
}

/** Toque no quadrante: vazio ou "-" vai para 0 (ausente); depois 1, 2, 3 e volta a 0. */
export function proximoValor(atual) {
  if (atual === undefined || atual === null) return 0;
  return atual >= 3 ? 0 : atual + 1;
}

/** Devolve uma cópia de obs com o quadrante alterado. */
export function definirValor(obs, item, quadrante, valor) {
  if (!quadrantesDoItem(item).includes(quadrante)) throw new Error(`quadrante ${quadrante} não vale para ${item.id}`);
  if (valor !== undefined && !valorValido(valor)) throw new Error(`valor inválido: ${valor}`);
  const atual = obs?.[item.id] ?? {};
  return { ...obs, [item.id]: { ...atual, [quadrante]: valor } };
}

/** Ação em bloco: todos os quadrantes do item recebem o mesmo valor (ex.: "Tudo ausente" ou "Sem fruto"). */
export function definirItem(obs, item, valor) {
  return quadrantesDoItem(item).reduce((acc, q) => definirValor(acc, item, q, valor), obs);
}

export function definirGrupo(obs, grupo, valor) {
  return grupo.itens.reduce((acc, item) => definirItem(acc, item, valor), obs);
}

export function itemCompleto(item, obsItem) {
  return quadrantesDoItem(item).every((q) => valorDefinido(obsItem?.[q]));
}

/** Itens ainda sem resposta nesta planta. */
export function itensPendentes(ficha, obs) {
  return ficha.itens.filter((i) => !itemCompleto(i, obs?.[i.id]));
}

export function grupoCompleto(grupo, obs) {
  return grupo.itens.every((i) => itemCompleto(i, obs?.[i.id]));
}

/** 'vazia' (nada respondido) | 'parcial' | 'completa' (todos os itens respondidos). */
export function statusDaPlanta(ficha, obs) {
  const pendentes = itensPendentes(ficha, obs).length;
  if (pendentes === 0) return 'completa';
  return pendentes === ficha.itens.length ? 'vazia' : 'parcial';
}

/**
 * Prepara obs para gravar: tira o que ainda não foi preenchido (o Firestore não aceita undefined),
 * confere os valores e fixa o lado A do item de lado único como null.
 */
export function obsParaGravar(ficha, obs) {
  const saida = {};
  for (const item of ficha.itens) {
    const origem = obs?.[item.id];
    if (!origem) continue;
    const linha = {};
    for (const q of ['A', 'B']) {
      let v = origem[q];
      if (item.tipo === 'lado_unico' && q === 'A') v = valorDefinido(origem.B) ? null : undefined;
      if (v === undefined) continue;
      if (!valorValido(v)) throw new Error(`valor inválido em ${item.id}.${q}: ${v}`);
      linha[q] = v;
    }
    if (Object.keys(linha).length > 0) saida[item.id] = linha;
  }
  return saida;
}

/** Itens pendentes agrupados por órgão, para dizer onde falta responder. */
export function pendenciasPorGrupo(ficha, obs) {
  return agruparPorOrgao(ficha)
    .map((g) => ({ orgao: g.orgao, rotulo: g.rotulo, pendentes: g.itens.filter((i) => !itemCompleto(i, obs?.[i.id])) }))
    .filter((g) => g.pendentes.length > 0);
}
