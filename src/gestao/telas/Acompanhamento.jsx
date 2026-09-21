import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { onSnapshot } from 'firebase/firestore';
import { consultaTalhoes, comId } from '../../campo/repositorio.js';
import { semanaISO, semanaAnterior, semanaSeguinte, rotuloDaSemana } from '../../campo/semana.js';
import { useRegistrarPendentes } from '../../offline/PendentesProvider.jsx';
import Carregando from '../../Carregando.jsx';
import { SemSetor } from '../../campo/telas/Campo.jsx';
import { Faixa } from '../../campo/telas/apresentacao.jsx';
import { consultaAvaliacoesDoSetor, consultaDecisoesDoSetor } from '../repositorio.js';
import { formatarDia } from '../formato.js';
import { useContextoGestao, useNomes } from './contexto.js';
import { ListaAcompanhamento } from './apresentacao.jsx';

/** Semana pedida na URL, ou a atual se não vier ou for inválida. */
function semanaDaUrl(pedida, atual) {
  if (!pedida) return atual;
  try {
    semanaAnterior(pedida); // valida o formato
    return pedida;
  } catch {
    return atual;
  }
}

/** Lista das avaliações do setor numa semana, agrupadas pelo que falta fazer (decidir, executar). */
export default function Acompanhamento() {
  const { db, empresaId, uid, meuNome, setor, podeAcompanhar: pode } = useContextoGestao();
  const [params] = useSearchParams();
  const atual = useMemo(() => semanaISO(), []);
  const semana = semanaDaUrl(params.get('semana'), atual);
  const [avaliacoes, setAvaliacoes] = useState(null);
  const [talhoes, setTalhoes] = useState(null);
  const [decisoes, setDecisoes] = useState(null);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    if (!pode) return undefined;
    setAvaliacoes(null);
    const falha = (e) => setErro(e.code ?? 'erro');
    const meta = { includeMetadataChanges: true };
    const cancelar = [
      onSnapshot(consultaAvaliacoesDoSetor(db, empresaId, setor.setorId, semana), meta, (s) => setAvaliacoes(s.docs.map((d) => ({ ...comId(d), pendente: d.metadata.hasPendingWrites }))), falha),
      onSnapshot(consultaTalhoes(db, empresaId, setor.unidadeId), (s) => setTalhoes(Object.fromEntries(s.docs.map((d) => [d.id, d.data()]))), falha),
      onSnapshot(consultaDecisoesDoSetor(db, empresaId, setor.setorId), meta, (s) => setDecisoes(Object.fromEntries(s.docs.map((d) => [d.data().avaliacaoId, { ...d.data(), pendente: d.metadata.hasPendingWrites }]))), falha),
    ];
    return () => cancelar.forEach((f) => f());
  }, [db, empresaId, setor, pode, semana]);

  const nomes = useNomes(db, empresaId, (avaliacoes ?? []).map((a) => a.responsavelUid), uid, meuNome);
  const pendentes = (avaliacoes ?? []).filter((a) => a.pendente).length + Object.values(decisoes ?? {}).filter((d) => d.pendente).length;
  useRegistrarPendentes('acompanhamento', pendentes);

  if (!setor) return <SemSetor />;
  if (!pode) return <Faixa tipo="aviso">Você não é agrônomo nem gerente neste setor, então não acompanha as avaliações dos outros.</Faixa>;
  if (erro) return <Faixa tipo="erro">Não foi possível carregar as avaliações ({erro}). Tente de novo.</Faixa>;
  if (avaliacoes === null || talhoes === null || decisoes === null) return <Carregando texto="Carregando avaliações…" />;

  const linhas = avaliacoes
    .map((a) => ({
      id: a.id,
      talhaoNome: talhoes[a.talhaoId]?.nome ?? a.talhaoId,
      pragueiro: nomes[a.responsavelUid],
      dataTexto: formatarDia(a.data),
      status: a.status,
      decisaoStatus: decisoes[a.id]?.status ?? null,
      pendente: a.pendente || Boolean(decisoes[a.id]?.pendente),
    }))
    .sort((x, y) => x.talhaoNome.localeCompare(y.talhaoNome, 'pt-BR', { numeric: true }));

  return (
    <ListaAcompanhamento
      semana={semana}
      rotuloSemana={rotuloDaSemana(semana)}
      semanaAnterior={semanaAnterior(semana)}
      semanaSeguinte={semanaSeguinte(semana)}
      ehSemanaAtual={semana === atual}
      linhas={linhas}
    />
  );
}
