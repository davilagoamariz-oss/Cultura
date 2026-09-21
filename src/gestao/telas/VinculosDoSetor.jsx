import { SemSetor } from '../../campo/telas/Campo.jsx';
import { Faixa } from '../../campo/telas/apresentacao.jsx';
import { useContextoGestao } from './contexto.js';
import GestaoDeVinculos from './GestaoDeVinculos.jsx';

/** Vínculos do setor em uso, para o gerente. */
export default function VinculosDoSetor() {
  const { setor, ehGerente } = useContextoGestao();
  if (!setor) return <SemSetor />;
  if (!ehGerente) return <Faixa tipo="aviso">Só o gerente do setor gerencia os vínculos dele.</Faixa>;
  return <GestaoDeVinculos setor={setor} />;
}
