// Decide em que situação o usuário está e qual empresa usar, a partir dos seus registros de
// membro (empresas/{id}/membros/{uid}). Função pura, sem Firebase, para testar todos os casos.

export const PAPEIS_EMPRESA = ['admin', 'membro'];

/**
 * @param membros        [{ empresaId, papelEmpresa, ativo }]
 * @param ehPlataforma   true se existe plataforma_admins/{uid}
 * @param empresaSalva   última empresa escolhida neste aparelho (pode ser null)
 * @returns { status, empresaId, membro, ativos }
 *   status: 'ok' | 'escolher_empresa' | 'plataforma_apenas' | 'acesso_desativado' | 'sem_empresa'
 */
export function decidirEmpresa({ membros = [], ehPlataforma = false, empresaSalva = null } = {}) {
  const ativos = membros.filter((m) => m.ativo === true && PAPEIS_EMPRESA.includes(m.papelEmpresa));

  if (ativos.length === 0) {
    let status = 'sem_empresa';
    if (ehPlataforma) status = 'plataforma_apenas';
    else if (membros.length > 0) status = 'acesso_desativado';
    return { status, empresaId: null, membro: null, ativos };
  }

  if (ativos.length === 1) return { status: 'ok', empresaId: ativos[0].empresaId, membro: ativos[0], ativos };

  const escolhido = ativos.find((m) => m.empresaId === empresaSalva);
  if (escolhido) return { status: 'ok', empresaId: escolhido.empresaId, membro: escolhido, ativos };
  return { status: 'escolher_empresa', empresaId: null, membro: null, ativos };
}

export const ehAdminDaEmpresa = (membro) => membro?.ativo === true && membro.papelEmpresa === 'admin';
