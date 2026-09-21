// Único lugar que sabe onde os dados moram. Tudo o que é de uma empresa fica dentro de
// empresas/{empresaId}/..., e cada função devolve os segmentos do caminho para doc()/collection().
//
// Segurança: todo identificador é validado. Um id com "/" escaparia da empresa (path traversal
// dentro do banco), então é recusado aqui, antes de chegar ao Firestore. As firestore.rules
// continuam sendo a defesa de verdade; isto evita o erro do lado do app.
//
// Ids compostos (vínculo = {uid}_{setorId}; avaliação = {talhaoId}_{semanaISO}_{uid}) só são
// inequívocos se as partes escolhidas pela empresa não puderem conter "_". Por isso setorId e
// talhaoId aceitam apenas letras, números e hífen.

function id(valor, nome) {
  if (typeof valor !== 'string' || valor.length === 0 || valor.length > 200 || valor.includes('/')) {
    throw new Error(`${nome} inválido`);
  }
  if (valor === '.' || valor === '..' || valor.startsWith('__')) throw new Error(`${nome} inválido`);
  return valor;
}

/** Identificador sem "_" (usado nas partes de ids compostos que a empresa escolhe). */
function idSemSublinhado(valor, nome) {
  id(valor, nome);
  if (!/^[A-Za-z0-9-]{1,60}$/.test(valor)) throw new Error(`${nome} inválido (use letras, números e hífen)`);
  return valor;
}

const dentro = (empresaId, ...resto) => ['empresas', id(empresaId, 'empresaId'), ...resto];

export const caminhos = {
  // fora das empresas
  usuario: (uid) => ['users', id(uid, 'uid')],
  adminPlataforma: (uid) => ['plataforma_admins', id(uid, 'uid')],
  catalogoCulturas: () => ['catalogo_culturas'],
  catalogoCultura: (culturaId) => ['catalogo_culturas', id(culturaId, 'culturaId')],
  catalogoAlvos: () => ['catalogo_alvos'],
  catalogoAlvo: (alvoId) => ['catalogo_alvos', id(alvoId, 'alvoId')],
  catalogoFicha: (fichaId, versao) => ['catalogo_fichas', id(fichaId, 'fichaId'), 'versoes', id(String(versao), 'versao')],

  // empresa e tudo o que é dela
  empresa: (e) => dentro(e),
  membros: (e) => dentro(e, 'membros'),
  membro: (e, uid) => dentro(e, 'membros', id(uid, 'uid')),
  unidades: (e) => dentro(e, 'unidades'),
  unidade: (e, unidadeId) => dentro(e, 'unidades', id(unidadeId, 'unidadeId')),
  setores: (e) => dentro(e, 'setores'),
  setor: (e, setorId) => dentro(e, 'setores', idSemSublinhado(setorId, 'setorId')),
  vinculos: (e) => dentro(e, 'vinculos'),
  vinculo: (e, pessoaUid, setorId) => dentro(e, 'vinculos', idVinculo(pessoaUid, setorId)),
  historicoVinculo: (e, pessoaUid, setorId, versao) => {
    if (!Number.isInteger(versao) || versao < 1) throw new Error('versao inválida');
    return dentro(e, 'vinculos', idVinculo(pessoaUid, setorId), 'historico', String(versao));
  },
  historico: (e, pessoaUid, setorId) => dentro(e, 'vinculos', idVinculo(pessoaUid, setorId), 'historico'),
  safras: (e) => dentro(e, 'safras'),
  safra: (e, safraId) => dentro(e, 'safras', id(safraId, 'safraId')),
  talhoes: (e) => dentro(e, 'talhoes'),
  talhao: (e, talhaoId) => dentro(e, 'talhoes', idSemSublinhado(talhaoId, 'talhaoId')),
  ajustes: (e) => dentro(e, 'ajustes'),
  ajuste: (e, ajusteId) => dentro(e, 'ajustes', id(ajusteId, 'ajusteId')),
  avaliacoes: (e) => dentro(e, 'avaliacoes'),
  avaliacao: (e, aid) => dentro(e, 'avaliacoes', id(aid, 'avaliacaoId')),
  plantas: (e, aid) => dentro(e, 'avaliacoes', id(aid, 'avaliacaoId'), 'plantas'),
  planta: (e, aid, n) => {
    if (!Number.isInteger(n) || n < 1 || n > 30) throw new Error('planta inválida (1 a 30)');
    return dentro(e, 'avaliacoes', id(aid, 'avaliacaoId'), 'plantas', String(n));
  },
  decisoes: (e) => dentro(e, 'decisoes'),
  decisao: (e, avaliacaoId) => dentro(e, 'decisoes', id(avaliacaoId, 'avaliacaoId')),
  eventos: (e) => dentro(e, 'eventos'),
};

/** Grupos de coleções usados para descobrir as empresas e os setores de um usuário. */
export const GRUPO_MEMBROS = 'membros';
export const GRUPO_VINCULOS = 'vinculos';

/** Id do vínculo: {pessoaUid}_{setorId}. As regras exigem exatamente este formato. */
export function idVinculo(pessoaUid, setorId) {
  return `${id(pessoaUid, 'pessoaUid')}_${idSemSublinhado(setorId, 'setorId')}`;
}

/** Id da avaliação: uma por pragueiro, talhão e semana. As regras exigem exatamente este formato. */
export function idAvaliacao(talhaoId, semanaISO, uid) {
  if (typeof semanaISO !== 'string' || !/^[0-9]{4}-W[0-9]{2}$/.test(semanaISO)) throw new Error('semanaISO inválida');
  return `${idSemSublinhado(talhaoId, 'talhaoId')}_${semanaISO}_${id(uid, 'uid')}`;
}
