import { useParams } from 'react-router-dom';
import { progresso as calcularProgresso, proximaIncompleta } from '../avaliacao.js';
import { useRegistrarPendentes } from '../../offline/PendentesProvider.jsx';
import Carregando from '../../Carregando.jsx';
import { useContextoCampo } from './contexto.js';
import { useDadosDaAvaliacao } from './dados-avaliacao.js';
import { GradePlantas, Faixa } from './apresentacao.jsx';
import { SemSetor } from './Campo.jsx';

/** Visão geral de uma avaliação: as 30 plantas e o que falta. */
export default function Avaliacao() {
  const { aid } = useParams();
  const { db, empresaId, setor, pode } = useContextoCampo();
  const { avaliacao, ficha, porN, pendentes, pronto, erro } = useDadosDaAvaliacao(db, empresaId, aid);
  useRegistrarPendentes('plantas', pendentes);

  if (!setor) return <SemSetor />;
  if (!pode) return <Faixa tipo="aviso">Você não tem a função de pragueiro neste setor.</Faixa>;
  if (erro) return <Faixa tipo="erro">Não foi possível abrir a avaliação ({erro}).</Faixa>;
  if (avaliacao === null) return <Faixa tipo="erro">Avaliação não encontrada.</Faixa>;
  if (!pronto) return <Carregando texto="Abrindo a avaliação…" />;

  const progresso = calcularProgresso(ficha, porN);
  return (
    <GradePlantas
      aid={aid}
      titulo={avaliacao.talhaoId}
      semana={avaliacao.semanaISO}
      progresso={progresso}
      pendentes={pendentes}
      finalizada={avaliacao.status === 'finalizada'}
      proxima={proximaIncompleta(ficha, porN, 0)}
    />
  );
}
