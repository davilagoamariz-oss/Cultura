// Monta o menu do usuário: a SOMA dos módulos dos setores onde ele tem vínculo ativo.
// Um motorista vinculado só ao setor Frota não vê Fitossanidade. Função pura, testável.
import { MODULOS, moduloConhecido } from '../modulos/registro.js';

/**
 * @param vinculos  vínculos da pessoa na empresa: [{ setorId, unidadeId, papel, funcoes, ativo }]
 * @param setores   { [setorId]: { nome, unidadeId, modulos, ativo } }
 * @param unidades  { [unidadeId]: { nome } }  (só para mostrar o nome)
 * @returns [{ modulo, setores: [{ setorId, nome, unidadeId, unidadeNome, papel, funcoes }] }]
 *          na ordem do registro de módulos; só módulos conhecidos, setores ativos e vínculos ativos
 */
export function montarMenu({ vinculos = [], setores = {}, unidades = {} }) {
  const porModulo = new Map();

  for (const v of vinculos) {
    if (v.ativo !== true) continue;
    const setor = setores[v.setorId];
    if (!setor || setor.ativo !== true || !Array.isArray(setor.modulos)) continue;

    for (const moduloId of setor.modulos) {
      if (!moduloConhecido(moduloId)) continue;
      if (!porModulo.has(moduloId)) porModulo.set(moduloId, []);
      porModulo.get(moduloId).push({
        setorId: v.setorId,
        nome: setor.nome,
        unidadeId: v.unidadeId,
        unidadeNome: unidades[v.unidadeId]?.nome ?? null,
        papel: v.papel,
        funcoes: Array.isArray(v.funcoes) ? v.funcoes : [],
      });
    }
  }

  return Object.keys(MODULOS)
    .filter((id) => porModulo.has(id))
    .map((id) => ({
      modulo: MODULOS[id],
      setores: porModulo.get(id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    }));
}

/** Escolhe o setor ativo de um módulo: o salvo, se ainda valer; ou o único; senão null (pede escolha). */
export function escolherSetorDoModulo(entradaDoMenu, setorSalvo = null) {
  if (!entradaDoMenu) return null;
  const { setores } = entradaDoMenu;
  const salvo = setores.find((s) => s.setorId === setorSalvo);
  if (salvo) return salvo;
  return setores.length === 1 ? setores[0] : null;
}
