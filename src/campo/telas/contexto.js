import { useSessao } from '../../nucleo/Sessao.jsx';
import { podeAvaliar } from '../../nucleo/permissoes.js';
import { db } from '../../nucleo/firebase.js';

const MODULO = 'fitossanidade';

/** O que as telas de campo precisam saber da sessão: empresa, setor em uso e se pode avaliar. */
export function useContextoCampo() {
  const s = useSessao();
  const setor = s.setorDoModulo(MODULO);
  const vinculo = setor ? s.vinculoDoSetor(setor.setorId) : null;
  return { db, empresaId: s.empresaId, uid: s.user?.uid ?? null, setor, vinculo, pode: podeAvaliar(vinculo), unidades: s.unidades };
}

export const rotaCampo = (...partes) => ['/fitossanidade/campo', ...partes].join('/');
