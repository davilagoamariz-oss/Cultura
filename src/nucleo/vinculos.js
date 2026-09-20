// Decide, a partir dos vínculos do usuário, em que situação ele está e qual empresa usar.
// Função pura (sem Firebase), para testar todos os casos.
import { papelValido } from './papeis.js';

/**
 * @param vinculos   [{ empresaId, papel, fazendaIds, ativo }] lidos de empresas/{id}/membros
 * @param ehPlataforma  true se existe plataforma_admins/{uid}
 * @param empresaSalva  última empresa escolhida neste aparelho (pode ser null)
 * @returns { status, empresaId, vinculo, ativos }
 *   status: 'ok' | 'escolher_empresa' | 'plataforma_apenas' | 'vinculo_inativo' | 'sem_vinculo'
 */
export function decidirSessao({ vinculos = [], ehPlataforma = false, empresaSalva = null } = {}) {
  const ativos = vinculos.filter((v) => v.ativo === true && papelValido(v.papel));

  if (ativos.length === 0) {
    let status = 'sem_vinculo';
    if (ehPlataforma) status = 'plataforma_apenas';
    else if (vinculos.length > 0) status = 'vinculo_inativo';
    return { status, empresaId: null, vinculo: null, ativos };
  }

  if (ativos.length === 1) {
    return { status: 'ok', empresaId: ativos[0].empresaId, vinculo: ativos[0], ativos };
  }

  const escolhido = ativos.find((v) => v.empresaId === empresaSalva);
  if (escolhido) return { status: 'ok', empresaId: escolhido.empresaId, vinculo: escolhido, ativos };
  return { status: 'escolher_empresa', empresaId: null, vinculo: null, ativos };
}

/** O escopo do vínculo cobre esta fazenda? ('*' = todas as fazendas da empresa). */
export function veFazenda(vinculo, fazendaId) {
  if (!vinculo || !Array.isArray(vinculo.fazendaIds)) return false;
  return vinculo.fazendaIds.includes('*') || vinculo.fazendaIds.includes(fazendaId);
}

/**
 * Como consultar coleções por fazenda respeitando as regras do banco.
 * - Vínculo com '*': consulta sem filtro de fazenda.
 * - Vínculo com fazendas específicas: a consulta PRECISA declarar as fazendas (talhões:
 *   where('fazendaId','in',bloco); fazendas: where(documentId(),'in',bloco)). Listar sem filtro é negado.
 * O operador "in" aceita até 30 valores, então a lista é dividida em blocos.
 * @returns { todas: boolean, blocos: string[][] }
 */
export function escopoConsulta(vinculo, tamanhoBloco = 30) {
  if (!vinculo || !Array.isArray(vinculo.fazendaIds)) return { todas: false, blocos: [] };
  if (vinculo.fazendaIds.includes('*')) return { todas: true, blocos: [] };
  const ids = [...new Set(vinculo.fazendaIds)];
  const blocos = [];
  for (let i = 0; i < ids.length; i += tamanhoBloco) blocos.push(ids.slice(i, i + tamanhoBloco));
  return { todas: false, blocos };
}
