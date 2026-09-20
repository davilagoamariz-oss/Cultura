// Formato da ficha de inspeção (dado versionado) e validador.
//
// Uma ficha descreve UMA cultura: itens a observar, regras com níveis de ação e TDs. É dado, não
// código: cultura nova = ficha nova. O vocabulário abaixo é FIXO e pequeno de propósito (não é um
// construtor genérico de formulários).
import { metricaExiste } from '../motor/metricas.js';

export const TIPOS_AMOSTRAGEM = ['plantas_quadrantes'];
export const TIPOS_ITEM = ['presenca_quadrante', 'lado_unico', 'contagem', 'escala'];
export const OPERADORES = ['>', '>='];
export const CHAVES_QUANDO = ['atributos', 'intensidade'];

const ehObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const ehPrimitivo = (v) => ['string', 'number', 'boolean'].includes(typeof v);

function validarQuando(quando, onde, erros) {
  if (!ehObjeto(quando)) return erros.push(`${onde}: "quando" precisa ser um objeto`);
  for (const chave of Object.keys(quando)) {
    if (!CHAVES_QUANDO.includes(chave)) erros.push(`${onde}: "quando.${chave}" não existe no vocabulário (${CHAVES_QUANDO.join(', ')})`);
  }
  if ('atributos' in quando) {
    const a = quando.atributos;
    if (!ehObjeto(a) || Object.keys(a).length === 0 || !Object.values(a).every(ehPrimitivo)) {
      erros.push(`${onde}: "quando.atributos" precisa ser um objeto não vazio de valores simples`);
    }
  }
  if ('intensidade' in quando) {
    const i = quando.intensidade;
    if (!ehObjeto(i) || !Number.isInteger(i.minima) || i.minima < 1 || i.minima > 3 || !Number.isInteger(i.plantas) || i.plantas < 1) {
      erros.push(`${onde}: "quando.intensidade" precisa de { minima: 1 a 3, plantas: inteiro >= 1 }`);
    }
  }
  return undefined;
}

/** Devolve a lista de problemas da ficha (vazia = válida). */
export function validarFicha(ficha) {
  const erros = [];
  if (!ehObjeto(ficha)) return ['ficha precisa ser um objeto'];

  for (const campo of ['fichaId', 'culturaId']) {
    if (typeof ficha[campo] !== 'string' || !ficha[campo]) erros.push(`campo "${campo}" obrigatório`);
  }
  if (!Number.isInteger(ficha.versao) || ficha.versao < 1) erros.push('"versao" precisa ser um inteiro >= 1');

  if (!ehObjeto(ficha.amostragem) || !TIPOS_AMOSTRAGEM.includes(ficha.amostragem.tipo)) {
    erros.push(`"amostragem.tipo" precisa ser um de: ${TIPOS_AMOSTRAGEM.join(', ')}`);
  } else if (!Number.isInteger(ficha.amostragem.plantas) || ficha.amostragem.plantas < 1) {
    erros.push('"amostragem.plantas" precisa ser um inteiro >= 1');
  }

  const tds = ehObjeto(ficha.tds) ? Object.keys(ficha.tds) : [];
  if (tds.length === 0) erros.push('"tds" obrigatório');
  if (ficha.tdsQuePulverizam !== undefined) {
    if (!Array.isArray(ficha.tdsQuePulverizam) || ficha.tdsQuePulverizam.some((t) => !tds.includes(t))) {
      erros.push('"tdsQuePulverizam" precisa listar TDs que existem em "tds"');
    }
  }

  const orgaos = Array.isArray(ficha.orgaos) ? ficha.orgaos : [];
  if (orgaos.length === 0) erros.push('"orgaos" obrigatório');

  // ---- itens
  const idsItens = new Set();
  if (!Array.isArray(ficha.itens) || ficha.itens.length === 0) erros.push('"itens" obrigatório');
  for (const item of Array.isArray(ficha.itens) ? ficha.itens : []) {
    const onde = `item ${item?.id ?? '?'}`;
    if (typeof item?.id !== 'string' || !item.id) { erros.push('item sem "id"'); continue; }
    if (idsItens.has(item.id)) erros.push(`${onde}: id repetido`);
    idsItens.add(item.id);
    if (!TIPOS_ITEM.includes(item.tipo)) erros.push(`${onde}: "tipo" precisa ser um de: ${TIPOS_ITEM.join(', ')}`);
    if (typeof item.alvoId !== 'string' || !item.alvoId) erros.push(`${onde}: "alvoId" obrigatório`);
    if (typeof item.nome !== 'string' || !item.nome) erros.push(`${onde}: "nome" obrigatório`);
    if (!orgaos.includes(item.orgao)) erros.push(`${onde}: "orgao" ${JSON.stringify(item.orgao)} não está em "orgaos"`);
  }

  // ---- regras
  const vistos = new Set();
  if (!Array.isArray(ficha.regras)) erros.push('"regras" obrigatório');
  for (const regra of Array.isArray(ficha.regras) ? ficha.regras : []) {
    const onde = `regra ${regra?.itemId ?? '?'}`;
    if (!idsItens.has(regra?.itemId)) { erros.push(`${onde}: itemId não existe em "itens"`); continue; }
    if (vistos.has(regra.itemId)) erros.push(`${onde}: mais de uma regra para o mesmo item`);
    vistos.add(regra.itemId);

    if (regra.aplicaSe !== undefined) {
      const a = regra.aplicaSe;
      if (!ehObjeto(a) || !ehObjeto(a.atributos) || Object.keys(a.atributos).length === 0) {
        erros.push(`${onde}: "aplicaSe" precisa ser { atributos: {...} }`);
      }
    }

    const niveis = Array.isArray(regra.niveis) ? regra.niveis : [];
    if (!regra.informativo && niveis.length === 0) erros.push(`${onde}: precisa de ao menos um nível (ou ser informativa)`);
    if (regra.informativo && niveis.length > 0) erros.push(`${onde}: regra informativa não tem níveis`);

    const idsNiveis = new Set();
    for (const nivel of niveis) {
      const nOnde = `${onde}, nível ${nivel?.id ?? '?'}`;
      if (typeof nivel?.id !== 'string' || !nivel.id) { erros.push(`${onde}: nível sem "id"`); continue; }
      if (idsNiveis.has(nivel.id)) erros.push(`${nOnde}: id repetido`);
      idsNiveis.add(nivel.id);
      if (!metricaExiste(nivel.metrica)) erros.push(`${nOnde}: métrica ${JSON.stringify(nivel.metrica)} não está registrada`);
      if (!OPERADORES.includes(nivel.operador)) erros.push(`${nOnde}: operador precisa ser um de: ${OPERADORES.join(' ')}`);
      if (nivel.limite !== null) {
        if (typeof nivel.limite !== 'number' || !Number.isFinite(nivel.limite) || nivel.limite < 0) {
          erros.push(`${nOnde}: "limite" precisa ser null (não definido) ou um número >= 0`);
        } else if (nivel.metrica === 'percent_plantas' && nivel.limite > 1) {
          erros.push(`${nOnde}: limite de porcentagem precisa estar entre 0 e 1`);
        }
      }
      if (!tds.includes(nivel.td)) erros.push(`${nOnde}: td ${JSON.stringify(nivel.td)} não existe em "tds"`);
      if (typeof nivel.gravidade !== 'number' || !Number.isFinite(nivel.gravidade)) erros.push(`${nOnde}: "gravidade" numérica obrigatória`);
      if (nivel.quando !== undefined) validarQuando(nivel.quando, nOnde, erros);
    }
  }

  return erros;
}
