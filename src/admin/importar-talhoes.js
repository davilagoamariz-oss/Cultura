// Importação de talhões em lote, a partir de uma planilha exportada como CSV. Funções puras: leem o
// texto e CONFEREM cada linha com o mesmo validador do cadastro (cadastros.js), sem gravar nada — quem
// grava é o repositório, só com as linhas que passaram.
//
// Cabeçalho esperado (a ordem não importa): nome, variedade, areaha, e uma coluna por atributo da
// ficha da cultura escolhida (pelo nome da chave, ex.: "tipoPomar", "citrosVizinhos"). Aceita "," ou
// ";" como separador (Excel em pt-BR exporta com ";", porque "," já é a vírgula decimal da área).
import { atributosDaFicha, montarTalhao } from './cadastros.js';
import { gerarId } from './slug.js';

/** Uma linha de CSV (com aspas) vira uma lista de campos, sem aspas e sem espaço nas pontas. */
function partirLinha(linha, delim) {
  const campos = [];
  let atual = '';
  let entreAspas = false;
  for (let i = 0; i < linha.length; i += 1) {
    const c = linha[i];
    if (entreAspas) {
      if (c === '"') {
        if (linha[i + 1] === '"') {
          atual += '"';
          i += 1;
        } else entreAspas = false;
      } else atual += c;
    } else if (c === '"') entreAspas = true;
    else if (c === delim) {
      campos.push(atual.trim());
      atual = '';
    } else atual += c;
  }
  campos.push(atual.trim());
  return campos;
}

/** Texto do arquivo -> matriz de linhas (a primeira é o cabeçalho). Linhas em branco são ignoradas. */
export function lerCsv(texto) {
  const linhas = String(texto ?? '')
    .replace(/^﻿/, '') // BOM do Excel
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((l) => l.trim() !== '');
  if (linhas.length === 0) return [];
  const delim = linhas[0].includes(';') ? ';' : ',';
  return linhas.map((l) => partirLinha(l, delim));
}

/**
 * Confere cada linha do CSV contra a ficha da cultura escolhida, com o MESMO validador do cadastro
 * manual. Não grava nada. O id de cada linha válida já sai sem colidir com o que existe nem com as
 * outras linhas do próprio arquivo.
 * @returns [{ numero (da linha na planilha, 2 = primeira depois do cabeçalho), nome, id?, dados?, erro? }]
 */
export function prepararImportacaoDeTalhoes({ ficha, unidadeId, culturaId, texto, existentes = [] }) {
  const linhas = lerCsv(texto);
  if (linhas.length === 0) return [];
  const [cabecalho, ...resto] = linhas;
  const indice = Object.fromEntries(cabecalho.map((c, i) => [c.toLowerCase(), i]));
  const pega = (campos, coluna) => (indice[coluna] !== undefined ? campos[indice[coluna]] : undefined);
  const idsUsados = [...existentes];

  return resto.map((campos, i) => {
    const numero = i + 2;
    const nome = pega(campos, 'nome') ?? '';
    const atributos = {};
    for (const a of atributosDaFicha(ficha)) {
      const bruto = pega(campos, a.chave.toLowerCase());
      atributos[a.chave] = a.tipo === 'booleano' ? /^(sim|true|1|verdadeiro)$/i.test(bruto ?? '') : bruto;
    }
    try {
      const dados = montarTalhao({ ficha, unidadeId, culturaId, nome, variedade: pega(campos, 'variedade'), areaHa: pega(campos, 'areaha'), atributos });
      const id = gerarId(nome, idsUsados);
      idsUsados.push(id);
      return { numero, nome, id, dados };
    } catch (e) {
      return { numero, nome, erro: e.message };
    }
  });
}

export const validos = (linhas) => linhas.filter((l) => !l.erro);
export const invalidos = (linhas) => linhas.filter((l) => l.erro);
