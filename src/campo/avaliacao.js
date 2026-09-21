// Monta os documentos de uma avaliação exatamente como as firestore.rules exigem, e calcula o
// progresso. Funções puras: quem grava (o repositório) só injeta o carimbo de hora do servidor.
import { idAvaliacao } from '../nucleo/caminhos.js';
import { obsParaGravar, statusDaPlanta, pendenciasPorGrupo } from './ficha-campo.js';

export const MAX_FASES = 20;
export const MAX_NOTAS_PLANTA = 1000;
export const MAX_NOTAS_AVALIACAO = 2000;
export const MAX_FOTOS_PLANTA = 20;

export const totalDePlantas = (ficha) => ficha.amostragem.plantas;

/** Fases da cultura como lista simples: [{ id, nome, grupo }]. */
export function opcoesDeFase(ficha) {
  return ficha.fases.flatMap((g) => g.itens.map((f) => ({ id: f.id, nome: f.nome, grupo: g.grupo })));
}

/**
 * Cabeçalho da avaliação. Precisa bater com o que as regras conferem: id talhão_semana_uid,
 * ficha vigente da cultura do talhão, atributos do talhão copiados sem alteração, unidade do setor.
 * @returns { id, dados }
 */
export function montarCabecalho({ ficha, talhaoId, talhao, setorId, unidadeId, uid, data, semana, faseCultura = [], criadoEm }) {
  if (!talhao || talhao.ativo !== true) throw new Error('talhão inativo ou inexistente');
  if (talhao.unidadeId !== unidadeId) throw new Error('o talhão não é da unidade do setor');
  if (talhao.culturaId !== ficha.culturaId) throw new Error('a ficha não é da cultura do talhão');
  const validas = new Set(opcoesDeFase(ficha).map((f) => f.id));
  const fases = [...new Set(faseCultura)];
  if (fases.some((f) => !validas.has(f))) throw new Error('fase da cultura desconhecida');
  if (fases.length > MAX_FASES) throw new Error('fases demais');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) throw new Error('data inválida');

  return {
    id: idAvaliacao(talhaoId, semana, uid),
    dados: {
      talhaoId,
      unidadeId,
      setorId,
      fichaId: ficha.fichaId,
      fichaVersao: ficha.versao,
      atributosTalhao: talhao.atributos,
      responsavelUid: uid,
      data,
      semanaISO: semana,
      status: 'rascunho',
      faseCultura: fases,
      criadoEm,
    },
  };
}

const limpar = (texto, maximo, nome) => {
  const t = (texto ?? '').trim();
  if (t.length > maximo) throw new Error(`${nome}: no máximo ${maximo} caracteres`);
  return t;
};

/** Documento de uma planta (1 a N). Só grava o que foi respondido; notas e fotos só se houver. */
export function dadosDaPlanta({ ficha, n, obs, notas, fotos = [], atualizadoEm }) {
  if (!Number.isInteger(n) || n < 1 || n > totalDePlantas(ficha)) throw new Error(`planta ${n} fora de 1 a ${totalDePlantas(ficha)}`);
  if (fotos.length > MAX_FOTOS_PLANTA) throw new Error(`no máximo ${MAX_FOTOS_PLANTA} fotos por planta`);
  const texto = limpar(notas, MAX_NOTAS_PLANTA, 'notas da planta');
  return {
    n,
    obs: obsParaGravar(ficha, obs),
    ...(texto ? { notas: texto } : {}),
    ...(fotos.length > 0 ? { fotos } : {}),
    atualizadoEm,
  };
}

/** Situação de cada planta e o total. `plantas` = { [n]: obs }. */
export function progresso(ficha, plantas = {}) {
  const total = totalDePlantas(ficha);
  const porPlanta = {};
  let completas = 0;
  let parciais = 0;
  for (let n = 1; n <= total; n += 1) {
    const s = plantas[n] ? statusDaPlanta(ficha, plantas[n]) : 'vazia';
    porPlanta[n] = s;
    if (s === 'completa') completas += 1;
    else if (s === 'parcial') parciais += 1;
  }
  return { total, completas, parciais, vazias: total - completas - parciais, porPlanta, podeFinalizar: completas === total };
}

/** Plantas que ainda não estão completas, com quantos itens faltam (para orientar o pragueiro). */
export function plantasIncompletas(ficha, plantas = {}) {
  const total = totalDePlantas(ficha);
  const lista = [];
  for (let n = 1; n <= total; n += 1) {
    const obs = plantas[n] ?? {};
    if (statusDaPlanta(ficha, obs) === 'completa') continue;
    const faltam = pendenciasPorGrupo(ficha, obs).reduce((soma, g) => soma + g.pendentes.length, 0);
    lista.push({ n, status: plantas[n] ? statusDaPlanta(ficha, obs) : 'vazia', faltam });
  }
  return lista;
}

/** Próxima planta a preencher, a partir de `n` (dando a volta); null se todas estão completas. */
export function proximaIncompleta(ficha, plantas, n = 0) {
  const total = totalDePlantas(ficha);
  for (let passo = 1; passo <= total; passo += 1) {
    const cand = ((n - 1 + passo) % total) + 1;
    if (statusDaPlanta(ficha, plantas[cand] ?? {}) !== 'completa') return cand;
  }
  return null;
}

/**
 * Campos que fecham a avaliação. O armadilha é só informativo por enquanto (a regra do bicho-furão
 * ainda não foi confirmada): guarda os adultos contados, sem entrar no cálculo.
 */
export function dadosParaFinalizar({ notas, outrasPragas, adultosArmadilha, finalizadaEm }) {
  const dados = { status: 'finalizada', finalizadaEm };
  const n = limpar(notas, MAX_NOTAS_AVALIACAO, 'notas');
  const o = limpar(outrasPragas, MAX_NOTAS_AVALIACAO, 'outras pragas');
  if (n) dados.notas = n;
  if (o) dados.outrasPragas = o;
  if (adultosArmadilha !== undefined && adultosArmadilha !== null && adultosArmadilha !== '') {
    const adultos = Number(adultosArmadilha);
    if (!Number.isInteger(adultos) || adultos < 0 || adultos > 1000) throw new Error('adultos na armadilha: número inteiro de 0 a 1000');
    dados.armadilha = { adultos };
  }
  return dados;
}

/** O que dizer ao pragueiro ao abrir um talhão nesta semana, conforme o que já existe. */
export function avisoDeAvaliacaoExistente(existente) {
  if (!existente) return { tipo: 'nenhuma' };
  if (existente.status === 'rascunho') {
    return { tipo: 'continuar', texto: 'Você já tem uma avaliação deste talhão em andamento nesta semana. Continue de onde parou.' };
  }
  return {
    tipo: 'finalizada',
    texto: 'Este talhão já foi avaliado e finalizado por você nesta semana. Uma avaliação finalizada não pode ser refeita.',
  };
}
