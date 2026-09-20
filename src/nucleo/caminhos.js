// Único lugar que sabe onde os dados moram. Tudo o que é de uma empresa fica dentro de
// empresas/{empresaId}/..., e cada função devolve os segmentos do caminho para doc()/collection().
//
// Segurança: todo identificador é validado. Um id com "/" escaparia da empresa (path traversal
// dentro do banco), então é recusado aqui, antes de chegar ao Firestore. As firestore.rules
// continuam sendo a defesa de verdade; isto evita o erro do lado do app.

function id(valor, nome) {
  if (typeof valor !== 'string' || valor.length === 0 || valor.length > 200 || valor.includes('/')) {
    throw new Error(`${nome} inválido`);
  }
  if (valor === '.' || valor === '..' || valor.startsWith('__')) throw new Error(`${nome} inválido`);
  return valor;
}

const dentro = (empresaId, ...resto) => ['empresas', id(empresaId, 'empresaId'), ...resto];

export const caminhos = {
  // fora das empresas
  usuario: (uid) => ['users', id(uid, 'uid')],
  adminPlataforma: (uid) => ['plataforma_admins', id(uid, 'uid')],
  protocolo: (protocoloId, versao) => ['protocolos', id(protocoloId, 'protocoloId'), 'versoes', id(String(versao), 'versao')],

  // empresa e tudo o que é dela
  empresa: (e) => dentro(e),
  membros: (e) => dentro(e, 'membros'),
  membro: (e, uid) => dentro(e, 'membros', id(uid, 'uid')),
  convites: (e) => dentro(e, 'convites'),
  convite: (e, codigo) => dentro(e, 'convites', id(codigo, 'codigo')),
  fazendas: (e) => dentro(e, 'fazendas'),
  fazenda: (e, fid) => dentro(e, 'fazendas', id(fid, 'fazendaId')),
  talhoes: (e) => dentro(e, 'talhoes'),
  talhao: (e, tid) => dentro(e, 'talhoes', id(tid, 'talhaoId')),
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

/** Nome do grupo de coleções usado para descobrir as empresas de um usuário. */
export const GRUPO_MEMBROS = 'membros';

/** Id da avaliação: uma por pragueiro, talhão e semana (as regras exigem exatamente este formato). */
export function idAvaliacao(talhaoId, semanaISO, uid) {
  return `${id(talhaoId, 'talhaoId')}_${semanaISO}_${id(uid, 'uid')}`;
}
