// Gestão de vínculos por setor: quem pode alterar quem, montar cada alteração (com o registro de histórico
// que as regras exigem no MESMO lote) e contar a história de um vínculo. Funções puras.
//
// A interface usa isto só para mostrar ou esconder botões: as firestore.rules aplicam as mesmas ideias e
// são a defesa de verdade.
import { MODULOS, NOMES_PAPEL_VINCULO } from '../modulos/registro.js';

export const FUNCOES = Object.keys(MODULOS.fitossanidade.funcoes); // pragueiro, agronomo
export const PAPEIS = ['gerente', 'funcionario'];
export const NOMES_FUNCAO = MODULOS.fitossanidade.funcoes;

export const idDoVinculo = (pessoaUid, setorId) => `${pessoaUid}_${setorId}`;

/**
 * Pode esta pessoa alterar este vínculo? Espelha as regras:
 *  - o admin da empresa altera qualquer vínculo (e só ele promove a gerente);
 *  - o gerente do setor altera só FUNCIONÁRIO do próprio setor, nunca a si mesmo e nunca o papel.
 * @param ator  { uid, ehAdminEmpresa, ehGerenteDoSetor }
 * @param alvo  vínculo { pessoaUid, papel }
 * @returns { pode, podeMudarPapel, motivo }
 */
export function quemPodeAlterar({ ator, alvo }) {
  if (ator.ehAdminEmpresa) return { pode: true, podeMudarPapel: true, motivo: null };
  if (!ator.ehGerenteDoSetor) return { pode: false, podeMudarPapel: false, motivo: 'Só o gerente do setor ou o administrador alteram vínculos.' };
  if (alvo.pessoaUid === ator.uid) return { pode: false, podeMudarPapel: false, motivo: 'Você não altera o próprio vínculo.' };
  if (alvo.papel === 'gerente') return { pode: false, podeMudarPapel: false, motivo: 'Só o administrador altera um gerente.' };
  return { pode: true, podeMudarPapel: false, motivo: null };
}

const mesmoConjunto = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

function validarFuncoes(funcoes) {
  if (!Array.isArray(funcoes)) throw new Error('funções inválidas');
  const lista = [...new Set(funcoes)];
  if (lista.length > 4) throw new Error('funções demais');
  if (lista.some((f) => !FUNCOES.includes(f))) throw new Error('função desconhecida');
  return lista;
}

/**
 * Alteração de um vínculo existente: o que vai no documento e o registro de histórico da nova versão.
 * Os dois vão no MESMO lote (as regras exigem o histórico com a versão nova).
 * @param mudancas  { ativo?, funcoes?, papel? }
 */
export function montarAlteracao({ atual, mudancas, quem, alteradoEm }) {
  const permitidas = ['ativo', 'funcoes', 'papel'];
  const chaves = Object.keys(mudancas);
  if (chaves.length === 0 || chaves.some((c) => !permitidas.includes(c))) throw new Error('alteração inválida');
  if (!Number.isInteger(atual.versao) || atual.versao < 1) throw new Error('vínculo sem versão');

  const novo = { ativo: atual.ativo, funcoes: atual.funcoes, papel: atual.papel };
  if ('ativo' in mudancas) {
    if (typeof mudancas.ativo !== 'boolean') throw new Error('ativo precisa ser verdadeiro ou falso');
    novo.ativo = mudancas.ativo;
  }
  if ('funcoes' in mudancas) novo.funcoes = validarFuncoes(mudancas.funcoes);
  if ('papel' in mudancas) {
    if (!PAPEIS.includes(mudancas.papel)) throw new Error('papel desconhecido');
    novo.papel = mudancas.papel;
  }
  if (novo.ativo === atual.ativo && novo.papel === atual.papel && mesmoConjunto(novo.funcoes, atual.funcoes)) throw new Error('nada mudou');

  const versao = atual.versao + 1;
  return {
    id: idDoVinculo(atual.pessoaUid, atual.setorId),
    versao,
    vinculo: { ...novo, versao, alteradoPor: quem, alteradoEm },
    historico: { versao, pessoaUid: atual.pessoaUid, setorId: atual.setorId, ...novo, alteradoPor: quem, alteradoEm },
  };
}

/** Vínculo novo (versão 1) e o seu histórico. A pessoa precisa ser membro ativo da empresa. */
export function montarNovoVinculo({ pessoaUid, setorId, unidadeId, papel, funcoes, quem, alteradoEm }) {
  if (!pessoaUid || !setorId || !unidadeId) throw new Error('pessoa, setor e unidade são obrigatórios');
  if (!PAPEIS.includes(papel)) throw new Error('papel desconhecido');
  const lista = validarFuncoes(funcoes);
  const corpo = { pessoaUid, setorId, unidadeId, papel, funcoes: lista, ativo: true, versao: 1, alteradoPor: quem, alteradoEm };
  return {
    id: idDoVinculo(pessoaUid, setorId),
    versao: 1,
    vinculo: corpo,
    historico: { versao: 1, pessoaUid, setorId, papel, funcoes: lista, ativo: true, alteradoPor: quem, alteradoEm },
  };
}

// ---------------------------------------------------------------- texto e história

const nomesFuncoes = (funcoes) => (funcoes.length === 0 ? 'nenhuma' : funcoes.map((f) => NOMES_FUNCAO[f] ?? f).join(', '));

/** Frases curtas sobre o que mudou de um registro para o seguinte. */
export function descreverMudanca(anterior, atual) {
  if (!anterior) {
    return [`Vínculo criado como ${NOMES_PAPEL_VINCULO[atual.papel] ?? atual.papel} (funções: ${nomesFuncoes(atual.funcoes)})`];
  }
  const frases = [];
  if (anterior.ativo !== atual.ativo) frases.push(atual.ativo ? 'Reativado' : 'Desativado');
  if (anterior.papel !== atual.papel) {
    frases.push(atual.papel === 'gerente' ? 'Promovido a gerente' : 'Passou a funcionário');
  }
  if (!mesmoConjunto(anterior.funcoes ?? [], atual.funcoes ?? [])) {
    frases.push(`Funções: ${nomesFuncoes(anterior.funcoes ?? [])} → ${nomesFuncoes(atual.funcoes ?? [])}`);
  }
  return frases.length > 0 ? frases : ['Sem mudança de dados'];
}

/**
 * Linha do tempo (da mais recente para a mais antiga). `registros` = documentos de historico em qualquer ordem.
 * @returns [{ versao, quem, quando, mudancas: [frases] }]
 */
export function linhasDoHistorico(registros) {
  const ordenados = [...registros].sort((a, b) => a.versao - b.versao);
  return ordenados
    .map((r, i) => ({ versao: r.versao, quem: r.alteradoPor, quando: r.alteradoEm, mudancas: descreverMudanca(ordenados[i - 1] ?? null, r) }))
    .reverse();
}

/** Nome para mostrar: o conhecido, ou um trecho do código (as regras só deixam ler o nome de alguns). */
export function nomeParaMostrar(uid, nomes = {}) {
  return nomes[uid] ?? `pessoa ${String(uid).slice(0, 6)}…`;
}

/**
 * Quem pode ser ligado a este setor: membros ativos que ainda NÃO têm vínculo (nem desativado) nele.
 * Quem já tem um vínculo desativado deve ser reativado, não criado de novo (o documento já existe).
 */
export function candidatosParaVincular(membros, vinculosDoSetor) {
  const comVinculo = new Set(vinculosDoSetor.map((v) => v.pessoaUid));
  return membros.filter((m) => m.ativo === true && !comVinculo.has(m.uid));
}
