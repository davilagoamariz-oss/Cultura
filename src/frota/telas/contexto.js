import { useSessao } from '../../nucleo/Sessao.jsx';
import { ehOperadorDeFrota } from '../../nucleo/permissoes.js';
import { db } from '../../nucleo/firebase.js';

const MODULO = 'frota';

/** O que as telas da Frota precisam da sessão: empresa, setor em uso e se a pessoa opera máquinas nele. */
export function useContextoFrota() {
  const s = useSessao();
  const setor = s.setorDoModulo(MODULO);
  const vinculo = setor ? s.vinculoDoSetor(setor.setorId) : null;
  return {
    db,
    empresaId: s.empresaId,
    uid: s.user?.uid ?? null,
    setor,
    ehOperador: ehOperadorDeFrota(vinculo),
  };
}
